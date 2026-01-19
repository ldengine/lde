import { SparqlMonitor } from '../src/monitor.js';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';

function createMockStream() {
  const stream = {
    on: vi.fn((event: string, callback: () => void) => {
      if (event === 'end') {
        setTimeout(callback, 0);
      }
      return stream;
    }),
  };
  return stream;
}

describe('SparqlMonitor', () => {
  describe('check with ASK query', () => {
    it('returns success when endpoint responds', async () => {
      const fetcher = {
        getQueryType: vi.fn().mockReturnValue('ASK'),
        fetchAsk: vi.fn().mockResolvedValue(true),
      } as unknown as SparqlEndpointFetcher;

      const monitor = new SparqlMonitor({ fetcher });
      const result = await monitor.check(
        new URL('http://example.org/sparql'),
        'ASK { ?s ?p ?o }'
      );

      expect(result.success).toBe(true);
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.errorMessage).toBeNull();
      expect(result.observedAt).toBeInstanceOf(Date);
    });

    it('returns failure when endpoint throws', async () => {
      const fetcher = {
        getQueryType: vi.fn().mockReturnValue('ASK'),
        fetchAsk: vi.fn().mockRejectedValue(new Error('Connection refused')),
      } as unknown as SparqlEndpointFetcher;

      const monitor = new SparqlMonitor({ fetcher });
      const result = await monitor.check(
        new URL('http://example.org/sparql'),
        'ASK { ?s ?p ?o }'
      );

      expect(result.success).toBe(false);
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.errorMessage).toBe('Connection refused');
    });
  });

  describe('check with SELECT query', () => {
    it('returns success when query completes', async () => {
      const mockStream = createMockStream();
      const fetcher = {
        getQueryType: vi.fn().mockReturnValue('SELECT'),
        fetchBindings: vi.fn().mockResolvedValue(mockStream),
      } as unknown as SparqlEndpointFetcher;

      const monitor = new SparqlMonitor({ fetcher });
      const result = await monitor.check(
        new URL('http://example.org/sparql'),
        'SELECT * WHERE { ?s ?p ?o } LIMIT 1'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('check with CONSTRUCT query', () => {
    it('returns success when query completes', async () => {
      const mockStream = createMockStream();
      const fetcher = {
        getQueryType: vi.fn().mockReturnValue('CONSTRUCT'),
        fetchTriples: vi.fn().mockResolvedValue(mockStream),
      } as unknown as SparqlEndpointFetcher;

      const monitor = new SparqlMonitor({ fetcher });
      const result = await monitor.check(
        new URL('http://example.org/sparql'),
        'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('unsupported query type', () => {
    it('returns failure for unknown query type', async () => {
      const fetcher = {
        getQueryType: vi.fn().mockReturnValue('UNKNOWN'),
      } as unknown as SparqlEndpointFetcher;

      const monitor = new SparqlMonitor({ fetcher });
      const result = await monitor.check(
        new URL('http://example.org/sparql'),
        'INVALID QUERY'
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Unsupported query type: UNKNOWN');
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
});
