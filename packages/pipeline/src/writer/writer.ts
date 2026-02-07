import { Dataset } from '@lde/dataset';
import type { DatasetCore } from '@rdfjs/types';

/**
 * Interface for writing RDF data to a destination.
 */
export interface Writer {
  /**
   * Write RDF data for a dataset to the destination.
   *
   * @param dataset The dataset metadata
   * @param data The RDF data to write
   */
  write(dataset: Dataset, data: DatasetCore): Promise<void>;
}
