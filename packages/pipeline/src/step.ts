import { Dataset, Distribution } from '@lde/dataset';
import type { Stream } from '@rdfjs/types';

interface AbstractStep {
  readonly identifier: string;
}

export type Step = DataEmittingStep | SingleStep;

/**
 * A pipeline step that returns a data-emitting stream of RDF quads.
 * Failure is expressed by emitting an error event; success by the end event.
 */
export interface DataEmittingStep extends AbstractStep {
  execute(
    dataset: Dataset,
    distribution: Distribution
  ): Promise<Stream | NotSupported>;
}

/**
 * A pipeline step that executes an operation without emitting data.
 */
export interface SingleStep extends AbstractStep {
  execute(
    dataset: Dataset,
    distribution?: Distribution
  ): Promise<NotSupported | Failure | Success>;
}

export interface Finishable {
  finish(): Promise<void>;
}

/**
 * A pipeline step failed to run.
 *
 * @param distribution The distribution that was processed.
 * @param message Optional error message.
 */
export class Failure {
  constructor(
    public readonly distribution: Distribution,
    public readonly message?: string
  ) {}
}

/**
 * A pipeline ran successfully.
 *
 * @param dataset: The dataset, with possible modifications, that was processed.
 * @param distribution The distribution that was processed.
 */
export class Success {
  constructor(
    public readonly dataset: Dataset,
    public readonly distribution: Distribution
  ) {}
}

/**
 * A pipeline step could not be run because the dataset lacks a distribution supported by the step.
 *
 * @param message: A message explaining why the step is not supported.
 */
export class NotSupported {
  constructor(public readonly message: string) {}
}
