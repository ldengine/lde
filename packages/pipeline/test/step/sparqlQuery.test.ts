import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NotSupported, SparqlQuery } from '../../src/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import {
  startSparqlEndpoint,
  teardownSparqlEndpoint,
} from '@lde/local-sparql-endpoint';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';

describe('SparqlQuery', () => {
  const port = 3001;
  beforeAll(async () => {
    await startSparqlEndpoint(port, 'test/fixtures/analysisTarget.trig');
  }, 60_000);

  afterAll(async () => {
    await teardownSparqlEndpoint();
  });

  describe('fromFile', () => {
    it('creates a new SparqlQuery from a file', async () => {
      const sparqlQuery = await SparqlQuery.fromFile('test/fixtures/query.rq');

      expect(sparqlQuery).toBeInstanceOf(SparqlQuery);
      expect(sparqlQuery.identifier).toBe('test/fixtures/query.rq');
    });
  });

  describe('execute', () => {
    it('should return a NotSupported when no SPARQL distribution is available', async () => {
      const sparqlQuery = new SparqlQuery({
        identifier: 'foo',
        query: 'bar',
      });
      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [],
      });

      const result = await sparqlQuery.execute(dataset);

      expect(result).toBeInstanceOf(NotSupported);
    });

    it('should apply named graph and subject filter in SPARQL query', async () => {
      const fetcher = new SparqlEndpointFetcher();
      const querySpy = vi.spyOn(fetcher, 'fetchTriples');

      const sparqlQuery = new SparqlQuery({
        identifier: 'foo',
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

      await sparqlQuery.execute(dataset);

      expect(querySpy).toHaveBeenCalledWith(
        `http://localhost:${port}/sparql`,
        expect.stringContaining(`<${datasetIri}>`)
      );
      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('FROM <http://foo.org/id/graph/foo>')
      );
      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('<http://example.org/foo>')
      );
    });

    it('should return results of SPARQL query', async () => {
      const datasetIri = 'http://foo.org/id/dataset/foo';

      const sparqlQuery = new SparqlQuery({
        identifier: 'foo',
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

      const result = await sparqlQuery.execute(dataset);
      expect(result).not.toBeInstanceOf(NotSupported);

      const statements = [];
      for await (const statement of result as Exclude<
        typeof result,
        NotSupported
      >) {
        statements.push(statement);
      }
      expect(statements.length).toBe(2);
    });
  });
});
