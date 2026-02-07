import {
  DistributionAnalyzer,
  NoDistributionAvailable,
  ImportSuccessful,
  ImportFailed,
} from '../../src/distribution/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Store } from 'n3';

describe('DistributionAnalyzer', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('execute', () => {
    it('probes all distributions and returns RDF', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/sparql-results+json' },
        })
      );

      const analyzer = new DistributionAnalyzer();
      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [
          Distribution.sparql(new URL('http://example.org/sparql')),
        ],
      });

      const result = await analyzer.execute(dataset);

      expect(result).toBeInstanceOf(Store);
      const store = result as Store;
      expect(store.size).toBeGreaterThan(0);

      // Check for schema:Action triple
      const actions = store.getQuads(
        null,
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'https://schema.org/Action',
        null
      );
      expect(actions.length).toBe(1);
    });

    it('returns NoDistributionAvailable when no SPARQL endpoint found', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('', {
          status: 404,
          statusText: 'Not Found',
        })
      );

      const analyzer = new DistributionAnalyzer();
      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [
          Distribution.sparql(new URL('http://example.org/sparql')),
        ],
      });

      const result = await analyzer.execute(dataset);

      expect(result).toBeInstanceOf(NoDistributionAvailable);
    });

    it('records void:sparqlEndpoint for successful SPARQL probe', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/sparql-results+json' },
        })
      );

      const analyzer = new DistributionAnalyzer();
      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [
          Distribution.sparql(new URL('http://example.org/sparql')),
        ],
      });

      const result = await analyzer.execute(dataset);

      expect(result).toBeInstanceOf(Store);
      const store = result as Store;
      const sparqlEndpoints = store.getQuads(
        'http://example.org/dataset',
        'http://rdfs.org/ns/void#sparqlEndpoint',
        null,
        null
      );
      expect(sparqlEndpoints.length).toBe(1);
      expect(sparqlEndpoints[0].object.value).toBe('http://example.org/sparql');
    });

    it('records void:dataDump for successful data dump probe', async () => {
      // First call for the data dump (returns success)
      vi.mocked(fetch).mockResolvedValue(
        new Response('', {
          status: 200,
          headers: {
            'Content-Type': 'application/n-triples',
            'Content-Length': '1000',
          },
        })
      );

      const mockImporter = {
        import: vi
          .fn()
          .mockResolvedValue(
            new ImportSuccessful(
              Distribution.sparql(new URL('http://example.org/imported-sparql'))
            )
          ),
      };

      const analyzer = new DistributionAnalyzer({ importer: mockImporter });
      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [
          new Distribution(
            new URL('http://example.org/data.nt'),
            'application/n-triples'
          ),
        ],
      });

      const result = await analyzer.execute(dataset);

      expect(result).toBeInstanceOf(Store);
      const store = result as Store;
      const dataDumps = store.getQuads(
        'http://example.org/dataset',
        'http://rdfs.org/ns/void#dataDump',
        null,
        null
      );
      expect(dataDumps.length).toBe(1);
    });

    it('uses importer when no SPARQL endpoint available', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('', {
          status: 200,
          headers: { 'Content-Length': '1000' },
        })
      );

      const mockImporter = {
        import: vi
          .fn()
          .mockResolvedValue(
            new ImportSuccessful(
              Distribution.sparql(new URL('http://localhost:7878/sparql')),
              'test-graph'
            )
          ),
      };

      const analyzer = new DistributionAnalyzer({ importer: mockImporter });
      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [
          new Distribution(
            new URL('http://example.org/data.nt'),
            'application/n-triples'
          ),
        ],
      });

      await analyzer.execute(dataset);

      expect(mockImporter.import).toHaveBeenCalledWith(dataset);
      // Check that SPARQL distribution was added
      expect(dataset.getSparqlDistribution()).not.toBeNull();
    });

    it('records import error in store', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('', {
          status: 200,
          headers: { 'Content-Length': '1000' },
        })
      );

      const mockImporter = {
        import: vi
          .fn()
          .mockResolvedValue(
            new ImportFailed(
              new Distribution(
                new URL('http://example.org/data.nt'),
                'application/n-triples'
              ),
              'Parse error'
            )
          ),
      };

      const analyzer = new DistributionAnalyzer({ importer: mockImporter });
      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [
          new Distribution(
            new URL('http://example.org/data.nt'),
            'application/n-triples'
          ),
        ],
      });

      const result = await analyzer.execute(dataset);

      // Should return NoDistributionAvailable since import failed
      expect(result).toBeInstanceOf(NoDistributionAvailable);
    });
  });

  describe('finish', () => {
    it('calls importer finish', async () => {
      const mockImporter = {
        import: vi.fn(),
        finish: vi.fn().mockResolvedValue(undefined),
      };

      const analyzer = new DistributionAnalyzer({ importer: mockImporter });
      await analyzer.finish();

      expect(mockImporter.finish).toHaveBeenCalled();
    });
  });
});
