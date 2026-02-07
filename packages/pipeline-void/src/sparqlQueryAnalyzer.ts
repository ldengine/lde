import {
  SparqlConstructExecutor,
  collect,
  readQueryFile,
  type ExecutableDataset,
} from '@lde/pipeline';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BaseAnalyzer,
  Success,
  Failure,
  NotSupported,
} from '@lde/pipeline/analyzer';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SparqlQueryAnalyzerOptions {
  /**
   * Timeout for SPARQL queries in milliseconds.
   * @default 300000 (5 minutes)
   */
  timeout?: number;
  /**
   * Custom SparqlEndpointFetcher instance.
   */
  fetcher?: SparqlEndpointFetcher;
}

/**
 * Analyzer that executes a SPARQL CONSTRUCT query against a dataset's SPARQL endpoint.
 *
 * Supports template substitution:
 * - `#subjectFilter#` — replaced with the dataset's subject filter (if any)
 * - `#namedGraph#` — replaced with `FROM <graph>` clause if the distribution has a named graph
 * - `?dataset` — replaced with the dataset IRI
 *
 * This class wraps the SparqlConstructExecutor from @lde/pipeline.
 */
export class SparqlQueryAnalyzer extends BaseAnalyzer {
  private readonly executor: SparqlConstructExecutor;

  constructor(
    public readonly name: string,
    query: string,
    options?: SparqlQueryAnalyzerOptions
  ) {
    super();

    const fetcher =
      options?.fetcher ??
      new SparqlEndpointFetcher({
        timeout: options?.timeout ?? 300_000,
      });

    this.executor = new SparqlConstructExecutor({
      query,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetcher: fetcher as any, // Types differ between package instances
    });
  }

  /**
   * Create an analyzer from a query file in the queries directory.
   *
   * @param filename Query filename (e.g., 'triples.rq')
   * @param options Optional analyzer options
   */
  public static async fromFile(
    filename: string,
    options?: SparqlQueryAnalyzerOptions
  ): Promise<SparqlQueryAnalyzer> {
    const query = await readQueryFile(resolve(__dirname, 'queries', filename));
    return new SparqlQueryAnalyzer(filename, query, options);
  }

  public async execute(
    dataset: ExecutableDataset
  ): Promise<Success | Failure | NotSupported> {
    const sparqlDistribution = dataset.getSparqlDistribution();
    if (sparqlDistribution === null) {
      return new NotSupported('No SPARQL distribution available');
    }

    try {
      const result = await this.executor.execute(dataset);
      if (result instanceof NotSupported) {
        return result;
      }

      const store = await collect(result);
      return new Success(store);
    } catch (e) {
      return new Failure(
        sparqlDistribution.accessUrl ?? new URL('unknown://'),
        e instanceof Error ? e.message : undefined
      );
    }
  }
}
