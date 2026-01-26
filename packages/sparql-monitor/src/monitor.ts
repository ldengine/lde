import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import type { CheckResult } from './types.js';

/**
 * Extract credentials from a URL and convert them to a Basic auth header.
 * Returns a tuple of [URL without credentials, Headers with Authorization].
 */
function extractUrlCredentials(
  url: URL,
  baseHeaders?: Headers
): [URL, Headers] {
  const headers = new Headers(baseHeaders);

  if (url.username || url.password) {
    const credentials = `${decodeURIComponent(
      url.username
    )}:${decodeURIComponent(url.password)}`;
    headers.set(
      'Authorization',
      `Basic ${Buffer.from(credentials).toString('base64')}`
    );

    const cleanUrl = new URL(url.toString());
    cleanUrl.username = '';
    cleanUrl.password = '';
    return [cleanUrl, headers];
  }

  return [url, headers];
}

export interface SparqlMonitorOptions {
  /** Timeout in milliseconds for the SPARQL request. */
  timeoutMs?: number;
  /** HTTP headers to include in requests (e.g., User-Agent). */
  headers?: Headers;
}

/**
 * Executes SPARQL queries against an endpoint and measures response time.
 */
export class SparqlMonitor {
  private readonly fetcher: SparqlEndpointFetcher;
  private readonly options?: SparqlMonitorOptions;

  constructor(options?: SparqlMonitorOptions) {
    this.options = options;
    this.fetcher = new SparqlEndpointFetcher({
      timeout: options?.timeoutMs ?? 30000,
      defaultHeaders: options?.headers,
    });
  }

  /**
   * Execute a SPARQL query against an endpoint and return the result.
   */
  async check(endpointUrl: URL, query: string): Promise<CheckResult> {
    const observedAt = new Date(); // UTC
    const startTime = performance.now();
    const [url, fetcher] = this.prepareFetcherForUrl(endpointUrl);

    try {
      const queryType = fetcher.getQueryType(query);

      switch (queryType) {
        case 'ASK':
          await fetcher.fetchAsk(url, query);
          break;
        case 'SELECT':
          await this.consumeStream(await fetcher.fetchBindings(url, query));
          break;
        case 'CONSTRUCT':
          await this.consumeStream(await fetcher.fetchTriples(url, query));
          break;
      }

      const responseTimeMs = Math.round(performance.now() - startTime);
      return {
        success: true,
        responseTimeMs,
        errorMessage: null,
        observedAt,
      };
    } catch (error) {
      const responseTimeMs = Math.round(performance.now() - startTime);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        success: false,
        responseTimeMs,
        errorMessage,
        observedAt,
      };
    }
  }

  private prepareFetcherForUrl(
    endpointUrl: URL
  ): [string, SparqlEndpointFetcher] {
    const [url, headers] = extractUrlCredentials(
      endpointUrl,
      this.options?.headers
    );
    const hasCredentials =
      headers.has('Authorization') &&
      !this.options?.headers?.has('Authorization');

    if (!hasCredentials) {
      return [url.toString(), this.fetcher];
    }

    const fetcher = new SparqlEndpointFetcher({
      timeout: this.options?.timeoutMs ?? 30000,
      defaultHeaders: headers,
    });

    return [url.toString(), fetcher];
  }

  private async consumeStream(stream: NodeJS.ReadableStream): Promise<void> {
    return new Promise((resolve, reject) => {
      stream.on('data', () => {
        // Just consume the data
      });
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
  }
}
