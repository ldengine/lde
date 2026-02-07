import { VocabularyAnalyzer, Success, NotSupported } from '../src/index.js';
import type { Analyzer } from '../src/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import { describe, it, expect, vi } from 'vitest';
import { DataFactory, Store } from 'n3';

const { namedNode, quad } = DataFactory;

const VOID = 'http://rdfs.org/ns/void#';

describe('VocabularyAnalyzer', () => {
  function createDataset(sparqlEndpoint?: string): Dataset {
    const distributions: Distribution[] = [];
    if (sparqlEndpoint) {
      distributions.push(Distribution.sparql(new URL(sparqlEndpoint)));
    }
    return new Dataset({
      iri: new URL('http://example.com/dataset/1'),
      distributions,
    });
  }

  function createMockAnalyzer(result: Success | NotSupported): Analyzer {
    return {
      name: 'inner',
      execute: vi.fn().mockResolvedValue(result),
    };
  }

  describe('execute', () => {
    it('passes through NotSupported from inner analyzer', async () => {
      const inner = createMockAnalyzer(new NotSupported('not supported'));
      const analyzer = new VocabularyAnalyzer(inner);

      const result = await analyzer.execute(createDataset());

      expect(result).toBeInstanceOf(NotSupported);
    });

    it('adds void:vocabulary for schema.org properties', async () => {
      const store = new Store();
      store.addQuad(
        quad(
          namedNode('http://example.com/dataset/1'),
          namedNode(`${VOID}property`),
          namedNode('http://schema.org/name')
        )
      );

      const inner = createMockAnalyzer(new Success(store));
      const analyzer = new VocabularyAnalyzer(inner);

      const result = await analyzer.execute(
        createDataset('http://example.com/sparql')
      );

      expect(result).toBeInstanceOf(Success);
      const data = (result as Success).data;
      const vocabQuads = [...data].filter(
        (q) => q.predicate.value === `${VOID}vocabulary`
      );
      expect(vocabQuads).toHaveLength(1);
      expect(vocabQuads[0].object.value).toBe('http://schema.org/');
    });

    it('adds void:vocabulary for https schema.org properties', async () => {
      const store = new Store();
      store.addQuad(
        quad(
          namedNode('http://example.com/dataset/1'),
          namedNode(`${VOID}property`),
          namedNode('https://schema.org/name')
        )
      );

      const inner = createMockAnalyzer(new Success(store));
      const analyzer = new VocabularyAnalyzer(inner);

      const result = await analyzer.execute(
        createDataset('http://example.com/sparql')
      );

      expect(result).toBeInstanceOf(Success);
      const data = (result as Success).data;
      const vocabQuads = [...data].filter(
        (q) => q.predicate.value === `${VOID}vocabulary`
      );
      expect(vocabQuads).toHaveLength(1);
      expect(vocabQuads[0].object.value).toBe('https://schema.org/');
    });

    it('adds void:vocabulary for Dublin Core properties', async () => {
      const store = new Store();
      store.addQuad(
        quad(
          namedNode('http://example.com/dataset/1'),
          namedNode(`${VOID}property`),
          namedNode('http://purl.org/dc/terms/title')
        )
      );
      store.addQuad(
        quad(
          namedNode('http://example.com/dataset/1'),
          namedNode(`${VOID}property`),
          namedNode('http://purl.org/dc/elements/1.1/creator')
        )
      );

      const inner = createMockAnalyzer(new Success(store));
      const analyzer = new VocabularyAnalyzer(inner);

      const result = await analyzer.execute(
        createDataset('http://example.com/sparql')
      );

      expect(result).toBeInstanceOf(Success);
      const data = (result as Success).data;
      const vocabQuads = [...data].filter(
        (q) => q.predicate.value === `${VOID}vocabulary`
      );
      expect(vocabQuads).toHaveLength(2);
      const vocabUris = vocabQuads.map((q) => q.object.value).sort();
      expect(vocabUris).toEqual([
        'http://purl.org/dc/elements/1.1/',
        'http://purl.org/dc/terms/',
      ]);
    });

    it('does not add duplicates for same vocabulary', async () => {
      const store = new Store();
      store.addQuad(
        quad(
          namedNode('http://example.com/dataset/1'),
          namedNode(`${VOID}property`),
          namedNode('http://schema.org/name')
        )
      );
      store.addQuad(
        quad(
          namedNode('http://example.com/dataset/1'),
          namedNode(`${VOID}property`),
          namedNode('http://schema.org/description')
        )
      );

      const inner = createMockAnalyzer(new Success(store));
      const analyzer = new VocabularyAnalyzer(inner);

      const result = await analyzer.execute(
        createDataset('http://example.com/sparql')
      );

      expect(result).toBeInstanceOf(Success);
      const data = (result as Success).data;
      const vocabQuads = [...data].filter(
        (q) => q.predicate.value === `${VOID}vocabulary`
      );
      expect(vocabQuads).toHaveLength(1);
    });

    it('does not add vocabulary for unknown prefixes', async () => {
      const store = new Store();
      store.addQuad(
        quad(
          namedNode('http://example.com/dataset/1'),
          namedNode(`${VOID}property`),
          namedNode('http://example.com/custom/property')
        )
      );

      const inner = createMockAnalyzer(new Success(store));
      const analyzer = new VocabularyAnalyzer(inner);

      const result = await analyzer.execute(
        createDataset('http://example.com/sparql')
      );

      expect(result).toBeInstanceOf(Success);
      const data = (result as Success).data;
      const vocabQuads = [...data].filter(
        (q) => q.predicate.value === `${VOID}vocabulary`
      );
      expect(vocabQuads).toHaveLength(0);
    });
  });

  describe('finish', () => {
    it('delegates finish to inner analyzer', async () => {
      const finish = vi.fn();
      const inner: Analyzer = {
        name: 'inner',
        execute: vi.fn().mockResolvedValue(new Success(new Store())),
        finish,
      };
      const analyzer = new VocabularyAnalyzer(inner);

      await analyzer.finish();

      expect(finish).toHaveBeenCalled();
    });
  });
});
