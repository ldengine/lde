import { Distribution } from '@lde/dataset';
import type { Importer } from '@lde/sparql-importer';
import { ImportFailed, ImportSuccessful } from '@lde/sparql-importer';
import type { SparqlServer } from '@lde/sparql-server';
import {
  type DistributionResolver,
  NoDistributionAvailable,
  ResolvedDistribution,
} from './resolver.js';

export interface ImportResolverOptions {
  importer: Importer;
  server?: SparqlServer;
}

/**
 * A {@link DistributionResolver} decorator that adds import-as-fallback logic.
 *
 * Delegates to an inner resolver first. If the inner resolver returns
 * {@link NoDistributionAvailable}, tries importing the dataset and optionally
 * starts a SPARQL server.
 */
export class ImportResolver implements DistributionResolver {
  constructor(
    private readonly inner: DistributionResolver,
    private readonly options: ImportResolverOptions,
  ) {}

  async resolve(
    ...args: Parameters<DistributionResolver['resolve']>
  ): Promise<ResolvedDistribution | NoDistributionAvailable> {
    const result = await this.inner.resolve(...args);
    if (result instanceof ResolvedDistribution) return result;

    const [dataset] = args;
    const importResult = await this.options.importer.import(dataset);

    if (importResult instanceof ImportSuccessful) {
      if (this.options.server) {
        await this.options.server.start();
        return new ResolvedDistribution(
          Distribution.sparql(
            this.options.server.queryEndpoint,
            importResult.identifier,
          ),
          result.probeResults,
        );
      }

      return new ResolvedDistribution(
        Distribution.sparql(
          importResult.distribution.accessUrl,
          importResult.identifier,
        ),
        result.probeResults,
      );
    }

    return new NoDistributionAvailable(
      dataset,
      'No SPARQL endpoint or importable data dump available',
      result.probeResults,
      importResult instanceof ImportFailed ? importResult : undefined,
    );
  }

  async cleanup(): Promise<void> {
    await this.options.server?.stop();
  }
}
