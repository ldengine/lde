import { dcterms, xsd } from 'ldkit/namespaces';
import { dcat } from './dcat.js';

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
        '@type': xsd.nonNegativeInteger,
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
