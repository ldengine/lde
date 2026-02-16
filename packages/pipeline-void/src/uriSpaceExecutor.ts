import { Dataset, Distribution } from '@lde/dataset';
import {
  NotSupported,
  type Executor,
  type ExecuteOptions,
} from '@lde/pipeline';
import type { Quad } from '@rdfjs/types';
import { DataFactory } from 'n3';

const { namedNode, quad, literal, blankNode } = DataFactory;

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const VOID = 'http://rdfs.org/ns/void#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

const rdfType = namedNode(`${RDF}type`);
const voidLinkset = namedNode(`${VOID}Linkset`);
const voidSubjectsTarget = namedNode(`${VOID}subjectsTarget`);
const voidObjectsTarget = namedNode(`${VOID}objectsTarget`);
const voidTriples = namedNode(`${VOID}triples`);
const xsdInteger = namedNode(`${XSD}integer`);

/**
 * Executor decorator that consumes `void:Linkset` quads from the inner executor,
 * matches each `void:objectsTarget` against configured URI spaces using `startsWith`,
 * aggregates triple counts per matched space, and emits filtered `void:Linkset` quads.
 *
 * Inner quads are consumed and replaced with aggregated output — unmatched URI spaces
 * are discarded.
 */
export class UriSpaceExecutor implements Executor {
  constructor(
    private readonly inner: Executor,
    private readonly uriSpaces: ReadonlyMap<string, readonly Quad[]>,
  ) {}

  async execute(
    dataset: Dataset,
    distribution: Distribution,
    options?: ExecuteOptions,
  ): Promise<AsyncIterable<Quad> | NotSupported> {
    const result = await this.inner.execute(dataset, distribution, options);
    if (result instanceof NotSupported) {
      return result;
    }
    return withUriSpaces(result, dataset.iri.toString(), this.uriSpaces);
  }
}

async function* withUriSpaces(
  quads: AsyncIterable<Quad>,
  datasetIri: string,
  uriSpaces: ReadonlyMap<string, readonly Quad[]>,
): AsyncIterable<Quad> {
  // Group inner quads by subject (each subject = one Linkset).
  const linksets = new Map<string, Quad[]>();
  for await (const q of quads) {
    let group = linksets.get(q.subject.value);
    if (group === undefined) {
      group = [];
      linksets.set(q.subject.value, group);
    }
    group.push(q);
  }

  // Extract objectsTarget and triples count per Linkset,
  // match against configured URI spaces, and aggregate counts.
  const aggregated = new Map<
    string,
    { count: number; metadata: readonly Quad[] }
  >();
  for (const group of linksets.values()) {
    const objectsTarget = group.find((q) =>
      q.predicate.equals(voidObjectsTarget),
    )?.object.value;
    const triplesValue = group.find((q) => q.predicate.equals(voidTriples))
      ?.object.value;

    if (objectsTarget === undefined || triplesValue === undefined) continue;

    const count = parseInt(triplesValue, 10);
    for (const [uriSpace, metadata] of uriSpaces) {
      if (objectsTarget.startsWith(uriSpace)) {
        const existing = aggregated.get(uriSpace);
        aggregated.set(uriSpace, {
          count: (existing?.count ?? 0) + count,
          metadata,
        });
        break;
      }
    }
  }

  // Emit aggregated Linkset quads.
  const datasetNode = namedNode(datasetIri);
  for (const [uriSpace, { count, metadata }] of aggregated) {
    const linksetNode = blankNode();
    const uriSpaceNode = namedNode(uriSpace);

    yield quad(linksetNode, rdfType, voidLinkset);
    yield quad(linksetNode, voidSubjectsTarget, datasetNode);
    yield quad(linksetNode, voidObjectsTarget, uriSpaceNode);
    yield quad(linksetNode, voidTriples, literal(count.toString(), xsdInteger));

    for (const metadataQuad of metadata) {
      yield metadataQuad;
    }
  }
}
