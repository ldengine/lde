import { Distribution } from '@lde/dataset';
import {
  SparqlConstructExecutor,
  NotSupported as PipelineNotSupported,
  type ExecutableDataset,
} from '@lde/pipeline';
import { Store } from 'n3';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseAnalyzer, Success, Failure, NotSupported } from './analyzer.js';
import { AnalyzableDataset } from './sparqlQueryAnalyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface PerClassAnalyzerOptions {
  /**
   * Timeout for SPARQL queries in milliseconds.
   * @default 300000 (5 minutes)
   */
  timeout?: number;
  /**
   * Custom SparqlEndpointFetcher instance.
   */
  fetcher?: SparqlEndpointFetcher;
  /**
   * Maximum number of classes to analyze.
   * @default 1000
   */
  maxClasses?: number;
}

/**
 * Two-phase analyzer that first retrieves classes, then runs a query for each class.
 *
 * This approach prevents timeouts and OOM errors on large datasets by splitting
 * the analysis into smaller queries per class.
 *
 * Supports template substitution:
 * - `#subjectFilter#` — replaced with the dataset's subject filter (if any)
 * - `#namedGraph#` — replaced with `FROM <graph>` clause if the distribution has a named graph
 * - `?dataset` — replaced with the dataset IRI
 * - `<#class#>` — replaced with the current class IRI
 */
export class PerClassAnalyzer extends BaseAnalyzer {
  private readonly fetcher: SparqlEndpointFetcher;
  private readonly executor: SparqlConstructExecutor;
  private readonly maxClasses: number;

  constructor(
    public readonly name: string,
    query: string,
    options?: PerClassAnalyzerOptions
  ) {
    super();
    this.fetcher =
      options?.fetcher ??
      new SparqlEndpointFetcher({
        timeout: options?.timeout ?? 300_000,
      });
    this.maxClasses = options?.maxClasses ?? 1000;
    this.executor = new SparqlConstructExecutor({
      query,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetcher: this.fetcher as any,
    });
  }

  /**
   * Load a query file from the queries directory.
   *
   * @param filename Query filename (e.g., 'class-property-datatypes.rq')
   */
  public static async loadQuery(filename: string): Promise<string> {
    const queryPath = resolve(__dirname, 'queries', filename);
    return (await readFile(queryPath)).toString();
  }

  /**
   * Create an analyzer from a query file in the queries directory.
   *
   * @param filename Query filename (e.g., 'class-property-datatypes.rq')
   * @param options Optional analyzer options
   */
  public static async fromFile(
    filename: string,
    options?: PerClassAnalyzerOptions
  ): Promise<PerClassAnalyzer> {
    const query = await PerClassAnalyzer.loadQuery(filename);
    return new PerClassAnalyzer(filename, query, options);
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
      // Phase 1: Get all classes.
      const classes = await this.getClasses(sparqlDistribution, dataset);

      // Phase 2: Run query for each class via SparqlConstructExecutor.
      for (const classIri of classes) {
        const result = await this.executor.execute(
          dataset as ExecutableDataset,
          { bindings: { '<#class#>': `<${classIri}>` } }
        );
        if (result instanceof PipelineNotSupported) {
          return new NotSupported(result.message);
        }
        for await (const quad of result) {
          store.addQuad(quad);
        }
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

  private async getClasses(
    distribution: Distribution,
    dataset: AnalyzableDataset
  ): Promise<string[]> {
    const classQuery = this.substituteSelectTemplates(
      `SELECT DISTINCT ?class
       #namedGraph#
       WHERE {
         #subjectFilter#
         ?s a ?class .
       }
       LIMIT ${this.maxClasses}`,
      distribution,
      dataset
    );

    const bindings = await this.fetcher.fetchBindings(
      distribution.accessUrl!.toString(),
      classQuery
    );
    const classes: string[] = [];
    for await (const binding of bindings) {
      // Bindings are Record<string, RDF.Term>.
      const bindingRecord = binding as unknown as Record<
        string,
        { termType: string; value: string }
      >;
      const classValue = bindingRecord['class'];
      if (classValue && classValue.termType === 'NamedNode') {
        classes.push(classValue.value);
      }
    }
    return classes;
  }

  private substituteSelectTemplates(
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
