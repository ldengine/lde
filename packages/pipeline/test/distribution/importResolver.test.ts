import {
  ImportResolver,
  ResolvedDistribution,
  NoDistributionAvailable,
  DataDumpProbeResult,
  type DistributionResolver,
} from '../../src/distribution/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import { ImportSuccessful, ImportFailed } from '@lde/sparql-importer';
import type { SparqlServer } from '@lde/sparql-server';
import { describe, it, expect, vi } from 'vitest';

const dataDumpProbeResult = new DataDumpProbeResult(
  'http://example.org/data.nt',
  new Response('', {
    status: 200,
    headers: {
      'Content-Length': '1000',
      'Content-Type': 'application/n-triples',
    },
  }),
);

function makeDataset(): Dataset {
  return new Dataset({
    iri: new URL('http://example.org/dataset'),
    distributions: [
      new Distribution(
        new URL('http://example.org/data.nt'),
        'application/n-triples',
      ),
    ],
  });
}

function makeInnerResolver(
  result: ResolvedDistribution | NoDistributionAvailable,
): DistributionResolver {
  return { resolve: vi.fn().mockResolvedValue(result) };
}

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

describe('ImportResolver', () => {
  it('returns inner result when it is a ResolvedDistribution', async () => {
    const distribution = Distribution.sparql(
      new URL('http://example.org/sparql'),
    );
    const resolved = new ResolvedDistribution(distribution, []);
    const inner = makeInnerResolver(resolved);
    const mockImporter = { import: vi.fn() };

    const resolver = new ImportResolver(inner, { importer: mockImporter });
    const result = await resolver.resolve(makeDataset());

    expect(result).toBe(resolved);
    expect(mockImporter.import).not.toHaveBeenCalled();
  });

  it('falls back to import when inner resolver returns NoDistributionAvailable', async () => {
    const dataset = makeDataset();
    const inner = makeInnerResolver(
      new NoDistributionAvailable(dataset, 'No endpoint', [
        dataDumpProbeResult,
      ]),
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

    const resolver = new ImportResolver(inner, { importer: mockImporter });
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

  it('returns NoDistributionAvailable with importFailed when import fails', async () => {
    const dataset = makeDataset();
    const inner = makeInnerResolver(
      new NoDistributionAvailable(dataset, 'No endpoint', [
        dataDumpProbeResult,
      ]),
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

    const resolver = new ImportResolver(inner, { importer: mockImporter });
    const result = await resolver.resolve(dataset);

    expect(result).toBeInstanceOf(NoDistributionAvailable);
    const noDistribution = result as NoDistributionAvailable;
    expect(noDistribution.importFailed).toBeInstanceOf(ImportFailed);
    expect(noDistribution.importFailed!.error).toBe('Parse error');
    expect(noDistribution.probeResults).toHaveLength(1);
  });

  describe('server integration', () => {
    it('starts server after import and uses its endpoint', async () => {
      const dataset = makeDataset();
      const inner = makeInnerResolver(
        new NoDistributionAvailable(dataset, 'No endpoint', [
          dataDumpProbeResult,
        ]),
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

      const resolver = new ImportResolver(inner, {
        importer: mockImporter,
        server,
      });
      const result = await resolver.resolve(dataset);

      expect(result).toBeInstanceOf(ResolvedDistribution);
      expect(server.start).toHaveBeenCalled();
      const resolved = result as ResolvedDistribution;
      expect(resolved.distribution.accessUrl.toString()).toBe(
        'http://localhost:7001/sparql',
      );
    });

    it('does not start server when inner resolver succeeds', async () => {
      const distribution = Distribution.sparql(
        new URL('http://example.org/sparql'),
      );
      const resolved = new ResolvedDistribution(distribution, []);
      const inner = makeInnerResolver(resolved);
      const mockImporter = { import: vi.fn() };
      const server = makeServer();

      const resolver = new ImportResolver(inner, {
        importer: mockImporter,
        server,
      });
      await resolver.resolve(makeDataset());

      expect(server.start).not.toHaveBeenCalled();
    });

    it('cleanup stops server', async () => {
      const server = makeServer();
      const resolver = new ImportResolver(
        makeInnerResolver(
          new ResolvedDistribution(
            Distribution.sparql(new URL('http://example.org/sparql')),
            [],
          ),
        ),
        { importer: { import: vi.fn() }, server },
      );

      await resolver.cleanup();

      expect(server.stop).toHaveBeenCalled();
    });

    it('cleanup is a no-op when no server', async () => {
      const resolver = new ImportResolver(
        makeInnerResolver(
          new ResolvedDistribution(
            Distribution.sparql(new URL('http://example.org/sparql')),
            [],
          ),
        ),
        { importer: { import: vi.fn() } },
      );

      await expect(resolver.cleanup()).resolves.toBeUndefined();
    });
  });
});
