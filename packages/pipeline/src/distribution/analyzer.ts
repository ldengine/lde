import { Dataset, Distribution } from '@lde/dataset';
import {
  Importer,
  ImportFailed,
  ImportSuccessful,
  NotSupported,
} from '@lde/sparql-importer';
import { DataFactory, Store } from 'n3';
import {
  probe,
  NetworkError,
  SparqlProbeResult,
  DataDumpProbeResult,
  type ProbeResultType,
} from './probe.js';
import { NoDistributionAvailable } from './resolver.js';

export type { Importer };
export { ImportFailed, ImportSuccessful, NotSupported };

const { quad, namedNode, blankNode, literal } = DataFactory;

// Namespace prefixes
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const SCHEMA = 'https://schema.org/';
const VOID = 'http://rdfs.org/ns/void#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const HTTP_STATUS = 'https://www.w3.org/2011/http-statusCodes#';

/**
 * Extended importer interface with optional cleanup method.
 */
export interface ImporterWithFinish extends Importer {
  finish?(): Promise<void>;
}

export interface DistributionAnalyzerOptions {
  /**
   * Optional importer for loading data dumps when no SPARQL endpoint is available.
   */
  importer?: ImporterWithFinish;

  /**
   * Timeout for probe requests in milliseconds.
   * @default 5000
   */
  timeout?: number;
}

/**
 * Analyzes dataset distributions by probing their availability.
 *
 * - Probes SPARQL endpoints with a simple SELECT query
 * - Probes data dumps with HEAD/GET requests
 * - Records probe results as RDF (schema:Action)
 * - Optionally imports data dumps if no SPARQL endpoint is available
 */
export class DistributionAnalyzer {
  public readonly name = 'distribution';
  private readonly importer?: ImporterWithFinish;
  private readonly timeout: number;

  constructor(options?: DistributionAnalyzerOptions) {
    this.importer = options?.importer;
    this.timeout = options?.timeout ?? 5000;
  }

  /**
   * Analyze all distributions of a dataset.
   *
   * @returns Store with probe results as RDF, or NoDistributionAvailable if no usable distribution found
   */
  async execute(dataset: Dataset): Promise<Store | NoDistributionAvailable> {
    const probeResults = await Promise.all(
      dataset.distributions.map((distribution) =>
        probe(distribution, this.timeout)
      )
    );

    // Apply probe results to distributions (isValid, lastModified, byteSize).
    this.applyProbeResults(dataset.distributions, probeResults);

    const store = this.buildProbeResultsRdf(probeResults, dataset);

    // If no SPARQL endpoint available, try to import a data dump
    if (dataset.getSparqlDistribution() === null && this.importer) {
      const importResult = await this.importer.import(dataset);

      if (importResult instanceof ImportSuccessful) {
        // Add imported SPARQL distribution to dataset so subsequent steps can use it
        const distribution = Distribution.sparql(
          importResult.distribution.accessUrl,
          importResult.identifier
        );
        dataset.distributions.push(distribution);
      } else if (importResult instanceof ImportFailed) {
        // Record import error in the store
        this.addImportError(store, importResult);
      }
    }

    if (dataset.getSparqlDistribution() === null) {
      return new NoDistributionAvailable(
        dataset,
        'No SPARQL endpoint or importable data dump available'
      );
    }

    return store;
  }

  /**
   * Cleanup resources (e.g., importer connections).
   */
  async finish(): Promise<void> {
    await this.importer?.finish?.();
  }

  /**
   * Apply probe results to distributions so `getSparqlDistribution()` works.
   */
  private applyProbeResults(
    distributions: Distribution[],
    results: ProbeResultType[]
  ): void {
    for (let i = 0; i < distributions.length; i++) {
      const distribution = distributions[i];
      const result = results[i];

      if (result instanceof NetworkError) {
        distribution.isValid = false;
        continue;
      }

      distribution.isValid = result.isSuccess();

      if (result instanceof DataDumpProbeResult) {
        distribution.lastModified ??= result.lastModified ?? undefined;
        distribution.byteSize ??= result.contentSize ?? undefined;
      }
    }
  }

  private buildProbeResultsRdf(
    results: ProbeResultType[],
    dataset: Dataset
  ): Store {
    const store = new Store();

    for (const result of results) {
      const action = blankNode();

      // Base action triples
      store.addQuads([
        quad(action, namedNode(`${RDF}type`), namedNode(`${SCHEMA}Action`)),
        quad(action, namedNode(`${SCHEMA}target`), namedNode(result.url)),
      ]);

      if (result instanceof NetworkError) {
        store.addQuad(
          action,
          namedNode(`${SCHEMA}error`),
          literal(result.message)
        );
      } else if (result.isSuccess()) {
        this.addSuccessTriples(store, action, result, dataset);
      } else {
        // HTTP error
        const statusUri = `${HTTP_STATUS}${result.statusText.replace(
          / /g,
          ''
        )}`;
        store.addQuad(
          action,
          namedNode(`${SCHEMA}error`),
          namedNode(statusUri)
        );
      }
    }

    return store;
  }

  private addSuccessTriples(
    store: Store,
    action: ReturnType<typeof blankNode>,
    result: SparqlProbeResult | DataDumpProbeResult,
    dataset: Dataset
  ): void {
    const distributionUrl = namedNode(result.url);

    store.addQuad(action, namedNode(`${SCHEMA}result`), distributionUrl);

    if (result.lastModified) {
      store.addQuad(
        distributionUrl,
        namedNode(`${SCHEMA}dateModified`),
        literal(result.lastModified.toISOString(), namedNode(`${XSD}dateTime`))
      );
    }

    if (result instanceof SparqlProbeResult) {
      store.addQuad(
        namedNode(dataset.iri.toString()),
        namedNode(`${VOID}sparqlEndpoint`),
        distributionUrl
      );
    } else {
      store.addQuad(
        namedNode(dataset.iri.toString()),
        namedNode(`${VOID}dataDump`),
        distributionUrl
      );

      if (result.contentSize) {
        store.addQuad(
          distributionUrl,
          namedNode(`${SCHEMA}contentSize`),
          literal(result.contentSize)
        );
      }

      if (result.contentType) {
        store.addQuad(
          distributionUrl,
          namedNode(`${SCHEMA}encodingFormat`),
          literal(result.contentType)
        );
      }
    }
  }

  private addImportError(store: Store, importResult: ImportFailed): void {
    // Find the action for this download URL and add the error
    const matches = store.match(
      null,
      namedNode(`${SCHEMA}target`),
      namedNode(importResult.distribution.accessUrl.toString())
    );
    for (const match of matches) {
      store.addQuad(
        match.subject,
        namedNode(`${SCHEMA}error`),
        literal(importResult.error)
      );
    }
  }
}
