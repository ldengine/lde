import {
  SparqlConstructExecutor,
  NotSupported,
  readQueryFile,
} from '../../src/sparql/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import {
  startSparqlEndpoint,
  teardownSparqlEndpoint,
} from '@lde/local-sparql-endpoint';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

describe('SparqlConstructExecutor', () => {
  const port = 3002;

  beforeAll(async () => {
    await startSparqlEndpoint(port, 'test/fixtures/analysisTarget.trig');
  }, 60_000);

  afterAll(async () => {
    await teardownSparqlEndpoint();
  });

  describe('execute', () => {
    it('returns NotSupported when no SPARQL distribution is available', async () => {
      const executor = new SparqlConstructExecutor({
        query: 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
      });

      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [],
      });

      const result = await executor.execute(dataset);

      expect(result).toBeInstanceOf(NotSupported);
      expect((result as NotSupported).message).toBe(
        'No SPARQL distribution available'
      );
    });

    it('returns NotSupported when SPARQL distribution is not valid', async () => {
      const executor = new SparqlConstructExecutor({
        query: 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
      });

      const distribution = Distribution.sparql(
        new URL(`http://localhost:${port}/sparql`)
      );
      distribution.isValid = false;

      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [distribution],
      });

      const result = await executor.execute(dataset);

      expect(result).toBeInstanceOf(NotSupported);
    });

    it('executes query and returns stream', async () => {
      const datasetIri = 'http://foo.org/id/dataset/foo';

      const executor = new SparqlConstructExecutor({
        query: `CONSTRUCT {
          ?dataset ?p ?o .
        }
        #namedGraph#
        WHERE {
          <${datasetIri}> ?p ?o .
        }`,
      });

      const distribution = Distribution.sparql(
        new URL(`http://localhost:${port}/sparql`),
        'http://foo.org/id/graph/foo'
      );

      const dataset = new Dataset({
        iri: new URL(datasetIri),
        distributions: [distribution],
      });

      const result = await executor.execute(dataset);
      expect(result).not.toBeInstanceOf(NotSupported);

      const quads = [];
      for await (const quad of result as Exclude<typeof result, NotSupported>) {
        quads.push(quad);
      }
      expect(quads.length).toBe(2);
    });

    it('substitutes template variables in query', async () => {
      const fetcher = new SparqlEndpointFetcher();
      const querySpy = vi.spyOn(fetcher, 'fetchTriples');

      const executor = new SparqlConstructExecutor({
        query: `CONSTRUCT {
          ?dataset ?p ?o .
        }
        #namedGraph#
        WHERE {
          #subjectFilter# ?p ?o .
        }`,
        fetcher,
      });

      const distribution = Distribution.sparql(
        new URL(`http://localhost:${port}/sparql`),
        'http://foo.org/id/graph/foo'
      );
      distribution.subjectFilter = '<http://example.org/foo>';

      const datasetIri = 'http://foo.org/id/dataset/foo';
      const dataset = new Dataset({
        iri: new URL(datasetIri),
        distributions: [distribution],
      });

      await executor.execute(dataset);

      const expectedQuery = `CONSTRUCT {
          <${datasetIri}> ?p ?o .
        }
        FROM <http://foo.org/id/graph/foo>
        WHERE {
          <http://example.org/foo> ?p ?o .
        }`;
      expect(querySpy).toHaveBeenCalledWith(
        `http://localhost:${port}/sparql`,
        expect.stringContaining(expectedQuery)
      );
    });

    it('uses dataset subjectFilter when distribution has none', async () => {
      const fetcher = new SparqlEndpointFetcher();
      const querySpy = vi.spyOn(fetcher, 'fetchTriples');

      const executor = new SparqlConstructExecutor({
        query: `CONSTRUCT { ?s ?p ?o } WHERE { #subjectFilter# ?p ?o }`,
        fetcher,
      });

      const distribution = Distribution.sparql(
        new URL(`http://localhost:${port}/sparql`)
      );
      // No subjectFilter on distribution

      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [distribution],
      });
      // Add subjectFilter at dataset level
      (dataset as { subjectFilter?: string }).subjectFilter =
        '<http://example.org/subject>';

      await executor.execute(dataset);

      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('<http://example.org/subject>')
      );
    });

    it('allows explicit endpoint override', async () => {
      const fetcher = new SparqlEndpointFetcher();
      const querySpy = vi.spyOn(fetcher, 'fetchTriples');

      const executor = new SparqlConstructExecutor({
        query: `CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1`,
        fetcher,
      });

      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [], // No distribution
      });

      // Provide explicit endpoint
      await executor.execute(dataset, {
        endpoint: new URL(`http://localhost:${port}/sparql`),
      });

      expect(querySpy).toHaveBeenCalledWith(
        `http://localhost:${port}/sparql`,
        expect.any(String)
      );
    });

    it('substitutes bindings before template variables', async () => {
      const fetcher = new SparqlEndpointFetcher();
      const querySpy = vi.spyOn(fetcher, 'fetchTriples');

      const executor = new SparqlConstructExecutor({
        query: `CONSTRUCT { <#class#> ?p ?o } WHERE { <#class#> ?p ?o }`,
        fetcher,
      });

      const distribution = Distribution.sparql(
        new URL(`http://localhost:${port}/sparql`)
      );

      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [distribution],
      });

      await executor.execute(dataset, {
        bindings: { '<#class#>': '<http://schema.org/Person>' },
      });

      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('<http://schema.org/Person>')
      );
      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.stringContaining('<#class#>')
      );
    });
  });

  describe('fromFile', () => {
    it('creates executor from a file', async () => {
      const executor = await SparqlConstructExecutor.fromFile(
        'test/fixtures/query.rq'
      );

      expect(executor).toBeInstanceOf(SparqlConstructExecutor);
    });
  });
});

describe('readQueryFile', () => {
  it('reads query from file', async () => {
    const query = await readQueryFile('test/fixtures/query.rq');

    expect(query).toContain('CONSTRUCT');
  });
});
