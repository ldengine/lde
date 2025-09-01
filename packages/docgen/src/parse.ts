import { rdfDereferencer } from 'rdf-dereference';
import { JsonLdArray } from 'jsonld/jsonld-spec.js';
import jsonld from 'jsonld';

export async function parseRdfToJsonLd(filePath: string): Promise<JsonLdArray> {
  const { data } = await rdfDereferencer.dereference(filePath, {
    localFiles: true,
  });

  const quads = [];
  for await (const quad of data) {
    quads.push(quad);
  }

  return jsonld.fromRDF(quads, {
    useNativeTypes: true, // Convert xsd:integer to Number etc.
  });
}
