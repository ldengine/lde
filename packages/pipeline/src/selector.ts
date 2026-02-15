import { Dataset } from '@lde/dataset';
import { Client, Paginator } from '@lde/dataset-registry-client';

/**
 * Select {@link Dataset}s for processing in a pipeline.
 */
export interface DatasetSelector {
  select(): Promise<Paginator<Dataset>>;
}

export class ManualDatasetSelection implements DatasetSelector {
  constructor(private readonly datasets: Dataset[]) {}

  async select(): Promise<Paginator<Dataset>> {
    return new Paginator(async () => this.datasets, this.datasets.length);
  }
}

/**
 * Select Datasets from a Dataset Registry.
 *
 *
 *
 * @example
 * ```typescript
 *
 * ```
 *
 * @param {object} options
 * @param Client options.registry The Dataset Registry Client to query for datasets.
 * @param string options.query Optional custom SPARQL query to select datasets.
 * @param object options.criteria Optional search criteria to select datasets.
 */
export class RegistrySelector implements DatasetSelector {
  private readonly registry: Client;
  private readonly query?: string;
  private readonly criteria?: object;

  constructor({
    registry,
    query,
    criteria,
  }: {
    registry: Client;
    query?: string;
    criteria?: object;
  }) {
    this.registry = registry;
    this.query = query;
    this.criteria = criteria;
  }

  async select() {
    if (this.query) {
      return this.registry.query(this.query);
    } else {
      return this.registry.query(this.criteria ?? {});
    }
  }
}
