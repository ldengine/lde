import type { Quad } from '@rdfjs/types';
import { DataFactory } from 'n3';

const { namedNode, quad } = DataFactory;

const VOID = 'http://rdfs.org/ns/void#';
const voidProperty = namedNode(`${VOID}property`);
const voidVocabulary = namedNode(`${VOID}vocabulary`);

/**
 * Known vocabulary namespace prefixes mapped to their canonical URIs.
 */
const vocabularyPrefixes: ReadonlyMap<string, string> = new Map([
  ['http://schema.org/', 'http://schema.org/'],
  ['https://schema.org/', 'https://schema.org/'],
  [
    'https://www.ica.org/standards/RiC/ontology#',
    'https://www.ica.org/standards/RiC/ontology#',
  ],
  [
    'http://www.cidoc-crm.org/cidoc-crm/',
    'http://www.cidoc-crm.org/cidoc-crm/',
  ],
  ['http://purl.org/ontology/bibo/', 'http://purl.org/ontology/bibo/'],
  ['http://purl.org/dc/elements/1.1/', 'http://purl.org/dc/elements/1.1/'],
  ['http://purl.org/dc/terms/', 'http://purl.org/dc/terms/'],
  ['http://purl.org/dc/dcmitype/', 'http://purl.org/dc/dcmitype/'],
  [
    'http://www.w3.org/2004/02/skos/core#',
    'http://www.w3.org/2004/02/skos/core#',
  ],
  ['http://xmlns.com/foaf/0.1/', 'http://xmlns.com/foaf/0.1/'],
]);

/**
 * Streaming transformer that passes through all quads and appends
 * `void:vocabulary` triples for detected vocabulary prefixes.
 *
 * Inspects quads with predicate `void:property` to detect known vocabulary
 * namespace prefixes, then yields the corresponding `void:vocabulary` quads
 * after all input quads have been consumed.
 */
export async function* withVocabularies(
  quads: AsyncIterable<Quad>,
  datasetIri: string
): AsyncIterable<Quad> {
  const detectedVocabularies = new Set<string>();

  for await (const q of quads) {
    yield q;

    if (q.predicate.equals(voidProperty)) {
      const propertyUri = q.object.value;
      for (const [prefix, vocabUri] of vocabularyPrefixes) {
        if (propertyUri.startsWith(prefix)) {
          detectedVocabularies.add(vocabUri);
          break;
        }
      }
    }
  }

  const datasetNode = namedNode(datasetIri);
  for (const vocabUri of detectedVocabularies) {
    yield quad(datasetNode, voidVocabulary, namedNode(vocabUri));
  }
}
