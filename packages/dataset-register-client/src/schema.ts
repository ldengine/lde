import { createNamespace } from 'ldkit';
import { dcterms, xsd } from 'ldkit/namespaces';

const dcat = createNamespace({
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

export const DatasetSchema = {
  '@type': dcat.Dataset,
  title: {
    '@id': dcterms.title,
    '@multilang': true,
    '@optional': true,
  },
  description: {
    '@id': dcterms.description,
    '@multilang': true,
    '@optional': true,
  },
  distribution: {
    '@id': dcat.distribution,
    '@array': true,
    '@schema': {
      '@type': dcat.Distribution,
      accessURL: dcat.accessURL,
      mediaType: dcat.mediaType,
      byteSize: {
        '@id': dcat.byteSize,
        '@optional': true,
      },
      modified: {
        '@id': dcterms.modified,
        '@type': xsd.dateTime,
        '@optional': true,
      },
    },
  },
} as const;
