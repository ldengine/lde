import { dcterms, foaf, xsd } from 'ldkit/namespaces';
import { dcat } from './dcat.js';

export const DatasetSchema = {
  '@type': dcat.Dataset,
  title: {
    '@id': dcterms.title,
    '@multilang': true,
  },
  description: {
    '@id': dcterms.description,
    '@optional': true, // But required in DCAT-AP 3.0
    '@multilang': true,
  },
  language: {
    '@id': dcterms.language,
    '@optional': true,
    '@array': true,
  },
  license: {
    '@id': dcterms.license,
    '@optional': true,
  },
  creator: {
    '@id': dcterms.creator,
    '@optional': true, // But required in DCAT-AP 3.0
    '@array': true,
    '@schema': {
      name: {
        '@id': foaf.name,
        '@multilang': true,
      },
    },
  },
  publisher: {
    '@id': dcterms.publisher,
    '@optional': true,
    '@schema': {
      name: {
        '@id': foaf.name,
        '@multilang': true,
      },
    },
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
      conformsTo: {
        '@id': dcterms.conformsTo,
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
