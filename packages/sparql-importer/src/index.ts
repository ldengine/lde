import { Dataset, Distribution } from '@lde/dataset';

/**
 * An Importer takes a {@link Dataset}, selects a suitable {@link Distribution}
 * and imports it to a SPARQL server.
 *
 * This assumes that all Distributions of the Dataset are roughly equivalent:
 * https://docs.nde.nl/requirements-datasets/#dataset-distributions.
 */
export interface Importer {
  /**
   * Import a {@link Dataset} to a SPARQL server.
   */
  import(dataset: Dataset): Promise<ImportResult>;
}

/** Discriminated union of all possible import outcomes. */
export type ImportResult = ImportSuccessful | ImportFailed | NotSupported;

/** The distribution was successfully imported. */
export interface ImportSuccessful {
  readonly type: 'successful';
  readonly distribution: Distribution;
  readonly identifier?: string;
}

/** The import was attempted but failed. */
export interface ImportFailed {
  readonly type: 'failed';
  readonly distribution: Distribution;
  readonly error: string;
}

/** The importer does not support this dataset's distributions. */
export interface NotSupported {
  readonly type: 'not-supported';
  readonly distribution?: Distribution;
}
