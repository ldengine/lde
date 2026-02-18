import { Dataset, Distribution } from '@lde/dataset';
import type { ImportFailed } from '@lde/sparql-importer';
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
  timeout?: number;
}

/**
 * Resolves a dataset to a usable SPARQL distribution by probing its distributions.
 *
 * 1. Probes all distributions in parallel.
 * 2. Returns the first valid SPARQL endpoint as a `ResolvedDistribution`.
 * 3. If none: returns `NoDistributionAvailable`.
 *
 * Does not mutate `dataset.distributions`.
 */
export class SparqlDistributionResolver implements DistributionResolver {
  private readonly timeout: number;

  constructor(options?: SparqlDistributionResolverOptions) {
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

    return new NoDistributionAvailable(
      dataset,
      'No SPARQL endpoint available',
      results,
    );
  }
}
