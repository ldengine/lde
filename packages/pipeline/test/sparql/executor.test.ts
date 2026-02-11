import {
  SparqlConstructExecutor,
  readQueryFile,
} from '../../src/sparql/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import {
  startSparqlEndpoint,
  teardownSparqlEndpoint,
} from '@lde/local-sparql-endpoint';
import { DataFactory } from 'n3';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const { namedNode } = DataFactory;

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

      const result = await executor.execute(dataset, distribution);

      const quads = [];
      for await (const quad of result) {
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

      await executor.execute(dataset, distribution);

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

      await executor.execute(dataset, distribution);

      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(`<${datasetIri}>`)
      );
      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.stringContaining('?dataset')
      );
    });

    it('uses distribution accessUrl as endpoint', async () => {
      const fetcher = new SparqlEndpointFetcher();
      const querySpy = vi.spyOn(fetcher, 'fetchTriples');

      const executor = new SparqlConstructExecutor({
        query: `CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1`,
        fetcher,
      });

      const distribution = Distribution.sparql(
        new URL(`http://localhost:${port}/sparql`)
      );

      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [distribution],
      });

      await executor.execute(dataset, distribution);

      expect(querySpy).toHaveBeenCalledWith(
        `http://localhost:${port}/sparql`,
        expect.any(String)
      );
    });
  });

  describe('bindings', () => {
    it('injects a VALUES clause when bindings are provided', async () => {
      const fetcher = new SparqlEndpointFetcher();
      const querySpy = vi.spyOn(fetcher, 'fetchTriples');

      const executor = new SparqlConstructExecutor({
        query: `CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }`,
        fetcher,
      });

      const distribution = Distribution.sparql(
        new URL(`http://localhost:${port}/sparql`)
      );

      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [distribution],
      });

      await executor.execute(dataset, distribution, {
        bindings: [{ s: namedNode('http://example.org/subject') }],
      });

      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('VALUES')
      );
      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('<http://example.org/subject>')
      );
    });

    it('does not inject a VALUES clause without bindings', async () => {
      const fetcher = new SparqlEndpointFetcher();
      const querySpy = vi.spyOn(fetcher, 'fetchTriples');

      const executor = new SparqlConstructExecutor({
        query: `CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }`,
        fetcher,
      });

      const distribution = Distribution.sparql(
        new URL(`http://localhost:${port}/sparql`)
      );

      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [distribution],
      });

      await executor.execute(dataset, distribution);

      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.stringContaining('VALUES')
      );
    });

    it('does not inject a VALUES clause when bindings array is empty', async () => {
      const fetcher = new SparqlEndpointFetcher();
      const querySpy = vi.spyOn(fetcher, 'fetchTriples');

      const executor = new SparqlConstructExecutor({
        query: `CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }`,
        fetcher,
      });

      const distribution = Distribution.sparql(
        new URL(`http://localhost:${port}/sparql`)
      );

      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [distribution],
      });

      await executor.execute(dataset, distribution, { bindings: [] });

      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.stringContaining('VALUES')
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
