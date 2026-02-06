import type { DatasetCore } from '@rdfjs/types';
import { DataFactory, Store } from 'n3';

const { namedNode, literal, blankNode, quad } = DataFactory;

const RDF_TYPE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
const PROV_ENTITY = namedNode('http://www.w3.org/ns/prov#Entity');
const PROV_ACTIVITY = namedNode('http://www.w3.org/ns/prov#Activity');
const PROV_WAS_GENERATED_BY = namedNode(
  'http://www.w3.org/ns/prov#wasGeneratedBy'
);
const PROV_STARTED_AT_TIME = namedNode(
  'http://www.w3.org/ns/prov#startedAtTime'
);
const PROV_ENDED_AT_TIME = namedNode('http://www.w3.org/ns/prov#endedAtTime');
const XSD_DATE_TIME = namedNode('http://www.w3.org/2001/XMLSchema#dateTime');

/**
 * Add PROV-O provenance metadata to a dataset.
 *
 * Adds:
 * - `<iri> a prov:Entity`
 * - `<iri> prov:wasGeneratedBy _:activity`
 * - `_:activity a prov:Activity`
 * - `_:activity prov:startedAtTime "..."^^xsd:dateTime`
 * - `_:activity prov:endedAtTime "..."^^xsd:dateTime`
 *
 * @param data The dataset to add provenance to
 * @param iri The IRI of the entity
 * @param startedAt Start time of the activity
 * @param endedAt End time of the activity
 */
export function withProvenance(
  data: DatasetCore,
  iri: string,
  startedAt: Date,
  endedAt: Date
): DatasetCore {
  const store = new Store([...data]);
  const subject = namedNode(iri);
  const activity = blankNode();

  store.addQuad(quad(subject, RDF_TYPE, PROV_ENTITY));
  store.addQuad(quad(subject, PROV_WAS_GENERATED_BY, activity));
  store.addQuad(quad(activity, RDF_TYPE, PROV_ACTIVITY));
  store.addQuad(
    quad(
      activity,
      PROV_STARTED_AT_TIME,
      literal(startedAt.toISOString(), XSD_DATE_TIME)
    )
  );
  store.addQuad(
    quad(
      activity,
      PROV_ENDED_AT_TIME,
      literal(endedAt.toISOString(), XSD_DATE_TIME)
    )
  );

  return store;
}
