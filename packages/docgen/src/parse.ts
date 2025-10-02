import { rdfDereferencer } from 'rdf-dereference';
import { JsonLdArray } from 'jsonld/jsonld-spec.js';
import jsonld from 'jsonld';
import { rdfSerializer } from 'rdf-serialize';
import streamToString from 'stream-to-string';

export async function parseRdfToJsonLd(filePath: string): Promise<JsonLdArray> {
  const { data } = await rdfDereferencer.dereference(filePath, {
    localFiles: true,
  });

  // Convert to n-quads, the only input format that the jsonld library takes.
  const nq = rdfSerializer.serialize(data, {
    contentType: 'application/n-quads',
  });

  const nqString = await streamToString(nq);

  return jsonld.fromRDF(nqString, {
    useNativeTypes: true, // Convert xsd:integer to Number etc.
  });
}
