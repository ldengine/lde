import { Dataset, Distribution } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import type {
  Executor,
  ExecuteOptions,
  VariableBindings,
} from './sparql/executor.js';
import { NotSupported } from './sparql/executor.js';

export interface StageOptions {
  name: string;
  executors: Executor | Executor[];
  selector?: StageSelector;
}

export class Stage {
  readonly name: string;
  private readonly executors: Executor[];
  private readonly selector?: StageSelector;

  constructor(options: StageOptions) {
    this.name = options.name;
    this.executors = Array.isArray(options.executors)
      ? options.executors
      : [options.executors];
    this.selector = options.selector;
  }

  async run(
    dataset: Dataset,
    distribution: Distribution
  ): Promise<AsyncIterable<Quad> | NotSupported> {
    const bindings = await this.collectBindings();
    const executeOptions: ExecuteOptions | undefined =
      bindings.length > 0 ? { bindings } : undefined;

    const streams: AsyncIterable<Quad>[] = [];

    for (const executor of this.executors) {
      const result = await executor.execute(
        dataset,
        distribution,
        executeOptions
      );
      if (!(result instanceof NotSupported)) {
        streams.push(result);
      }
    }

    if (streams.length === 0) {
      return new NotSupported('All executors returned NotSupported');
    }

    return mergeStreams(streams);
  }

  private async collectBindings(): Promise<VariableBindings[]> {
    if (this.selector === undefined) {
      return [];
    }

    const bindings: VariableBindings[] = [];
    for await (const row of this.selector) {
      bindings.push(row);
    }
    return bindings;
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
