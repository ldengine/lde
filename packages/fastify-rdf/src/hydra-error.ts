import { DataFactory, Store } from 'n3';

const { namedNode, blankNode, literal } = DataFactory;

const RDF_TYPE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
const HYDRA_ERROR = namedNode('http://www.w3.org/ns/hydra/core#Error');
const HYDRA_TITLE = namedNode('http://www.w3.org/ns/hydra/core#title');
const HYDRA_DESCRIPTION = namedNode(
  'http://www.w3.org/ns/hydra/core#description',
);

/**
 * Serialize a Hydra error as compact JSON-LD without needing the `jsonld` dependency.
 */
export function serializeHydraErrorAsJsonLd(
  title: string,
  description?: string,
): string {
  const obj: Record<string, string> = {
    '@context': 'http://www.w3.org/ns/hydra/core#',
    '@type': 'Error',
    title,
  };
  if (description !== undefined) {
    obj['description'] = description;
  }
  return JSON.stringify(obj);
}

/**
 * Create an N3 Store with Hydra error triples.
 */
export function createHydraErrorDataset(
  title: string,
  description?: string,
): Store {
  const store = new Store();
  const subject = blankNode();
  store.add(DataFactory.quad(subject, RDF_TYPE, HYDRA_ERROR));
  store.add(DataFactory.quad(subject, HYDRA_TITLE, literal(title)));
  if (description !== undefined) {
    store.add(
      DataFactory.quad(subject, HYDRA_DESCRIPTION, literal(description)),
    );
  }
  return store;
}
