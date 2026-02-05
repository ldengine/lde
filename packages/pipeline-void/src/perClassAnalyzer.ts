import { Distribution } from '@lde/dataset';
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
  private readonly maxClasses: number;

  constructor(
    public readonly name: string,
    private readonly query: string,
    options?: PerClassAnalyzerOptions
  ) {
    super();
    this.fetcher =
      options?.fetcher ??
      new SparqlEndpointFetcher({
        timeout: options?.timeout ?? 300_000,
      });
    this.maxClasses = options?.maxClasses ?? 1000;
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
    const queryPath = resolve(__dirname, 'queries', filename);
    const query = (await readFile(queryPath)).toString();
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

      // Phase 2: Run query for each class.
      for (const classIri of classes) {
        const stream = await this.executeQuery(
          sparqlDistribution,
          dataset,
          classIri
        );
        for await (const quad of stream) {
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
    const classQuery = this.substituteTemplates(
      `SELECT DISTINCT ?class
       #namedGraph#
       WHERE {
         #subjectFilter#
         ?s a ?class .
       }
       LIMIT ${this.maxClasses}`,
      distribution,
      dataset,
      ''
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

  private async executeQuery(
    distribution: Distribution,
    dataset: AnalyzableDataset,
    classIri: string
  ) {
    const query = this.substituteTemplates(
      this.query,
      distribution,
      dataset,
      classIri
    );
    return await this.fetcher.fetchTriples(
      distribution.accessUrl!.toString(),
      query
    );
  }

  private substituteTemplates(
    query: string,
    distribution: Distribution,
    dataset: AnalyzableDataset,
    classIri: string
  ): string {
    return query
      .replace('#subjectFilter#', dataset.subjectFilter ?? '')
      .replaceAll('?dataset', `<${dataset.iri}>`)
      .replace(
        '#namedGraph#',
        distribution.namedGraph ? `FROM <${distribution.namedGraph}>` : ''
      )
      .replaceAll('<#class#>', `<${classIri}>`);
  }
}
