import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import type { CheckResult } from './types.js';

export interface SparqlMonitorOptions {
  /** Optional custom fetcher instance. */
  fetcher?: SparqlEndpointFetcher;
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

  constructor(options?: SparqlMonitorOptions) {
    this.fetcher =
      options?.fetcher ??
      new SparqlEndpointFetcher({
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

    try {
      const queryType = this.fetcher.getQueryType(query);

      switch (queryType) {
        case 'ASK':
          await this.fetcher.fetchAsk(endpointUrl.toString(), query);
          break;
        case 'SELECT':
          await this.consumeStream(
            await this.fetcher.fetchBindings(endpointUrl.toString(), query)
          );
          break;
        case 'CONSTRUCT':
          await this.consumeStream(
            await this.fetcher.fetchTriples(endpointUrl.toString(), query)
          );
          break;
        default:
          throw new Error(`Unsupported query type: ${queryType}`);
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
