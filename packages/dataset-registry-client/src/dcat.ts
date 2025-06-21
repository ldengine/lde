import { createNamespace } from 'ldkit/namespaces';

export const dcat = createNamespace({
  iri: 'http://www.w3.org/ns/dcat#',
  prefix: 'dcat:',
  terms: [
    'Dataset',
    'Distribution',
    'accessURL',
    'keyword',
    'mediaType',
    'byteSize',
    'distribution',
    'modified',
    'downloadURL',
  ],
} as const);
