import { Dataset, Distribution } from '@lde/dataset';
import { Store } from 'n3';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseAnalyzer, Success, Failure, NotSupported } from './analyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Extended dataset with optional SPARQL filtering options.
 */
export interface AnalyzableDataset extends Dataset {
  /**
   * Optional SPARQL filter clause to restrict analysis to a subset of the data.
   * This is substituted for `#subjectFilter#` in queries.
   */
  subjectFilter?: string;
}

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
 */
export class SparqlQueryAnalyzer extends BaseAnalyzer {
  private readonly fetcher: SparqlEndpointFetcher;

  constructor(
    public readonly name: string,
    private readonly query: string,
    options?: SparqlQueryAnalyzerOptions
  ) {
    super();
    this.fetcher =
      options?.fetcher ??
      new SparqlEndpointFetcher({
        timeout: options?.timeout ?? 300_000,
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
    const queryPath = resolve(__dirname, 'queries', filename);
    const query = (await readFile(queryPath)).toString();
    return new SparqlQueryAnalyzer(filename, query, options);
  }

  public async execute(
    dataset: AnalyzableDataset
  ): Promise<Success | Failure | NotSupported> {
    const sparqlDistribution = dataset.getSparqlDistribution();
    if (sparqlDistribution === null) {
      return new NotSupported('No SPARQL distribution available');
    }

    const store = new Store();
    try {
      const stream = await this.executeQuery(sparqlDistribution, dataset);
      for await (const quad of stream) {
        store.addQuad(quad);
      }
    } catch (e) {
      const accessUrl = sparqlDistribution.accessUrl;
      return new Failure(
        accessUrl ?? new URL('unknown://'),
        e instanceof Error ? e.message : undefined
      );
    }

    return new Success(store);
  }

  private async executeQuery(
    distribution: Distribution,
    dataset: AnalyzableDataset
  ) {
    const query = this.substituteTemplates(this.query, distribution, dataset);
    return await this.fetcher.fetchTriples(
      distribution.accessUrl!.toString(),
      query
    );
  }

  private substituteTemplates(
    query: string,
    distribution: Distribution,
    dataset: AnalyzableDataset
  ): string {
    return query
      .replace('#subjectFilter#', dataset.subjectFilter ?? '')
      .replaceAll('?dataset', `<${dataset.iri}>`)
      .replace(
        '#namedGraph#',
        distribution.namedGraph ? `FROM <${distribution.namedGraph}>` : ''
      );
  }
}
