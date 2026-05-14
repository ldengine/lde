import {
  Stage,
  SparqlConstructExecutor,
  type StageOptions,
  type Validator,
} from '@lde/pipeline';
import { assertSafeIri } from '@lde/dataset';
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
 * shapes file. Each stage's CONSTRUCT executor takes N instances of its
 * target class plus, for every path chain the SHACL declares (recursively,
 * stopping at leaf constraints or cycles), the triples reachable along that
 * chain’s terminal node.
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
  const validation = options.validator
    ? { validator: options.validator, onInvalid: options.onInvalid ?? 'write' }
    : undefined;
  const shapes = await extractTargetShapes(options.shapesFile);

  return shapes.map(
    (shape) =>
      new Stage({
        name: `shacl-sample-${localName(shape.targetClass.value)}`,
        executors: new SparqlConstructExecutor({
          query: buildSampleQuery(shape, samplesPerClass),
          timeout,
        }),
        validation,
      }),
  );
}

function buildSampleQuery(shape: TargetShape, limit: number): string {
  assertSafeIri(shape.targetClass.value);
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
    SELECT ?s {
      #subjectFilter#
      ?s a <${shape.targetClass.value}> .
    }
    LIMIT ${limit}
  }
  {
    ?s ?p ?o .
  }${chainBranches}
}`;
}

function localName(iri: string): string {
  const match = /[#/]([^#/]+)$/.exec(iri);
  return (match?.[1] ?? iri).replace(/[^A-Za-z0-9_-]/g, '_');
}
