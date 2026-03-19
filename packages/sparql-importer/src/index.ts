import { Distribution } from '@lde/dataset';

/**
 * An Importer selects a suitable {@link Distribution} from the given candidates
 * and imports it to a SPARQL server.
 *
 * This assumes that all Distributions of a dataset are roughly equivalent:
 * https://docs.nde.nl/requirements-datasets/#dataset-distributions.
 */
// export interface Importer extends EventEmitter<Events> {
export interface Importer {
  /**
   * Import one of the given {@link Distribution}s to a SPARQL server.
   *
   * The importer picks the first distribution whose format it supports,
   * downloads it, and indexes it. Returns {@link NotSupported} when none of
   * the distributions use a supported format.
   */
  import(
    distributions: Distribution[],
  ): Promise<NotSupported | ImportFailed | ImportSuccessful>;
}

// interface Events {
//   imported: [statements: number];
//   end: [statements: number];
// }

export class ImportSuccessful {
  constructor(
    public readonly distribution: Distribution,
    public readonly identifier?: string,
    public readonly tripleCount?: number,
  ) {}
}

export class ImportFailed {
  constructor(
    public readonly distribution: Distribution,
    public readonly error: string,
  ) {}
}

export class NotSupported {
  constructor(public readonly distribution?: Distribution) {}
}
