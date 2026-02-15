import { withVocabularies } from '../src/index.js';
import { describe, it, expect } from 'vitest';
import { DataFactory } from 'n3';
import type { Quad } from '@rdfjs/types';

const { namedNode, quad } = DataFactory;

const VOID = 'http://rdfs.org/ns/void#';

async function* toAsync(...quads: Quad[]): AsyncIterable<Quad> {
  yield* quads;
}

async function collect(stream: AsyncIterable<Quad>): Promise<Quad[]> {
  const result: Quad[] = [];
  for await (const q of stream) {
    result.push(q);
  }
  return result;
}

describe('withVocabularies', () => {
  const datasetIri = 'http://example.com/dataset/1';

  it('passes through all input quads', async () => {
    const input = quad(
      namedNode(datasetIri),
      namedNode(`${VOID}triples`),
      namedNode('http://example.com/100'),
    );

    const result = await collect(withVocabularies(toAsync(input), datasetIri));

    expect(result[0]).toBe(input);
  });

  it('adds void:vocabulary for schema.org properties', async () => {
    const input = quad(
      namedNode(datasetIri),
      namedNode(`${VOID}property`),
      namedNode('http://schema.org/name'),
    );

    const result = await collect(withVocabularies(toAsync(input), datasetIri));

    const vocabQuads = result.filter(
      (q) => q.predicate.value === `${VOID}vocabulary`,
    );
    expect(vocabQuads).toHaveLength(1);
    expect(vocabQuads[0].object.value).toBe('http://schema.org/');
  });

  it('adds void:vocabulary for Dublin Core properties', async () => {
    const input = [
      quad(
        namedNode(datasetIri),
        namedNode(`${VOID}property`),
        namedNode('http://purl.org/dc/terms/title'),
      ),
      quad(
        namedNode(datasetIri),
        namedNode(`${VOID}property`),
        namedNode('http://purl.org/dc/elements/1.1/creator'),
      ),
    ];

    const result = await collect(
      withVocabularies(toAsync(...input), datasetIri),
    );

    const vocabQuads = result.filter(
      (q) => q.predicate.value === `${VOID}vocabulary`,
    );
    expect(vocabQuads).toHaveLength(2);
    const vocabUris = vocabQuads.map((q) => q.object.value).sort();
    expect(vocabUris).toEqual([
      'http://purl.org/dc/elements/1.1/',
      'http://purl.org/dc/terms/',
    ]);
  });

  it('does not add duplicates for same vocabulary', async () => {
    const input = [
      quad(
        namedNode(datasetIri),
        namedNode(`${VOID}property`),
        namedNode('http://schema.org/name'),
      ),
      quad(
        namedNode(datasetIri),
        namedNode(`${VOID}property`),
        namedNode('http://schema.org/description'),
      ),
    ];

    const result = await collect(
      withVocabularies(toAsync(...input), datasetIri),
    );

    const vocabQuads = result.filter(
      (q) => q.predicate.value === `${VOID}vocabulary`,
    );
    expect(vocabQuads).toHaveLength(1);
  });

  it('does not add vocabulary for unknown prefixes', async () => {
    const input = quad(
      namedNode(datasetIri),
      namedNode(`${VOID}property`),
      namedNode('http://example.com/custom/property'),
    );

    const result = await collect(withVocabularies(toAsync(input), datasetIri));

    const vocabQuads = result.filter(
      (q) => q.predicate.value === `${VOID}vocabulary`,
    );
    expect(vocabQuads).toHaveLength(0);
  });

  it('uses custom vocabularies when provided', async () => {
    const customVocabularies = ['http://example.com/vocab/'];
    const input = [
      quad(
        namedNode(datasetIri),
        namedNode(`${VOID}property`),
        namedNode('http://example.com/vocab/name'),
      ),
      quad(
        namedNode(datasetIri),
        namedNode(`${VOID}property`),
        namedNode('http://schema.org/name'),
      ),
    ];

    const result = await collect(
      withVocabularies(toAsync(...input), datasetIri, customVocabularies),
    );

    const vocabQuads = result.filter(
      (q) => q.predicate.value === `${VOID}vocabulary`,
    );
    expect(vocabQuads).toHaveLength(1);
    expect(vocabQuads[0].object.value).toBe('http://example.com/vocab/');
  });
});
