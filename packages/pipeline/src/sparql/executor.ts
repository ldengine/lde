import { Dataset, Distribution } from '@lde/dataset';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import type { NamedNode, Quad } from '@rdfjs/types';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Parser } from '@traqula/parser-sparql-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import type { QueryConstruct } from '@traqula/rules-sparql-1-1';
import pRetry from 'p-retry';
import { withDefaultGraph } from './graph.js';
import { injectValues } from './values.js';

/**
 * An executor could not run because the dataset lacks a supported distribution.
 */
export class NotSupported {
  constructor(public readonly message: string) {}
}

/** A single row of variable bindings (variable name → NamedNode). */
export type VariableBindings = Record<string, NamedNode>;

export interface ExecuteOptions {
  /**
   * Variable bindings to inject as a VALUES clause into the query.
   * When non-empty, a VALUES block is prepended to the WHERE clause.
   */
  bindings?: VariableBindings[];
}

export interface Executor {
  execute(
    dataset: Dataset,
    distribution: Distribution,
    options?: ExecuteOptions,
  ): Promise<AsyncIterable<Quad> | NotSupported>;
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
   * Number of retries for transient HTTP errors (502, 503, 504).
   * @default 3
   */
  retries?: number;

  /**
   * Optional custom SparqlEndpointFetcher instance.
   */
  fetcher?: SparqlEndpointFetcher;
}

/**
 * A streaming SPARQL CONSTRUCT executor.
 *
 * Queries **without** `#subjectFilter#` are parsed once in the constructor
 * (fast path). Queries that contain the template are stored as raw strings
 * and parsed at {@link execute} time after substitution.
 *
 * Template substitution (applied in order):
 * 1. `#subjectFilter#` — replaced with `distribution.subjectFilter` (deferred to execute)
 * 2. `FROM <graph>` — set via `withDefaultGraph` if the distribution has a named graph
 * 3. `?dataset` — replaced with the dataset IRI (string substitution on the serialised query)
 *
 * @example
 * ```typescript
 * const executor = new SparqlConstructExecutor({
 *   query: 'CONSTRUCT { ?dataset ?p ?o } WHERE { ?s ?p ?o }',
 * });
 * const result = await executor.execute(dataset, distribution);
 * if (result instanceof NotSupported) {
 *   console.log(result.message);
 * } else {
 *   for await (const quad of result) {
 *     console.log(quad);
 *   }
 * }
 * ```
 */
export class SparqlConstructExecutor implements Executor {
  private readonly rawQuery: string;
  private readonly preParsed?: QueryConstruct;
  private readonly fetcher: SparqlEndpointFetcher;
  private readonly retries: number;
  private readonly generator = new Generator();

  constructor(options: SparqlConstructExecutorOptions) {
    this.rawQuery = options.query;
    this.retries = options.retries ?? 3;

    if (!options.query.includes('#subjectFilter#')) {
      const parsed = new Parser().parse(options.query);
      if (parsed.type !== 'query' || parsed.subType !== 'construct') {
        throw new Error('Query must be a CONSTRUCT query');
      }
      this.preParsed = parsed as QueryConstruct;
    }

    this.fetcher =
      options.fetcher ??
      new SparqlEndpointFetcher({
        timeout: options.timeout ?? 300_000,
      });
  }

  /**
   * Execute the SPARQL CONSTRUCT query against the distribution's endpoint.
   *
   * @param dataset The dataset to execute against.
   * @param distribution The distribution providing the SPARQL endpoint.
   * @param options Optional execution options (bindings).
   * @returns AsyncIterable<Quad> stream of results.
   */
  async execute(
    dataset: Dataset,
    distribution: Distribution,
    options?: ExecuteOptions,
  ): Promise<AsyncIterable<Quad>> {
    const endpoint = distribution.accessUrl;

    let ast: QueryConstruct;
    if (this.preParsed) {
      ast = structuredClone(this.preParsed);
    } else {
      const substituted = this.rawQuery.replace(
        '#subjectFilter#',
        distribution.subjectFilter ?? '',
      );
      const parsed = new Parser().parse(substituted);
      if (parsed.type !== 'query' || parsed.subType !== 'construct') {
        throw new Error('Query must be a CONSTRUCT query');
      }
      ast = parsed as QueryConstruct;
    }

    if (distribution.namedGraph) {
      withDefaultGraph(ast, distribution.namedGraph);
    }

    const bindings = options?.bindings;
    if (bindings !== undefined && bindings.length > 0) {
      ast = injectValues(ast, bindings);
    }

    let query = this.generator.generate(ast);
    query = query.replaceAll('?dataset', `<${dataset.iri}>`);

    return await pRetry(
      () => this.fetcher.fetchTriples(endpoint.toString(), query),
      {
        retries: this.retries,
        shouldRetry: ({ error }) => isTransientHttpError(error),
      },
    );
  }

  /**
   * Create an executor from a query file.
   *
   * @param filename Path to the query file.
   * @param options Optional executor options (timeout, fetcher).
   */
  public static async fromFile(
    filename: string,
    options?: Omit<SparqlConstructExecutorOptions, 'query'>,
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

const transientStatusPattern = /HTTP status (\d+)/;

function isTransientHttpError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const match = error.message.match(transientStatusPattern);
  if (!match) return false;
  const status = Number(match[1]);
  return status === 502 || status === 503 || status === 504;
}
