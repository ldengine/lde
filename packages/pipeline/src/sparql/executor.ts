import { Dataset, Distribution } from '@lde/dataset';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import type { NamedNode, Quad, Stream } from '@rdfjs/types';
import type { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Generator, Parser, type ConstructQuery } from 'sparqljs';
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
    options?: ExecuteOptions
  ): Promise<AsyncIterable<Quad> | NotSupported>;
}

/**
 * A quad stream that is both an RDFJS Stream and Node.js Readable (async iterable).
 * This is the actual return type from SparqlEndpointFetcher.fetchTriples().
 */
export type QuadStream = Readable & Stream<Quad>;

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
 * A streaming SPARQL CONSTRUCT executor that parses the query once (in the
 * constructor) and operates on the AST for graph and VALUES injection.
 *
 * Template substitution (applied in order):
 * 1. `FROM <graph>` — set via `withDefaultGraph` if the distribution has a named graph
 * 2. `?dataset` — replaced with the dataset IRI (string substitution on the serialised query)
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
  private readonly query: ConstructQuery;
  private readonly fetcher: SparqlEndpointFetcher;
  private readonly generator = new Generator();

  constructor(options: SparqlConstructExecutorOptions) {
    const parser = new Parser();
    const parsed = parser.parse(options.query);
    if (parsed.type !== 'query' || parsed.queryType !== 'CONSTRUCT') {
      throw new Error('Query must be a CONSTRUCT query');
    }
    this.query = parsed as ConstructQuery;
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
    options?: ExecuteOptions
  ): Promise<QuadStream> {
    const endpoint = distribution.accessUrl;

    let ast = structuredClone(this.query);

    if (distribution.namedGraph) {
      withDefaultGraph(ast, distribution.namedGraph);
    }

    const bindings = options?.bindings;
    if (bindings !== undefined && bindings.length > 0) {
      ast = injectValues(ast, bindings);
    }

    let query = this.generator.stringify(ast);
    query = query.replaceAll('?dataset', `<${dataset.iri}>`);

    return await this.fetcher.fetchTriples(endpoint.toString(), query);
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
 * Substitute template variables in a SPARQL query.
 *
 * - `#subjectFilter#` — replaced with the distribution's subject filter
 * - `#namedGraph#` — replaced with `FROM <graph>` clause if the distribution has a named graph
 * - `?dataset` — replaced with the dataset IRI
 */
export function substituteQueryTemplates(
  query: string,
  distribution: Distribution | null,
  dataset: Dataset
): string {
  const subjectFilter = distribution?.subjectFilter ?? '';

  const namedGraph = distribution?.namedGraph
    ? `FROM <${distribution.namedGraph}>`
    : '';

  return query
    .replace('#subjectFilter#', subjectFilter)
    .replaceAll('?dataset', `<${dataset.iri}>`)
    .replace('#namedGraph#', namedGraph);
}

/**
 * Read a SPARQL query from a file.
 */
export async function readQueryFile(filename: string): Promise<string> {
  return (await readFile(resolve(filename))).toString();
}
