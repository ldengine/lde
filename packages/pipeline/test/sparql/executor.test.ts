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
  const port = 3003;

  beforeAll(async () => {
    await startSparqlEndpoint(port, 'test/fixtures/analysisTarget.trig');
  }, 60_000);

  afterAll(async () => {
    await teardownSparqlEndpoint();
  });

  describe('constructor', () => {
    it('throws on a non-CONSTRUCT query', () => {
      expect(
        () =>
          new SparqlConstructExecutor({
            query: 'SELECT ?s WHERE { ?s ?p ?o }',
          })
      ).toThrow('Query must be a CONSTRUCT query');
    });
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

    it('adds FROM clause via withDefaultGraph when distribution has a named graph', async () => {
      const fetcher = new SparqlEndpointFetcher();
      const querySpy = vi.spyOn(fetcher, 'fetchTriples');

      const executor = new SparqlConstructExecutor({
        query: `CONSTRUCT {
          ?dataset ?p ?o .
        }
        WHERE {
          ?dataset ?p ?o .
        }`,
        fetcher,
      });

      const distribution = Distribution.sparql(
        new URL(`http://localhost:${port}/sparql`),
        'http://foo.org/id/graph/foo'
      );

      const datasetIri = 'http://foo.org/id/dataset/foo';
      const dataset = new Dataset({
        iri: new URL(datasetIri),
        distributions: [distribution],
      });

      await executor.execute(dataset);

      expect(querySpy).toHaveBeenCalledWith(
        `http://localhost:${port}/sparql`,
        expect.stringContaining('FROM <http://foo.org/id/graph/foo>')
      );
    });

    it('substitutes ?dataset with dataset IRI', async () => {
      const fetcher = new SparqlEndpointFetcher();
      const querySpy = vi.spyOn(fetcher, 'fetchTriples');

      const executor = new SparqlConstructExecutor({
        query: `CONSTRUCT { ?dataset ?p ?o } WHERE { ?dataset ?p ?o }`,
        fetcher,
      });

      const distribution = Distribution.sparql(
        new URL(`http://localhost:${port}/sparql`)
      );

      const datasetIri = 'http://foo.org/id/dataset/foo';
      const dataset = new Dataset({
        iri: new URL(datasetIri),
        distributions: [distribution],
      });

      await executor.execute(dataset);

      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(`<${datasetIri}>`)
      );
      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.stringContaining('?dataset')
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
