import { describe, it, expect, vi } from 'vitest';
import { SparqlMonitor } from '../src/monitor.js';

function mockFetchResponse(
  body: string,
  contentType = 'application/sparql-results+json'
) {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': contentType },
  });
}

describe('SparqlMonitor', () => {
  describe('check with ASK query', () => {
    it('returns success when endpoint responds', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockFetchResponse('{"boolean": true}'));

      const monitor = new SparqlMonitor();
      const result = await monitor.check(
        new URL('http://example.org/sparql'),
        'ASK { ?s ?p ?o }'
      );

      expect(result.success).toBe(true);
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.errorMessage).toBeNull();
      expect(result.observedAt).toBeInstanceOf(Date);

      fetchSpy.mockRestore();
    });

    it('returns failure when endpoint throws', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('Connection refused'));

      const monitor = new SparqlMonitor();
      const result = await monitor.check(
        new URL('http://example.org/sparql'),
        'ASK { ?s ?p ?o }'
      );

      expect(result.success).toBe(false);
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.errorMessage).toBe('Connection refused');

      fetchSpy.mockRestore();
    });
  });

  describe('check with SELECT query', () => {
    it('returns success when query completes', async () => {
      const jsonResponse = JSON.stringify({
        results: { bindings: [{ s: { value: 'x' } }] },
      });
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockFetchResponse(jsonResponse));

      const monitor = new SparqlMonitor();
      const result = await monitor.check(
        new URL('http://example.org/sparql'),
        'SELECT * WHERE { ?s ?p ?o } LIMIT 1'
      );

      expect(result.success).toBe(true);

      fetchSpy.mockRestore();
    });
  });

  describe('check with CONSTRUCT query', () => {
    it('returns success when query completes', async () => {
      const turtleResponse =
        '<http://example.org/s> <http://example.org/p> <http://example.org/o> .';
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockFetchResponse(turtleResponse, 'text/turtle'));

      const monitor = new SparqlMonitor();
      const result = await monitor.check(
        new URL('http://example.org/sparql'),
        'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1'
      );

      expect(result.success).toBe(true);

      fetchSpy.mockRestore();
    });
  });

  describe('invalid query', () => {
    it('returns failure for unparseable query', async () => {
      const monitor = new SparqlMonitor();
      const result = await monitor.check(
        new URL('http://example.org/sparql'),
        'INVALID QUERY'
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Parse error');
    });
  });

  describe('headers configuration', () => {
    it('passes headers to fetcher constructor', () => {
      const headers = new Headers({ 'User-Agent': 'TestAgent/1.0' });

      // We can't easily test the internal fetcher construction,
      // but we can verify the monitor accepts headers without error
      const monitor = new SparqlMonitor({ headers });
      expect(monitor).toBeInstanceOf(SparqlMonitor);
    });
  });

  describe('URL with embedded credentials', () => {
    it('extracts credentials and converts to Basic auth header', async () => {
      let capturedUrl: string | undefined;
      let capturedHeaders: Headers | undefined;

      const monitor = new SparqlMonitor();

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(
          async (input: string | URL | Request, init?: RequestInit) => {
            capturedUrl =
              typeof input === 'string' ? input : (input as URL).toString();
            capturedHeaders = new Headers(init?.headers);
            return mockFetchResponse('{"boolean": true}');
          }
        );

      await monitor.check(
        new URL('http://user:pass@example.org/sparql'),
        'ASK { ?s ?p ?o }'
      );

      expect(capturedUrl).toContain('http://example.org/sparql');
      expect(capturedUrl).not.toContain('user');
      expect(capturedUrl).not.toContain('pass');
      expect(capturedHeaders?.get('Authorization')).toBe(
        `Basic ${Buffer.from('user:pass').toString('base64')}`
      );

      fetchSpy.mockRestore();
    });

    it('decodes URL-encoded credentials', async () => {
      let capturedHeaders: Headers | undefined;

      const monitor = new SparqlMonitor();

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(
          async (_input: string | URL | Request, init?: RequestInit) => {
            capturedHeaders = new Headers(init?.headers);
            return mockFetchResponse('{"boolean": true}');
          }
        );

      // URL with encoded special characters: user@domain:p@ss
      await monitor.check(
        new URL('http://user%40domain:p%40ss@example.org/sparql'),
        'ASK { ?s ?p ?o }'
      );

      expect(capturedHeaders?.get('Authorization')).toBe(
        `Basic ${Buffer.from('user@domain:p@ss').toString('base64')}`
      );

      fetchSpy.mockRestore();
    });

    it('preserves existing headers when adding auth', async () => {
      let capturedHeaders: Headers | undefined;

      const headers = new Headers({ 'User-Agent': 'TestAgent/1.0' });
      const monitor = new SparqlMonitor({ headers });

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(
          async (_input: string | URL | Request, init?: RequestInit) => {
            capturedHeaders = new Headers(init?.headers);
            return mockFetchResponse('{"boolean": true}');
          }
        );

      await monitor.check(
        new URL('http://user:pass@example.org/sparql'),
        'ASK { ?s ?p ?o }'
      );

      expect(capturedHeaders?.get('Authorization')).toBe(
        `Basic ${Buffer.from('user:pass').toString('base64')}`
      );
      expect(capturedHeaders?.get('User-Agent')).toBe('TestAgent/1.0');

      fetchSpy.mockRestore();
    });
  });
});
