import { SparqlUpdateWriter } from '../src/sparqlUpdateWriter.js';
import { Dataset, Distribution } from '@lde/dataset';
import { Store, DataFactory } from 'n3';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { namedNode, literal } = DataFactory;

describe('SparqlUpdateWriter', () => {
  const endpoint = new URL('http://example.com/sparql');
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
    });
  });

  function createDataset(iri: string): Dataset {
    return new Dataset({
      iri: new URL(iri),
      distributions: [
        Distribution.sparql(new URL('http://example.com/sparql')),
      ],
    });
  }

  function createStore(): Store {
    return new Store();
  }

  describe('write', () => {
    it('writes quads to SPARQL endpoint', async () => {
      const writer = new SparqlUpdateWriter({
        endpoint,
        fetch: mockFetch,
      });

      const dataset = createDataset('http://example.com/dataset/1');
      const data = createStore();
      data.addQuad(
        namedNode('http://example.com/subject'),
        namedNode('http://example.com/predicate'),
        literal('object')
      );

      await writer.write(dataset, data);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        endpoint.toString(),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/sparql-update' },
        })
      );

      const body = mockFetch.mock.calls[0][1].body as string;
      expect(body).toContain('INSERT DATA');
      expect(body).toContain('GRAPH <http://example.com/dataset/1>');
      expect(body).toContain('<http://example.com/subject>');
      expect(body).toContain('<http://example.com/predicate>');
      expect(body).toContain('"object"');
    });

    it('does not make request for empty data', async () => {
      const writer = new SparqlUpdateWriter({
        endpoint,
        fetch: mockFetch,
      });

      const dataset = createDataset('http://example.com/dataset/1');
      const data = createStore();

      await writer.write(dataset, data);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('batches large datasets', async () => {
      const writer = new SparqlUpdateWriter({
        endpoint,
        fetch: mockFetch,
        batchSize: 2,
      });

      const dataset = createDataset('http://example.com/dataset/1');
      const data = createStore();
      data.addQuad(
        namedNode('http://example.com/s1'),
        namedNode('http://example.com/p'),
        literal('o1')
      );
      data.addQuad(
        namedNode('http://example.com/s2'),
        namedNode('http://example.com/p'),
        literal('o2')
      );
      data.addQuad(
        namedNode('http://example.com/s3'),
        namedNode('http://example.com/p'),
        literal('o3')
      );

      await writer.write(dataset, data);

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
        fetch: mockFetch,
      });

      const dataset = createDataset('http://example.com/dataset/1');
      const data = createStore();
      data.addQuad(
        namedNode('http://example.com/s'),
        namedNode('http://example.com/p'),
        literal('o')
      );

      await expect(writer.write(dataset, data)).rejects.toThrow(
        'SPARQL UPDATE failed with status 500'
      );
    });
  });
});
