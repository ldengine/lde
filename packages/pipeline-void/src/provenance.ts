import { Dataset, Distribution } from '@lde/dataset';
import {
  NotSupported,
  type Executor,
  type ExecuteOptions,
} from '@lde/pipeline';
import type { Quad } from '@rdfjs/types';
import { DataFactory } from 'n3';

const { namedNode, literal, blankNode, quad } = DataFactory;

const RDF_TYPE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
const PROV_ENTITY = namedNode('http://www.w3.org/ns/prov#Entity');
const PROV_ACTIVITY = namedNode('http://www.w3.org/ns/prov#Activity');
const PROV_WAS_GENERATED_BY = namedNode(
  'http://www.w3.org/ns/prov#wasGeneratedBy',
);
const PROV_STARTED_AT_TIME = namedNode(
  'http://www.w3.org/ns/prov#startedAtTime',
);
const PROV_ENDED_AT_TIME = namedNode('http://www.w3.org/ns/prov#endedAtTime');
const XSD_DATE_TIME = namedNode('http://www.w3.org/2001/XMLSchema#dateTime');

/**
 * Executor decorator that passes through all quads from the inner executor
 * and appends PROV-O provenance metadata.
 *
 * Timestamps are captured automatically: `startedAt` when `execute()` is
 * called, `endedAt` when the inner quad stream is fully consumed.
 *
 * Appended quads:
 * - `<dataset> a prov:Entity`
 * - `<dataset> prov:wasGeneratedBy _:activity`
 * - `_:activity a prov:Activity`
 * - `_:activity prov:startedAtTime "..."^^xsd:dateTime`
 * - `_:activity prov:endedAtTime "..."^^xsd:dateTime`
 */
export class ProvenanceExecutor implements Executor {
  constructor(private readonly inner: Executor) {}

  async execute(
    dataset: Dataset,
    distribution: Distribution,
    options?: ExecuteOptions,
  ): Promise<AsyncIterable<Quad> | NotSupported> {
    const startedAt = new Date();
    const result = await this.inner.execute(dataset, distribution, options);
    if (result instanceof NotSupported) {
      return result;
    }
    return withProvenance(result, dataset.iri.toString(), startedAt);
  }
}

async function* withProvenance(
  quads: AsyncIterable<Quad>,
  iri: string,
  startedAt: Date,
): AsyncIterable<Quad> {
  for await (const q of quads) {
    yield q;
  }

  const endedAt = new Date();
  const subject = namedNode(iri);
  const activity = blankNode();

  yield quad(subject, RDF_TYPE, PROV_ENTITY);
  yield quad(subject, PROV_WAS_GENERATED_BY, activity);
  yield quad(activity, RDF_TYPE, PROV_ACTIVITY);
  yield quad(
    activity,
    PROV_STARTED_AT_TIME,
    literal(startedAt.toISOString(), XSD_DATE_TIME),
  );
  yield quad(
    activity,
    PROV_ENDED_AT_TIME,
    literal(endedAt.toISOString(), XSD_DATE_TIME),
  );
}
