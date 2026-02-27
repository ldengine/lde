import { IANA_MEDIA_TYPE_PREFIX } from './distribution.js';

const iana = (type: string) => IANA_MEDIA_TYPE_PREFIX + type;

export const sparqlMediaTypes = [
  iana('application/sparql-query'),
  iana('application/sparql-results+json'),
  iana('application/sparql-results+xml'),
];

export const rdfMediaTypes = [
  iana('application/ld+json'),
  iana('application/n-quads'),
  iana('application/n-triples'),
  iana('text/turtle'),
];
