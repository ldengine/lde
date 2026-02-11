import {
  DatasetSourceResolver,
  ResolvedSource,
  NotAvailable,
} from '../../src/source/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import { ImportSuccessful, ImportFailed } from '@lde/sparql-importer';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('DatasetSourceResolver', () => {
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
      })
    );

    const resolver = new DatasetSourceResolver();
    const distribution = Distribution.sparql(
      new URL('http://example.org/sparql')
    );
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [distribution],
    });

    const result = await resolver.resolve(dataset);

    expect(result).toBeInstanceOf(ResolvedSource);
    expect((result as ResolvedSource).distribution).toBe(distribution);
  });

  it('uses importer when no SPARQL endpoint is available', async () => {
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

    const resolver = new DatasetSourceResolver({ importer: mockImporter });
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [
        new Distribution(
          new URL('http://example.org/data.nt'),
          'application/n-triples'
        ),
      ],
    });

    const result = await resolver.resolve(dataset);

    expect(result).toBeInstanceOf(ResolvedSource);
    expect(mockImporter.import).toHaveBeenCalledWith(dataset);
    const resolved = result as ResolvedSource;
    expect(resolved.distribution.accessUrl.toString()).toBe(
      'http://localhost:7878/sparql'
    );
  });

  it('returns NotAvailable when importer fails', async () => {
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

    const resolver = new DatasetSourceResolver({ importer: mockImporter });
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [
        new Distribution(
          new URL('http://example.org/data.nt'),
          'application/n-triples'
        ),
      ],
    });

    const result = await resolver.resolve(dataset);

    expect(result).toBeInstanceOf(NotAvailable);
  });

  it('returns NotAvailable when no endpoint and no importer', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Length': '1000' },
      })
    );

    const resolver = new DatasetSourceResolver();
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [
        new Distribution(
          new URL('http://example.org/data.nt'),
          'application/n-triples'
        ),
      ],
    });

    const result = await resolver.resolve(dataset);

    expect(result).toBeInstanceOf(NotAvailable);
  });

  it('returns NotAvailable on network error during probe', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));

    const resolver = new DatasetSourceResolver();
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [
        Distribution.sparql(new URL('http://example.org/sparql')),
      ],
    });

    const result = await resolver.resolve(dataset);

    expect(result).toBeInstanceOf(NotAvailable);
  });

  it('does not mutate dataset.distributions', async () => {
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
            Distribution.sparql(new URL('http://localhost:7878/sparql'))
          )
        ),
    };

    const resolver = new DatasetSourceResolver({ importer: mockImporter });
    const dataset = new Dataset({
      iri: new URL('http://example.org/dataset'),
      distributions: [
        new Distribution(
          new URL('http://example.org/data.nt'),
          'application/n-triples'
        ),
      ],
    });

    const originalLength = dataset.distributions.length;

    await resolver.resolve(dataset);

    expect(dataset.distributions.length).toBe(originalLength);
  });
});
