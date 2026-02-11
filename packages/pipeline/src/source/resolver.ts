import { Dataset, Distribution } from '@lde/dataset';
import type { Importer } from '@lde/sparql-importer';
import { ImportSuccessful } from '@lde/sparql-importer';
import { probe, SparqlProbeResult } from '../distribution/probe.js';

export class ResolvedSource {
  constructor(readonly distribution: Distribution) {}
}

export class NotAvailable {
  constructor(readonly dataset: Dataset, readonly message: string) {}
}

export interface SourceResolver {
  resolve(dataset: Dataset): Promise<ResolvedSource | NotAvailable>;
}

export interface DatasetSourceResolverOptions {
  importer?: Importer;
  timeout?: number;
}

/**
 * Resolves a dataset to a usable SPARQL distribution by probing its distributions.
 *
 * 1. Probes all distributions in parallel.
 * 2. Returns the first valid SPARQL endpoint as a `ResolvedSource`.
 * 3. If none: tries the importer (if provided) and returns the imported distribution.
 * 4. If nothing works: returns `NotAvailable`.
 *
 * Does not mutate `dataset.distributions`.
 */
export class DatasetSourceResolver implements SourceResolver {
  private readonly importer?: Importer;
  private readonly timeout: number;

  constructor(options?: DatasetSourceResolverOptions) {
    this.importer = options?.importer;
    this.timeout = options?.timeout ?? 5000;
  }

  async resolve(dataset: Dataset): Promise<ResolvedSource | NotAvailable> {
    const results = await Promise.all(
      dataset.distributions.map((distribution) =>
        probe(distribution, this.timeout)
      )
    );

    // Find first valid SPARQL endpoint.
    for (let i = 0; i < dataset.distributions.length; i++) {
      const distribution = dataset.distributions[i];
      const result = results[i];

      if (
        distribution.isSparql() &&
        result instanceof SparqlProbeResult &&
        result.isSuccess()
      ) {
        return new ResolvedSource(distribution);
      }
    }

    // No SPARQL endpoint; try importer if available.
    if (this.importer) {
      const importResult = await this.importer.import(dataset);
      if (importResult instanceof ImportSuccessful) {
        const distribution = Distribution.sparql(
          importResult.distribution.accessUrl,
          importResult.identifier
        );
        return new ResolvedSource(distribution);
      }
    }

    return new NotAvailable(
      dataset,
      'No SPARQL endpoint or importable data dump available'
    );
  }
}
