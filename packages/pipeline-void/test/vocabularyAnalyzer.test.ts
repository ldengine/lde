import { VocabularyExecutor } from '../src/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import { NotSupported } from '@lde/pipeline';
import { describe, it, expect } from 'vitest';
import { DataFactory } from 'n3';
import type { Quad } from '@rdfjs/types';
import type { Executor } from '@lde/pipeline';

const { namedNode, quad } = DataFactory;

const VOID = 'http://rdfs.org/ns/void#';

const dataset = new Dataset({
  iri: new URL('http://example.com/dataset/1'),
  distributions: [],
});
const distribution = new Distribution(new URL('http://example.com/sparql'));

function mockExecutor(quads: Quad[]): Executor {
  return {
    async execute() {
      return (async function* () {
        yield* quads;
      })();
    },
  };
}

async function collect(stream: AsyncIterable<Quad>): Promise<Quad[]> {
  const result: Quad[] = [];
  for await (const q of stream) {
    result.push(q);
  }
  return result;
}

describe('VocabularyExecutor', () => {
  it('passes through all input quads', async () => {
    const input = quad(
      namedNode(dataset.iri.toString()),
      namedNode(`${VOID}triples`),
      namedNode('http://example.com/100'),
    );

    const executor = new VocabularyExecutor(mockExecutor([input]));
    const result = await executor.execute(dataset, distribution);

    expect(result).not.toBeInstanceOf(NotSupported);
    const quads = await collect(result as AsyncIterable<Quad>);
    expect(quads[0]).toBe(input);
  });

  it('adds void:vocabulary for schema.org properties', async () => {
    const input = quad(
      namedNode(dataset.iri.toString()),
      namedNode(`${VOID}property`),
      namedNode('http://schema.org/name'),
    );

    const executor = new VocabularyExecutor(mockExecutor([input]));
    const result = await executor.execute(dataset, distribution);

    const quads = await collect(result as AsyncIterable<Quad>);
    const vocabQuads = quads.filter(
      (q) => q.predicate.value === `${VOID}vocabulary`,
    );
    expect(vocabQuads).toHaveLength(1);
    expect(vocabQuads[0].subject.value).toBe(dataset.iri.toString());
    expect(vocabQuads[0].object.value).toBe('http://schema.org/');
  });

  it('adds void:vocabulary for Dublin Core properties', async () => {
    const input = [
      quad(
        namedNode(dataset.iri.toString()),
        namedNode(`${VOID}property`),
        namedNode('http://purl.org/dc/terms/title'),
      ),
      quad(
        namedNode(dataset.iri.toString()),
        namedNode(`${VOID}property`),
        namedNode('http://purl.org/dc/elements/1.1/creator'),
      ),
    ];

    const executor = new VocabularyExecutor(mockExecutor(input));
    const result = await executor.execute(dataset, distribution);

    const quads = await collect(result as AsyncIterable<Quad>);
    const vocabQuads = quads.filter(
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
        namedNode(dataset.iri.toString()),
        namedNode(`${VOID}property`),
        namedNode('http://schema.org/name'),
      ),
      quad(
        namedNode(dataset.iri.toString()),
        namedNode(`${VOID}property`),
        namedNode('http://schema.org/description'),
      ),
    ];

    const executor = new VocabularyExecutor(mockExecutor(input));
    const result = await executor.execute(dataset, distribution);

    const quads = await collect(result as AsyncIterable<Quad>);
    const vocabQuads = quads.filter(
      (q) => q.predicate.value === `${VOID}vocabulary`,
    );
    expect(vocabQuads).toHaveLength(1);
  });

  it('does not add vocabulary for unknown prefixes', async () => {
    const input = quad(
      namedNode(dataset.iri.toString()),
      namedNode(`${VOID}property`),
      namedNode('http://example.com/custom/property'),
    );

    const executor = new VocabularyExecutor(mockExecutor([input]));
    const result = await executor.execute(dataset, distribution);

    const quads = await collect(result as AsyncIterable<Quad>);
    const vocabQuads = quads.filter(
      (q) => q.predicate.value === `${VOID}vocabulary`,
    );
    expect(vocabQuads).toHaveLength(0);
  });

  it('uses custom vocabularies when provided', async () => {
    const customVocabularies = ['http://example.com/vocab/'];
    const input = [
      quad(
        namedNode(dataset.iri.toString()),
        namedNode(`${VOID}property`),
        namedNode('http://example.com/vocab/name'),
      ),
      quad(
        namedNode(dataset.iri.toString()),
        namedNode(`${VOID}property`),
        namedNode('http://schema.org/name'),
      ),
    ];

    const executor = new VocabularyExecutor(
      mockExecutor(input),
      customVocabularies,
    );
    const result = await executor.execute(dataset, distribution);

    const quads = await collect(result as AsyncIterable<Quad>);
    const vocabQuads = quads.filter(
      (q) => q.predicate.value === `${VOID}vocabulary`,
    );
    expect(vocabQuads).toHaveLength(1);
    expect(vocabQuads[0].object.value).toBe('http://example.com/vocab/');
  });

  it('propagates NotSupported from inner executor', async () => {
    const inner: Executor = {
      async execute() {
        return new NotSupported('no endpoint');
      },
    };

    const executor = new VocabularyExecutor(inner);
    const result = await executor.execute(dataset, distribution);

    expect(result).toBeInstanceOf(NotSupported);
  });
});
