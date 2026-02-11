import { Dataset, Distribution } from '@lde/dataset';
import {
  SparqlConstructExecutor,
  substituteQueryTemplates,
  readQueryFile,
  collect,
} from '@lde/pipeline';
import { Store } from 'n3';
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
 * Supports legacy template substitution:
 * - `#subjectFilter#` — replaced with the dataset's subject filter (if any)
 * - `#namedGraph#` — replaced with `FROM <graph>` clause if the distribution has a named graph
 * - `?dataset` — replaced with the dataset IRI
 * - `<#class#>` — replaced with the current class IRI
 */
export class PerClassAnalyzer extends BaseAnalyzer {
  private readonly fetcher: SparqlEndpointFetcher;
  private readonly query: string;
  private readonly maxClasses: number;

  constructor(
    public readonly name: string,
    query: string,
    options?: PerClassAnalyzerOptions
  ) {
    super();
    this.query = query;
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
    const query = await readQueryFile(resolve(__dirname, 'queries', filename));
    return new PerClassAnalyzer(filename, query, options);
  }

  public async execute(
    dataset: Dataset
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
        const substituted = substituteQueryTemplates(
          this.query.replaceAll('<#class#>', `<${classIri}>`),
          sparqlDistribution,
          dataset
        );
        const executor = new SparqlConstructExecutor({
          query: substituted,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fetcher: this.fetcher as any,
        });
        const stream = await executor.execute(dataset, sparqlDistribution);
        store.addQuads([...(await collect(stream))]);
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
    dataset: Dataset
  ): Promise<string[]> {
    const classQuery = substituteQueryTemplates(
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
}

export function createDatatypeAnalyzer(
  options?: PerClassAnalyzerOptions
): Promise<PerClassAnalyzer> {
  return PerClassAnalyzer.fromFile('class-property-datatypes.rq', options);
}

export function createLanguageAnalyzer(
  options?: PerClassAnalyzerOptions
): Promise<PerClassAnalyzer> {
  return PerClassAnalyzer.fromFile('class-property-languages.rq', options);
}

export function createObjectClassAnalyzer(
  options?: PerClassAnalyzerOptions
): Promise<PerClassAnalyzer> {
  return PerClassAnalyzer.fromFile('class-property-object-classes.rq', options);
}
