import {
  SparqlQueryAnalyzer,
  Success,
  Failure,
  NotSupported,
} from '../src/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

describe('SparqlQueryAnalyzer', () => {
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

  describe('execute', () => {
    it('returns NotSupported when no SPARQL distribution', async () => {
      const analyzer = new SparqlQueryAnalyzer(
        'test',
        'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1'
      );

      const result = await analyzer.execute(createDataset());

      expect(result).toBeInstanceOf(NotSupported);
      expect((result as NotSupported).message).toBe(
        'No SPARQL distribution available'
      );
    });

    it('executes query and returns Success with data', async () => {
      const mockFetcher = {
        fetchTriples: vi.fn().mockImplementation(() => {
          const stream = new Readable({
            objectMode: true,
            read() {
              /* no-op */
            },
          });
          stream.push(
            quad(
              namedNode('http://example.com/s'),
              namedNode('http://example.com/p'),
              literal('o')
            )
          );
          stream.push(null);
          return Promise.resolve(stream);
        }),
      };

      const analyzer = new SparqlQueryAnalyzer(
        'test',
        'CONSTRUCT { ?dataset a <http://rdfs.org/ns/void#Dataset> } WHERE { ?s ?p ?o } LIMIT 1',
        { fetcher: mockFetcher as never }
      );

      const result = await analyzer.execute(
        createDataset('http://example.com/sparql')
      );

      expect(result).toBeInstanceOf(Success);
      expect([...(result as Success).data]).toHaveLength(1);
    });

    it('substitutes template variables in query', async () => {
      let executedQuery = '';
      const mockFetcher = {
        fetchTriples: vi.fn().mockImplementation((_endpoint, query) => {
          executedQuery = query;
          const stream = new Readable({
            objectMode: true,
            read() {
              /* no-op */
            },
          });
          stream.push(null);
          return Promise.resolve(stream);
        }),
      };

      const analyzer = new SparqlQueryAnalyzer(
        'test',
        'CONSTRUCT { ?dataset a <http://rdfs.org/ns/void#Dataset> } #namedGraph# WHERE { #subjectFilter# ?s ?p ?o }',
        { fetcher: mockFetcher as never }
      );

      const dataset = createDataset('http://example.com/sparql');

      await analyzer.execute(dataset);

      expect(executedQuery).toContain('<http://example.com/dataset/1>');
      expect(executedQuery).not.toContain('?dataset');
    });

    it('returns Failure on error', async () => {
      const mockFetcher = {
        fetchTriples: vi.fn().mockRejectedValue(new Error('Query timeout')),
      };

      const analyzer = new SparqlQueryAnalyzer(
        'test',
        'CONSTRUCT {} WHERE {}',
        {
          fetcher: mockFetcher as never,
        }
      );

      const result = await analyzer.execute(
        createDataset('http://example.com/sparql')
      );

      expect(result).toBeInstanceOf(Failure);
      expect((result as Failure).message).toBe('Query timeout');
    });
  });

  describe('fromFile', () => {
    it('loads query from file', async () => {
      const analyzer = await SparqlQueryAnalyzer.fromFile('triples.rq');

      expect(analyzer.name).toBe('triples.rq');
    });
  });
});
