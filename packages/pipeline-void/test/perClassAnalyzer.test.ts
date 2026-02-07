import { PerClassAnalyzer, Success, NotSupported } from '../src/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

describe('PerClassAnalyzer', () => {
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
      const analyzer = new PerClassAnalyzer(
        'test',
        'CONSTRUCT { ?s ?p ?o } WHERE { ?s a <#class#> ; ?p ?o } LIMIT 1'
      );

      const result = await analyzer.execute(createDataset());

      expect(result).toBeInstanceOf(NotSupported);
    });

    it('executes query for each class', async () => {
      const mockFetcher = {
        fetchBindings: vi.fn().mockImplementation(() => {
          const stream = new Readable({
            objectMode: true,
            read() {
              /* no-op */
            },
          });
          // Return Record<string, RDF.Term> format (not Map).
          stream.push({ class: namedNode('http://example.com/Class1') });
          stream.push({ class: namedNode('http://example.com/Class2') });
          stream.push(null);
          return Promise.resolve(stream);
        }),
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

      const analyzer = new PerClassAnalyzer(
        'test',
        'CONSTRUCT { ?s ?p ?o } WHERE { ?s a <#class#> ; ?p ?o }',
        { fetcher: mockFetcher as never }
      );

      const result = await analyzer.execute(
        createDataset('http://example.com/sparql')
      );

      expect(result).toBeInstanceOf(Success);
      // Called twice, once for each class.
      expect(mockFetcher.fetchTriples).toHaveBeenCalledTimes(2);
    });

    it('substitutes class IRI in query', async () => {
      const queries: string[] = [];
      const mockFetcher = {
        fetchBindings: vi.fn().mockImplementation(() => {
          const stream = new Readable({
            objectMode: true,
            read() {
              /* no-op */
            },
          });
          // Return Record<string, RDF.Term> format (not Map).
          stream.push({ class: namedNode('http://example.com/Person') });
          stream.push(null);
          return Promise.resolve(stream);
        }),
        fetchTriples: vi
          .fn()
          .mockImplementation((_endpoint: string, query: string) => {
            queries.push(query);
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

      const analyzer = new PerClassAnalyzer(
        'test',
        'CONSTRUCT { ?s a <#class#> } WHERE { ?s a <#class#> }',
        { fetcher: mockFetcher as never }
      );

      await analyzer.execute(createDataset('http://example.com/sparql'));

      expect(queries[0]).toContain('<http://example.com/Person>');
      expect(queries[0]).not.toContain('<#class#>');
    });
  });

  describe('fromFile', () => {
    it('loads query from file', async () => {
      const analyzer = await PerClassAnalyzer.fromFile(
        'class-property-datatypes.rq'
      );

      expect(analyzer.name).toBe('class-property-datatypes.rq');
    });
  });
});
