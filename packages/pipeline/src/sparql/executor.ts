import { Dataset, Distribution } from '@lde/dataset';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import type { Quad, Stream } from '@rdfjs/types';
import type { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NotSupported } from '../step.js';

// Re-export for convenience
export { NotSupported } from '../step.js';

/**
 * A quad stream that is both an RDFJS Stream and Node.js Readable (async iterable).
 * This is the actual return type from SparqlEndpointFetcher.fetchTriples().
 */
export type QuadStream = Readable & Stream<Quad>;

/**
 * Extended dataset with optional SPARQL filtering options.
 */
export interface ExecutableDataset extends Dataset {
  /**
   * Optional SPARQL filter clause to restrict analysis to a subset of the data.
   * This is substituted for `#subjectFilter#` in queries.
   */
  subjectFilter?: string;
}

/**
 * Options for SparqlConstructExecutor.
 */
export interface SparqlConstructExecutorOptions {
  /**
   * SPARQL CONSTRUCT query to execute.
   */
  query: string;

  /**
   * Optional timeout for SPARQL queries in milliseconds.
   * @default 300000 (5 minutes)
   */
  timeout?: number;

  /**
   * Optional custom SparqlEndpointFetcher instance.
   */
  fetcher?: SparqlEndpointFetcher;
}

/**
 * Options for `execute()`.
 */
export interface ExecuteOptions {
  /**
   * Explicit SPARQL endpoint URL. If not provided, uses the dataset's SPARQL distribution.
   */
  endpoint?: URL;

  /**
   * Variable bindings to substitute in the query before standard template substitution.
   * Each key is a literal string to replace, each value is its replacement.
   *
   * @example
   * ```typescript
   * await executor.execute(dataset, {
   *   bindings: { '<#class#>': '<http://schema.org/Person>' },
   * });
   * ```
   */
  bindings?: Record<string, string>;
}

/**
 * A streaming SPARQL CONSTRUCT executor with template substitution.
 *
 * Supports template substitution (applied in order):
 * 1. `bindings` — any provided variable bindings
 * 2. `#subjectFilter#` — replaced with the distribution's subject filter or dataset's subjectFilter
 * 3. `#namedGraph#` — replaced with `FROM <graph>` clause if the distribution has a named graph
 * 4. `?dataset` — replaced with the dataset IRI
 *
 * @example
 * ```typescript
 * const executor = new SparqlConstructExecutor({
 *   query: 'CONSTRUCT { ?dataset ?p ?o } WHERE { ?s ?p ?o }',
 * });
 * const result = await executor.execute(dataset);
 * if (result instanceof NotSupported) {
 *   console.log(result.message);
 * } else {
 *   for await (const quad of result) {
 *     console.log(quad);
 *   }
 * }
 * ```
 */
export class SparqlConstructExecutor {
  private readonly query: string;
  private readonly fetcher: SparqlEndpointFetcher;

  constructor(options: SparqlConstructExecutorOptions) {
    this.query = options.query;
    this.fetcher =
      options.fetcher ??
      new SparqlEndpointFetcher({
        timeout: options.timeout ?? 300_000,
      });
  }

  /**
   * Execute the SPARQL CONSTRUCT query against the dataset's SPARQL endpoint.
   *
   * @param dataset The dataset to execute against.
   * @param options Optional endpoint override and variable bindings.
   * @returns AsyncIterable<Quad> stream of results, or NotSupported if no SPARQL endpoint available.
   */
  async execute(
    dataset: ExecutableDataset,
    options?: ExecuteOptions
  ): Promise<QuadStream | NotSupported> {
    const distribution = dataset.getSparqlDistribution();
    let endpoint = options?.endpoint;

    if (endpoint === undefined) {
      if (distribution === null || !distribution.isValid) {
        return new NotSupported('No SPARQL distribution available');
      }
      endpoint = distribution.accessUrl;
    }

    let query = this.query;

    // Apply bindings first.
    if (options?.bindings) {
      for (const [variable, value] of Object.entries(options.bindings)) {
        query = query.replaceAll(variable, value);
      }
    }

    query = this.substituteTemplates(query, distribution, dataset);

    return await this.fetcher.fetchTriples(endpoint.toString(), query);
  }

  /**
   * Substitute template variables in the query.
   */
  private substituteTemplates(
    query: string,
    distribution: Distribution | null,
    dataset: ExecutableDataset
  ): string {
    // Subject filter: prefer distribution's subjectFilter, fall back to dataset's
    const subjectFilter =
      distribution?.subjectFilter ?? dataset.subjectFilter ?? '';

    // Named graph clause
    const namedGraph = distribution?.namedGraph
      ? `FROM <${distribution.namedGraph}>`
      : '';

    return query
      .replace('#subjectFilter#', subjectFilter)
      .replaceAll('?dataset', `<${dataset.iri}>`)
      .replace('#namedGraph#', namedGraph);
  }

  /**
   * Create an executor from a query file.
   *
   * @param filename Path to the query file.
   * @param options Optional executor options (timeout, fetcher).
   */
  public static async fromFile(
    filename: string,
    options?: Omit<SparqlConstructExecutorOptions, 'query'>
  ): Promise<SparqlConstructExecutor> {
    const query = await readQueryFile(filename);
    return new SparqlConstructExecutor({ ...options, query });
  }
}

/**
 * Read a SPARQL query from a file.
 */
export async function readQueryFile(filename: string): Promise<string> {
  return (await readFile(resolve(filename))).toString();
}
