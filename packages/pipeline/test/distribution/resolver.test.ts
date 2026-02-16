import {
  SparqlDistributionResolver,
  ResolvedDistribution,
  NoDistributionAvailable,
  SparqlProbeResult,
  DataDumpProbeResult,
  NetworkError,
} from '../../src/distribution/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import { ImportSuccessful, ImportFailed } from '@lde/sparql-importer';
import type { SparqlServer } from '@lde/sparql-server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('SparqlDistributionResolver', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves to a valid SPARQL endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/sparql-results+json' },
      }),
    );

    const resolver = new SparqlDistributionResolver();
    const distribution = Distribution.sparql(
      new URL('http://example.org/sparql'),
    );
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [distribution],
    });

    const result = await resolver.resolve(dataset);

    expect(result).toBeInstanceOf(ResolvedDistribution);
    const resolved = result as ResolvedDistribution;
    expect(resolved.distribution).toBe(distribution);
    expect(resolved.probeResults).toHaveLength(1);
    expect(resolved.probeResults[0]).toBeInstanceOf(SparqlProbeResult);
  });

  it('uses importer when no SPARQL endpoint is available', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Length': '1000' },
      }),
    );

    const mockImporter = {
      import: vi
        .fn()
        .mockResolvedValue(
          new ImportSuccessful(
            Distribution.sparql(new URL('http://localhost:7878/sparql')),
            'test-graph',
          ),
        ),
    };

    const resolver = new SparqlDistributionResolver({
      importer: mockImporter,
    });
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [
        new Distribution(
          new URL('http://example.org/data.nt'),
          'application/n-triples',
        ),
      ],
    });

    const result = await resolver.resolve(dataset);

    expect(result).toBeInstanceOf(ResolvedDistribution);
    expect(mockImporter.import).toHaveBeenCalledWith(dataset);
    const resolved = result as ResolvedDistribution;
    expect(resolved.distribution.accessUrl.toString()).toBe(
      'http://localhost:7878/sparql',
    );
    expect(resolved.probeResults).toHaveLength(1);
    expect(resolved.probeResults[0]).toBeInstanceOf(DataDumpProbeResult);
  });

  it('returns NoDistributionAvailable when importer fails', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Length': '1000' },
      }),
    );

    const mockImporter = {
      import: vi
        .fn()
        .mockResolvedValue(
          new ImportFailed(
            new Distribution(
              new URL('http://example.org/data.nt'),
              'application/n-triples',
            ),
            'Parse error',
          ),
        ),
    };

    const resolver = new SparqlDistributionResolver({
      importer: mockImporter,
    });
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [
        new Distribution(
          new URL('http://example.org/data.nt'),
          'application/n-triples',
        ),
      ],
    });

    const result = await resolver.resolve(dataset);

    expect(result).toBeInstanceOf(NoDistributionAvailable);
    const noDistribution = result as NoDistributionAvailable;
    expect(noDistribution.probeResults).toHaveLength(1);
    expect(noDistribution.probeResults[0]).toBeInstanceOf(DataDumpProbeResult);
    expect(noDistribution.importFailed).toBeInstanceOf(ImportFailed);
    expect(noDistribution.importFailed!.error).toBe('Parse error');
  });

  it('returns NoDistributionAvailable when no endpoint and no importer', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Length': '1000' },
      }),
    );

    const resolver = new SparqlDistributionResolver();
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [
        new Distribution(
          new URL('http://example.org/data.nt'),
          'application/n-triples',
        ),
      ],
    });

    const result = await resolver.resolve(dataset);

    expect(result).toBeInstanceOf(NoDistributionAvailable);
    const noDistribution = result as NoDistributionAvailable;
    expect(noDistribution.probeResults).toHaveLength(1);
    expect(noDistribution.probeResults[0]).toBeInstanceOf(DataDumpProbeResult);
    expect(noDistribution.importFailed).toBeUndefined();
  });

  it('returns NoDistributionAvailable on network error during probe', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));

    const resolver = new SparqlDistributionResolver();
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [
        Distribution.sparql(new URL('http://example.org/sparql')),
      ],
    });

    const result = await resolver.resolve(dataset);

    expect(result).toBeInstanceOf(NoDistributionAvailable);
    const noDistribution = result as NoDistributionAvailable;
    expect(noDistribution.probeResults).toHaveLength(1);
    expect(noDistribution.probeResults[0]).toBeInstanceOf(NetworkError);
  });

  it('does not mutate dataset.distributions', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Length': '1000' },
      }),
    );

    const mockImporter = {
      import: vi
        .fn()
        .mockResolvedValue(
          new ImportSuccessful(
            Distribution.sparql(new URL('http://localhost:7878/sparql')),
          ),
        ),
    };

    const resolver = new SparqlDistributionResolver({
      importer: mockImporter,
    });
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [
        new Distribution(
          new URL('http://example.org/data.nt'),
          'application/n-triples',
        ),
      ],
    });

    const originalLength = dataset.distributions.length;

    await resolver.resolve(dataset);

    expect(dataset.distributions.length).toBe(originalLength);
  });

  describe('server integration', () => {
    function makeServer(): SparqlServer & {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    } {
      return {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        queryEndpoint: new URL('http://localhost:7001/sparql'),
      };
    }

    it('starts server after import and uses its endpoint', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('', {
          status: 200,
          headers: { 'Content-Length': '1000' },
        }),
      );

      const mockImporter = {
        import: vi
          .fn()
          .mockResolvedValue(
            new ImportSuccessful(
              Distribution.sparql(new URL('http://localhost:7878/sparql')),
              'test-graph',
            ),
          ),
      };

      const server = makeServer();

      const resolver = new SparqlDistributionResolver({
        importer: mockImporter,
        server,
      });
      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [
          new Distribution(
            new URL('http://example.org/data.nt'),
            'application/n-triples',
          ),
        ],
      });

      const result = await resolver.resolve(dataset);

      expect(result).toBeInstanceOf(ResolvedDistribution);
      expect(server.start).toHaveBeenCalled();
      const resolved = result as ResolvedDistribution;
      expect(resolved.distribution.accessUrl.toString()).toBe(
        'http://localhost:7001/sparql',
      );
    });

    it('does not start server when SPARQL endpoint is already available', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/sparql-results+json' },
        }),
      );

      const server = makeServer();

      const resolver = new SparqlDistributionResolver({ server });
      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [
          Distribution.sparql(new URL('http://example.org/sparql')),
        ],
      });

      await resolver.resolve(dataset);

      expect(server.start).not.toHaveBeenCalled();
    });

    it('cleanup stops a started server', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('', {
          status: 200,
          headers: { 'Content-Length': '1000' },
        }),
      );

      const mockImporter = {
        import: vi
          .fn()
          .mockResolvedValue(
            new ImportSuccessful(
              Distribution.sparql(new URL('http://localhost:7878/sparql')),
            ),
          ),
      };

      const server = makeServer();

      const resolver = new SparqlDistributionResolver({
        importer: mockImporter,
        server,
      });
      const dataset = new Dataset({
        iri: new URL('http://example.org/dataset'),
        distributions: [
          new Distribution(
            new URL('http://example.org/data.nt'),
            'application/n-triples',
          ),
        ],
      });

      await resolver.resolve(dataset);
      await resolver.cleanup();

      expect(server.stop).toHaveBeenCalled();
    });

    it('cleanup is a no-op when no server is configured', async () => {
      const resolver = new SparqlDistributionResolver();

      await expect(resolver.cleanup()).resolves.toBeUndefined();
    });
  });
});
