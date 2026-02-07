import { Dataset } from '@lde/dataset';
import type { DatasetCore } from '@rdfjs/types';
import { NotSupported } from './step.js';

export { NotSupported } from './step.js';

/**
 * Result of a successful analysis.
 */
export class Success {
  constructor(public readonly data: DatasetCore) {}
}

/**
 * Analysis failed.
 */
export class Failure {
  constructor(
    public readonly endpoint: URL,
    public readonly message?: string
  ) {}
}

/**
 * Interface for analyzers.
 */
export interface Analyzer {
  readonly name: string;
  execute(dataset: Dataset): Promise<Success | Failure | NotSupported>;
  finish?(): Promise<void>;
}

/**
 * Base class for analyzers with default implementations.
 */
export abstract class BaseAnalyzer implements Analyzer {
  abstract readonly name: string;
  abstract execute(dataset: Dataset): Promise<Success | Failure | NotSupported>;

  async finish(): Promise<void> {
    // Default no-op implementation.
  }
}
