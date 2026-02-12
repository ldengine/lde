import { Dataset, Distribution } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import type { Executor, VariableBindings } from './sparql/executor.js';
import { NotSupported } from './sparql/executor.js';
import { batch } from './batch.js';
import type { Writer } from './writer/writer.js';

export interface StageOptions {
  name: string;
  executors: Executor | Executor[];
  selector?: StageSelector;
  /** Maximum number of bindings per executor call. @default 10 */
  batchSize?: number;
}

export class Stage {
  readonly name: string;
  private readonly executors: Executor[];
  private readonly selector?: StageSelector;
  private readonly batchSize: number;

  constructor(options: StageOptions) {
    this.name = options.name;
    this.executors = Array.isArray(options.executors)
      ? options.executors
      : [options.executors];
    this.selector = options.selector;
    this.batchSize = options.batchSize ?? 10;
  }

  async run(
    dataset: Dataset,
    distribution: Distribution,
    writer: Writer
  ): Promise<NotSupported | void> {
    const streams = this.selector
      ? await this.executeWithSelector(dataset, distribution)
      : await this.executeAll(dataset, distribution);

    if (streams instanceof NotSupported) {
      return streams;
    }

    await writer.write(dataset, mergeStreams(streams));
  }

  private async executeWithSelector(
    dataset: Dataset,
    distribution: Distribution
  ): Promise<AsyncIterable<Quad>[] | NotSupported> {
    const streams: AsyncIterable<Quad>[] = [];
    for await (const bindings of batch(this.selector!, this.batchSize)) {
      for (const executor of this.executors) {
        const result = await executor.execute(dataset, distribution, {
          bindings,
        });
        if (!(result instanceof NotSupported)) {
          streams.push(result);
        }
      }
    }

    if (streams.length === 0) {
      return new NotSupported('All executors returned NotSupported');
    }

    return streams;
  }

  private async executeAll(
    dataset: Dataset,
    distribution: Distribution
  ): Promise<AsyncIterable<Quad>[] | NotSupported> {
    const streams: AsyncIterable<Quad>[] = [];
    for (const executor of this.executors) {
      const result = await executor.execute(dataset, distribution);
      if (!(result instanceof NotSupported)) {
        streams.push(result);
      }
    }

    if (streams.length === 0) {
      return new NotSupported('All executors returned NotSupported');
    }

    return streams;
  }
}

async function* mergeStreams(
  streams: AsyncIterable<Quad>[]
): AsyncIterable<Quad> {
  for (const stream of streams) {
    yield* stream;
  }
}

/** Stage-level selector that yields variable bindings for use in executor queries. Pagination is an implementation detail. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface StageSelector extends AsyncIterable<VariableBindings> {}
