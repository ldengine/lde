import { SparqlUpdateWriter } from '../../src/writer/sparqlUpdateWriter.js';
import { Dataset, Distribution } from '@lde/dataset';
import { DataFactory } from 'n3';
import type { Quad } from '@rdfjs/types';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { namedNode, literal, quad } = DataFactory;

async function* quadsOf(...quads: Quad[]): AsyncIterable<Quad> {
  yield* quads;
}

describe('SparqlUpdateWriter', () => {
  const endpoint = new URL('http://example.com/sparql');
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
    } as Partial<Response>);
  });

  function createDataset(iri: string): Dataset {
    return new Dataset({
      iri: new URL(iri),
      distributions: [
        Distribution.sparql(new URL('http://example.com/sparql')),
      ],
    });
  }

  describe('write', () => {
    it('writes quads to SPARQL endpoint', async () => {
      const writer = new SparqlUpdateWriter({
        endpoint,
        fetch: mockFetch as typeof globalThis.fetch,
      });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/subject'),
            namedNode('http://example.com/predicate'),
            literal('object')
          )
        )
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        endpoint.toString(),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/sparql-update' },
        })
      );

      const body = mockFetch.mock.calls[0]![1]!.body as string;
      expect(body).toContain('INSERT DATA');
      expect(body).toContain('GRAPH <http://example.com/dataset/1>');
      expect(body).toContain('<http://example.com/subject>');
      expect(body).toContain('<http://example.com/predicate>');
      expect(body).toContain('"object"');
    });

    it('does not make request for empty data', async () => {
      const writer = new SparqlUpdateWriter({
        endpoint,
        fetch: mockFetch as typeof globalThis.fetch,
      });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(dataset, quadsOf());

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('batches large datasets', async () => {
      const writer = new SparqlUpdateWriter({
        endpoint,
        fetch: mockFetch as typeof globalThis.fetch,
        batchSize: 2,
      });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/s1'),
            namedNode('http://example.com/p'),
            literal('o1')
          ),
          quad(
            namedNode('http://example.com/s2'),
            namedNode('http://example.com/p'),
            literal('o2')
          ),
          quad(
            namedNode('http://example.com/s3'),
            namedNode('http://example.com/p'),
            literal('o3')
          )
        )
      );

      // Should make 2 requests: 2 quads + 1 quad.
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const writer = new SparqlUpdateWriter({
        endpoint,
        fetch: mockFetch as typeof globalThis.fetch,
      });

      const dataset = createDataset('http://example.com/dataset/1');

      await expect(
        writer.write(
          dataset,
          quadsOf(
            quad(
              namedNode('http://example.com/s'),
              namedNode('http://example.com/p'),
              literal('o')
            )
          )
        )
      ).rejects.toThrow('SPARQL UPDATE failed with status 500');
    });
  });
});
