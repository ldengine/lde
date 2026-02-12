import { Dataset } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';

/**
 * Interface for writing RDF data to a destination.
 */
export interface Writer {
  /**
   * Write RDF data for a dataset to the destination.
   *
   * @param dataset The dataset metadata
   * @param quads The RDF quads to write
   */
  write(dataset: Dataset, quads: AsyncIterable<Quad>): Promise<void>;
}
