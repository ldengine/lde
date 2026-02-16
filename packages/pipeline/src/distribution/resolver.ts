import { Dataset, Distribution } from '@lde/dataset';
import type { Importer } from '@lde/sparql-importer';
import { ImportFailed, ImportSuccessful } from '@lde/sparql-importer';
import type { SparqlServer } from '@lde/sparql-server';
import { probe, SparqlProbeResult, type ProbeResultType } from './probe.js';

export class ResolvedDistribution {
  constructor(
    readonly distribution: Distribution,
    readonly probeResults: ProbeResultType[],
  ) {}
}

export class NoDistributionAvailable {
  constructor(
    readonly dataset: Dataset,
    readonly message: string,
    readonly probeResults: ProbeResultType[],
    readonly importFailed?: ImportFailed,
  ) {}
}

export interface DistributionResolver {
  resolve(
    dataset: Dataset,
  ): Promise<ResolvedDistribution | NoDistributionAvailable>;
  cleanup?(): Promise<void>;
}

export interface SparqlDistributionResolverOptions {
  importer?: Importer;
  server?: SparqlServer;
  timeout?: number;
}

/**
 * Resolves a dataset to a usable SPARQL distribution by probing its distributions.
 *
 * 1. Probes all distributions in parallel.
 * 2. Returns the first valid SPARQL endpoint as a `ResolvedDistribution`.
 * 3. If none: tries the importer (if provided) and returns the imported distribution.
 * 4. If nothing works: returns `NoDistributionAvailable`.
 *
 * Does not mutate `dataset.distributions`.
 */
export class SparqlDistributionResolver implements DistributionResolver {
  private readonly importer?: Importer;
  private readonly server?: SparqlServer;
  private readonly timeout: number;

  constructor(options?: SparqlDistributionResolverOptions) {
    this.importer = options?.importer;
    this.server = options?.server;
    this.timeout = options?.timeout ?? 5000;
  }

  async resolve(
    dataset: Dataset,
  ): Promise<ResolvedDistribution | NoDistributionAvailable> {
    const results = await Promise.all(
      dataset.distributions.map((distribution) =>
        probe(distribution, this.timeout),
      ),
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
        return new ResolvedDistribution(distribution, results);
      }
    }

    // No SPARQL endpoint; try importer if available.
    if (this.importer) {
      const importResult = await this.importer.import(dataset);
      if (importResult instanceof ImportSuccessful) {
        // Start server if provided, using its query endpoint.
        if (this.server) {
          await this.server.start();
          const distribution = Distribution.sparql(
            this.server.queryEndpoint,
            importResult.identifier,
          );
          return new ResolvedDistribution(distribution, results);
        }

        const distribution = Distribution.sparql(
          importResult.distribution.accessUrl,
          importResult.identifier,
        );
        return new ResolvedDistribution(distribution, results);
      }
      if (importResult instanceof ImportFailed) {
        return new NoDistributionAvailable(
          dataset,
          'No SPARQL endpoint or importable data dump available',
          results,
          importResult,
        );
      }
    }

    return new NoDistributionAvailable(
      dataset,
      'No SPARQL endpoint or importable data dump available',
      results,
    );
  }

  async cleanup(): Promise<void> {
    await this.server?.stop();
  }
}
