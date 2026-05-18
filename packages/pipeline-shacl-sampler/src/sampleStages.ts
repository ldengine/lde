import {
  Stage,
  SparqlConstructExecutor,
  SparqlItemSelector,
  type ItemSelector,
  type StageOptions,
  type Validator,
} from '@lde/pipeline';
import { assertSafeIri } from '@lde/dataset';
import type { NamedNode } from '@rdfjs/types';
import { extractTargetShapes, type TargetShape } from './pathExtractor.js';

type OnInvalid = NonNullable<StageOptions['validation']>['onInvalid'];

/** Options for {@link shaclSampleStages}. */
export interface ShaclSampleStagesOptions {
  /** URL or local path to the SHACL shapes file. */
  shapesFile: string;
  /**
   * Number of top-level resources to sample per `sh:targetClass`.
   * @default 50
   */
  samplesPerClass?: number;
  /**
   * SPARQL query timeout in milliseconds.
   * @default 60000
   */
  timeout?: number;
  /**
   * Maximum number of sampled subjects per executor call. Defaults to
   * {@link samplesPerClass} so the whole sample fits in one CONSTRUCT
   * round-trip; lower to spread work across multiple parallel queries.
   */
  batchSize?: number;
  /**
   * Maximum concurrent in-flight executor batches per stage. @default 10
   */
  maxConcurrency?: number;
  /**
   * Validator attached to every generated stage. Typically a
   * {@link https://www.npmjs.com/package/@lde/pipeline-shacl-validator ShaclValidator}
   * configured with the same {@link shapesFile}.
   */
  validator?: Validator;
  /**
   * Behaviour when a sampled batch fails validation. Only used when
   * {@link validator} is set.
   * @default 'write'
   */
  onInvalid?: OnInvalid;
}

/**
 * Build one sampling {@link Stage} per `sh:targetClass` declared in the SHACL
 * shapes file. Each stage pairs a SELECT-based {@link ItemSelector} that picks
 * N instances of its target class with a CONSTRUCT executor that, for every
 * path chain the SHACL declares (recursively, stopping at leaf constraints
 * or cycles), pulls in the triples reachable along that chain’s terminal
 * node.
 *
 * Pass a {@link Validator} to attach it to every generated stage:
 *
 * ```ts
 * const validator = new ShaclValidator({ shapesFile, reportDir });
 * const stages = await shaclSampleStages({ shapesFile, validator });
 * ```
 */
export async function shaclSampleStages(
  options: ShaclSampleStagesOptions,
): Promise<Stage[]> {
  const samplesPerClass = options.samplesPerClass ?? 50;
  const timeout = options.timeout ?? 60_000;
  const batchSize = options.batchSize ?? samplesPerClass;
  const maxConcurrency = options.maxConcurrency;
  const validation = options.validator
    ? { validator: options.validator, onInvalid: options.onInvalid ?? 'write' }
    : undefined;
  const shapes = await extractTargetShapes(options.shapesFile);

  return shapes.map(
    (shape) =>
      new Stage({
        name: `shacl-sample-${localName(shape.targetClass.value)}`,
        itemSelector: subjectSelector(shape.targetClass, samplesPerClass),
        executors: new SparqlConstructExecutor({
          query: buildSampleQuery(shape),
          timeout,
        }),
        batchSize,
        maxConcurrency,
        validation,
      }),
  );
}

function subjectSelector(targetClass: NamedNode, limit: number): ItemSelector {
  assertSafeIri(targetClass.value);
  return {
    select(distribution, batchSize) {
      const query = buildSubjectSelectorQuery(
        targetClass,
        distribution.subjectFilter,
        distribution.namedGraph,
      );
      return new SparqlItemSelector({
        query,
        maxResults: limit,
      }).select(distribution, batchSize);
    },
  };
}

export function buildSubjectSelectorQuery(
  targetClass: NamedNode,
  subjectFilter?: string,
  namedGraph?: string,
): string {
  let fromClause = '';
  if (namedGraph) {
    assertSafeIri(namedGraph);
    fromClause = `FROM <${namedGraph}>`;
  }
  return [
    'SELECT DISTINCT ?s',
    fromClause,
    `WHERE { ${subjectFilter ?? ''} ?s a <${targetClass.value}> . }`,
  ].join('\n');
}

export function buildSampleQuery(shape: TargetShape): string {
  for (const chain of shape.pathChains) {
    for (const path of chain) assertSafeIri(path.value);
  }

  const chainBranches = shape.pathChains
    .map(
      (chain) => ` UNION {
    ?s ${chain.map((p) => `<${p.value}>`).join('/')} ?neighbour .
    ?neighbour ?np ?nv .
  }`,
    )
    .join('');

  return `CONSTRUCT {
  ?s ?p ?o .
  ?neighbour ?np ?nv .
}
WHERE {
  {
    ?s ?p ?o .
  }${chainBranches}
}`;
}

function localName(iri: string): string {
  const match = /[#/]([^#/]+)$/.exec(iri);
  return (match?.[1] ?? iri).replace(/[^A-Za-z0-9_-]/g, '_');
}
