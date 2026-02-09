import type { Quad } from '@rdfjs/types';
import type { ExecutableDataset, Executor } from './sparql/executor.js';
import { NotSupported } from './sparql/executor.js';

export interface StageOptions {
  name: string;
  executors: Executor | Executor[];
}

export class Stage {
  readonly name: string;
  private readonly executors: Executor[];

  constructor(options: StageOptions) {
    this.name = options.name;
    this.executors = Array.isArray(options.executors)
      ? options.executors
      : [options.executors];
  }

  async run(
    dataset: ExecutableDataset
  ): Promise<AsyncIterable<Quad> | NotSupported> {
    const streams: AsyncIterable<Quad>[] = [];

    for (const executor of this.executors) {
      const result = await executor.execute(dataset);
      if (!(result instanceof NotSupported)) {
        streams.push(result);
      }
    }

    if (streams.length === 0) {
      return new NotSupported('All executors returned NotSupported');
    }

    return mergeStreams(streams);
  }
}

async function* mergeStreams(
  streams: AsyncIterable<Quad>[]
): AsyncIterable<Quad> {
  for (const stream of streams) {
    yield* stream;
  }
}
