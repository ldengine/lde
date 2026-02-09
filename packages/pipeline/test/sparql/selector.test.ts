import { SparqlSelector } from '../../src/sparql/selector.js';
import type { StageSelector, StageSelectorBindings } from '../../src/stage.js';
import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { DataFactory } from 'n3';

const { namedNode, literal, blankNode } = DataFactory;

function bindingsStream(
  records: Record<string, { termType: string; value: string }>[]
): Promise<Readable> {
  const stream = new Readable({
    objectMode: true,
    read() {
      /* no-op */
    },
  });
  for (const record of records) {
    stream.push(record);
  }
  stream.push(null);
  return Promise.resolve(stream);
}

describe('SparqlSelector', () => {
  const endpoint = new URL('http://example.com/sparql');
  const query = 'SELECT ?uri WHERE { ?uri a <http://example.com/Class> }';

  it('yields all bindings when results are fewer than pageSize', async () => {
    const mockFetcher = {
      fetchBindings: vi
        .fn()
        .mockImplementation(() =>
          bindingsStream([
            { uri: namedNode('http://example.com/1') },
            { uri: namedNode('http://example.com/2') },
          ])
        ),
    };

    const selector = new SparqlSelector({
      query,
      endpoint,
      pageSize: 10,
      fetcher: mockFetcher as never,
    });

    const rows: StageSelectorBindings[] = [];
    for await (const row of selector) {
      rows.push(row);
    }

    expect(rows).toHaveLength(2);
    expect(rows[0].uri.value).toBe('http://example.com/1');
    expect(rows[1].uri.value).toBe('http://example.com/2');
  });

  it('paginates with correct OFFSET increments', async () => {
    const queries: string[] = [];
    const mockFetcher = {
      fetchBindings: vi
        .fn()
        .mockImplementation((_endpoint: string, q: string) => {
          queries.push(q);
          if (queries.length === 1) {
            return bindingsStream([
              { uri: namedNode('http://example.com/1') },
              { uri: namedNode('http://example.com/2') },
            ]);
          }
          return bindingsStream([{ uri: namedNode('http://example.com/3') }]);
        }),
    };

    const selector = new SparqlSelector({
      query,
      endpoint,
      pageSize: 2,
      fetcher: mockFetcher as never,
    });

    const rows: StageSelectorBindings[] = [];
    for await (const row of selector) {
      rows.push(row);
    }

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.uri.value)).toEqual([
      'http://example.com/1',
      'http://example.com/2',
      'http://example.com/3',
    ]);

    expect(queries[0]).toMatch(/LIMIT\s+2/);
    // sparqljs omits OFFSET 0 (the default).
    expect(queries[0]).not.toMatch(/OFFSET/);
    expect(queries[1]).toMatch(/LIMIT\s+2/);
    expect(queries[1]).toMatch(/OFFSET\s+2/);
  });

  it('yields nothing for empty results', async () => {
    const mockFetcher = {
      fetchBindings: vi.fn().mockImplementation(() => bindingsStream([])),
    };

    const selector = new SparqlSelector({
      query,
      endpoint,
      fetcher: mockFetcher as never,
    });

    const rows: unknown[] = [];
    for await (const row of selector) {
      rows.push(row);
    }

    expect(rows).toHaveLength(0);
  });

  it('respects custom pageSize in LIMIT clause', async () => {
    const queries: string[] = [];
    const mockFetcher = {
      fetchBindings: vi
        .fn()
        .mockImplementation((_endpoint: string, q: string) => {
          queries.push(q);
          return bindingsStream([{ uri: namedNode('http://example.com/1') }]);
        }),
    };

    const selector = new SparqlSelector({
      query,
      endpoint,
      pageSize: 50,
      fetcher: mockFetcher as never,
    });

    for await (const _row of selector) {
      // consume
    }

    expect(queries[0]).toMatch(/LIMIT\s+50/);
  });

  it('skips rows where all projected variables are non-NamedNode', async () => {
    const mockFetcher = {
      fetchBindings: vi
        .fn()
        .mockImplementation(() =>
          bindingsStream([
            { uri: namedNode('http://example.com/1') },
            { uri: literal('not a URI') },
            { uri: blankNode('b0') },
            { uri: namedNode('http://example.com/2') },
          ])
        ),
    };

    const selector = new SparqlSelector({
      query,
      endpoint,
      pageSize: 10,
      fetcher: mockFetcher as never,
    });

    const rows: StageSelectorBindings[] = [];
    for await (const row of selector) {
      rows.push(row);
    }

    expect(rows).toHaveLength(2);
    expect(rows[0].uri.value).toBe('http://example.com/1');
    expect(rows[1].uri.value).toBe('http://example.com/2');
  });

  it('defaults pageSize to 10', async () => {
    const queries: string[] = [];
    const mockFetcher = {
      fetchBindings: vi
        .fn()
        .mockImplementation((_endpoint: string, q: string) => {
          queries.push(q);
          return bindingsStream([]);
        }),
    };

    const selector = new SparqlSelector({
      query,
      endpoint,
      fetcher: mockFetcher as never,
    });

    for await (const _row of selector) {
      // consume
    }

    expect(queries[0]).toMatch(/LIMIT\s+10/);
  });

  it('uses query LIMIT as default pageSize', async () => {
    const queries: string[] = [];
    const mockFetcher = {
      fetchBindings: vi
        .fn()
        .mockImplementation((_endpoint: string, q: string) => {
          queries.push(q);
          return bindingsStream([{ class: namedNode('http://example.com/a') }]);
        }),
    };

    const selector = new SparqlSelector({
      query: 'SELECT ?class WHERE { ?s a ?class } LIMIT 25',
      endpoint,
      fetcher: mockFetcher as never,
    });

    for await (const _row of selector) {
      // consume
    }

    // Query LIMIT 25 becomes the pageSize.
    expect(queries[0]).toMatch(/LIMIT\s+25/);
  });

  it('pageSize option overrides query LIMIT', async () => {
    const queries: string[] = [];
    const mockFetcher = {
      fetchBindings: vi
        .fn()
        .mockImplementation((_endpoint: string, q: string) => {
          queries.push(q);
          return bindingsStream([{ class: namedNode('http://example.com/a') }]);
        }),
    };

    const selector = new SparqlSelector({
      query: 'SELECT ?class WHERE { ?s a ?class } LIMIT 25',
      endpoint,
      pageSize: 5,
      fetcher: mockFetcher as never,
    });

    for await (const _row of selector) {
      // consume
    }

    // Explicit pageSize overrides query LIMIT.
    expect(queries[0]).toMatch(/LIMIT\s+5/);
  });

  it('collects all projected variables per row', async () => {
    const mockFetcher = {
      fetchBindings: vi.fn().mockImplementation(() =>
        bindingsStream([
          {
            class: namedNode('http://example.com/Person'),
            property: namedNode('http://example.com/name'),
          },
        ])
      ),
    };

    const selector = new SparqlSelector({
      query: 'SELECT ?class ?property WHERE { ?s a ?class ; ?property ?o }',
      endpoint,
      fetcher: mockFetcher as never,
    });

    const rows: StageSelectorBindings[] = [];
    for await (const row of selector) {
      rows.push(row);
    }

    expect(rows[0].class.value).toBe('http://example.com/Person');
    expect(rows[0].property.value).toBe('http://example.com/name');
  });

  it('includes row when at least one variable is a NamedNode', async () => {
    const mockFetcher = {
      fetchBindings: vi.fn().mockImplementation(() =>
        bindingsStream([
          {
            class: namedNode('http://example.com/Person'),
            label: literal('Person'),
          },
        ])
      ),
    };

    const selector = new SparqlSelector({
      query:
        'SELECT ?class ?label WHERE { ?s a ?class ; <http://www.w3.org/2000/01/rdf-schema#label> ?label }',
      endpoint,
      fetcher: mockFetcher as never,
    });

    const rows: StageSelectorBindings[] = [];
    for await (const row of selector) {
      rows.push(row);
    }

    // Row is included because ?class is a NamedNode; ?label (literal) is omitted.
    expect(rows).toHaveLength(1);
    expect(rows[0].class.value).toBe('http://example.com/Person');
    expect(rows[0].label).toBeUndefined();
  });

  it('throws on non-SELECT queries', () => {
    expect(
      () =>
        new SparqlSelector({
          query: 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
          endpoint,
        })
    ).toThrow('Query must be a SELECT query');
  });

  it('throws on SELECT * queries', () => {
    expect(
      () =>
        new SparqlSelector({
          query: 'SELECT * WHERE { ?s ?p ?o }',
          endpoint,
        })
    ).toThrow('SELECT * is not supported');
  });

  it('is assignable to StageSelector', async () => {
    const mockFetcher = {
      fetchBindings: vi
        .fn()
        .mockImplementation(() =>
          bindingsStream([{ uri: namedNode('http://example.com/1') }])
        ),
    };

    // Verify SparqlSelector satisfies StageSelector.
    const selector: StageSelector = new SparqlSelector({
      query,
      endpoint,
      fetcher: mockFetcher as never,
    });

    const rows: StageSelectorBindings[] = [];
    for await (const row of selector) {
      rows.push(row);
    }

    expect(rows).toHaveLength(1);
  });
});
