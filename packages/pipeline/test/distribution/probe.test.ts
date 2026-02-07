import {
  probe,
  SparqlProbeResult,
  DataDumpProbeResult,
  NetworkError,
} from '../../src/distribution/index.js';
import { Distribution } from '@lde/dataset';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('probe', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('SPARQL endpoint', () => {
    it('returns SparqlProbeResult on successful probe', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/sparql-results+json' },
        })
      );

      const distribution = Distribution.sparql(
        new URL('http://example.org/sparql')
      );

      const result = await probe(distribution);

      expect(result).toBeInstanceOf(SparqlProbeResult);
      expect((result as SparqlProbeResult).isSuccess()).toBe(true);
      expect(distribution.isValid).toBe(true);
    });

    it('returns unsuccessful SparqlProbeResult on wrong content type', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('<html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      );

      const distribution = Distribution.sparql(
        new URL('http://example.org/sparql')
      );

      const result = await probe(distribution);

      expect(result).toBeInstanceOf(SparqlProbeResult);
      expect((result as SparqlProbeResult).isSuccess()).toBe(false);
      expect(distribution.isValid).toBe(false);
    });

    it('returns unsuccessful SparqlProbeResult on HTTP error', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('', {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      const distribution = Distribution.sparql(
        new URL('http://example.org/sparql')
      );

      const result = await probe(distribution);

      expect(result).toBeInstanceOf(SparqlProbeResult);
      expect((result as SparqlProbeResult).isSuccess()).toBe(false);
      expect((result as SparqlProbeResult).statusCode).toBe(500);
    });
  });

  describe('data dump', () => {
    it('returns DataDumpProbeResult with metadata', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('', {
          status: 200,
          headers: {
            'Content-Type': 'application/n-triples',
            'Content-Length': '12345',
            'Last-Modified': 'Wed, 21 Oct 2020 07:28:00 GMT',
          },
        })
      );

      const distribution = new Distribution(
        new URL('http://example.org/data.nt'),
        'application/n-triples'
      );

      const result = await probe(distribution);

      expect(result).toBeInstanceOf(DataDumpProbeResult);
      const dumpResult = result as DataDumpProbeResult;
      expect(dumpResult.isSuccess()).toBe(true);
      expect(dumpResult.contentSize).toBe(12345);
      expect(dumpResult.lastModified).toBeInstanceOf(Date);
      expect(distribution.isValid).toBe(true);
      expect(distribution.byteSize).toBe(12345);
    });

    it('retries with GET if HEAD returns no Content-Length', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response('', {
            status: 200,
            headers: { 'Content-Length': '0' },
          })
        )
        .mockResolvedValueOnce(
          new Response('', {
            status: 200,
            headers: { 'Content-Length': '5000' },
          })
        );

      const distribution = new Distribution(
        new URL('http://example.org/data.nt'),
        'application/n-triples'
      );

      const result = await probe(distribution);

      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
      expect(result).toBeInstanceOf(DataDumpProbeResult);
      expect((result as DataDumpProbeResult).contentSize).toBe(5000);
    });
  });

  describe('network error', () => {
    it('returns NetworkError on fetch failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));

      const distribution = Distribution.sparql(
        new URL('http://example.org/sparql')
      );

      const result = await probe(distribution);

      expect(result).toBeInstanceOf(NetworkError);
      expect((result as NetworkError).message).toBe('Connection refused');
    });
  });
});
