import { Dataset, Distribution } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import type { Executor, VariableBindings } from './sparql/executor.js';
import { NotSupported } from './sparql/executor.js';
import { batch } from './batch.js';
import type { Writer } from './writer/writer.js';
import { AsyncQueue } from './asyncQueue.js';

export interface StageOptions {
  name: string;
  executors: Executor | Executor[];
  selector?: StageSelector;
  /** Maximum number of bindings per executor call. @default 10 */
  batchSize?: number;
  /** Maximum concurrent in-flight executor batches. @default 10 */
  maxConcurrency?: number;
}

export interface RunOptions {
  onProgress?: (elementsProcessed: number, quadsGenerated: number) => void;
}

export class Stage {
  readonly name: string;
  private readonly executors: Executor[];
  private readonly selector?: StageSelector;
  private readonly batchSize: number;
  private readonly maxConcurrency: number;

  constructor(options: StageOptions) {
    this.name = options.name;
    this.executors = Array.isArray(options.executors)
      ? options.executors
      : [options.executors];
    this.selector = options.selector;
    this.batchSize = options.batchSize ?? 10;
    this.maxConcurrency = options.maxConcurrency ?? 10;
  }

  async run(
    dataset: Dataset,
    distribution: Distribution,
    writer: Writer,
    options?: RunOptions
  ): Promise<NotSupported | void> {
    if (this.selector) {
      return this.runWithSelector(dataset, distribution, writer, options);
    }

    const streams = await this.executeAll(dataset, distribution);
    if (streams instanceof NotSupported) {
      return streams;
    }

    await writer.write(dataset, mergeStreams(streams));
  }

  private async runWithSelector(
    dataset: Dataset,
    distribution: Distribution,
    writer: Writer,
    options?: RunOptions
  ): Promise<NotSupported | void> {
    // Peek the first batch to detect an empty selector before starting the
    // writer (important because e.g. SparqlUpdateWriter does CLEAR GRAPH).
    const batches = batch(this.selector!, this.batchSize);
    const iter = batches[Symbol.asyncIterator]();
    const first = await iter.next();
    if (first.done) {
      return new NotSupported('All executors returned NotSupported');
    }

    // Reconstruct a full iterable including the peeked first batch.
    const allBatches: AsyncIterable<VariableBindings[]> = (async function* () {
      yield first.value;
      // Continue yielding remaining batches from the same iterator.
      for (;;) {
        const next = await iter.next();
        if (next.done) break;
        yield next.value;
      }
    })();

    const queue = new AsyncQueue<Quad>();
    let elementsProcessed = 0;
    let quadsGenerated = 0;
    let hasResults = false;

    const dispatch = async () => {
      const inFlight = new Set<Promise<void>>();
      let firstError: unknown;

      const track = (promise: Promise<void>) => {
        const p = promise.then(
          () => {
            inFlight.delete(p);
          },
          (err: unknown) => {
            inFlight.delete(p);
            firstError ??= err;
          }
        );
        inFlight.add(p);
      };

      try {
        for await (const bindings of allBatches) {
          if (firstError) break;

          for (const executor of this.executors) {
            if (firstError) break;

            // Respect maxConcurrency: wait for a slot to open.
            if (inFlight.size >= this.maxConcurrency) {
              await Promise.race(inFlight);
              if (firstError) break;
            }

            track(
              (async () => {
                const result = await executor.execute(dataset, distribution, {
                  bindings,
                });
                if (!(result instanceof NotSupported)) {
                  hasResults = true;
                  for await (const quad of result) {
                    await queue.push(quad);
                    quadsGenerated++;
                  }
                }
                elementsProcessed += bindings.length;
                options?.onProgress?.(elementsProcessed, quadsGenerated);
              })()
            );
          }
        }
      } catch (err) {
        firstError ??= err;
      }

      // Wait for all remaining in-flight tasks to settle.
      await Promise.all(inFlight);

      if (firstError) {
        queue.abort(firstError);
      } else {
        queue.close();
      }
    };

    const dispatchPromise = dispatch();
    const writePromise = (async () => {
      try {
        await writer.write(dataset, queue);
      } catch (err) {
        queue.abort(err);
        throw err;
      }
    })();

    await Promise.all([dispatchPromise, writePromise]);

    if (!hasResults) {
      return new NotSupported('All executors returned NotSupported');
    }
  }

  private async executeAll(
    dataset: Dataset,
    distribution: Distribution
  ): Promise<AsyncIterable<Quad>[] | NotSupported> {
    const results = await Promise.all(
      this.executors.map((executor) => executor.execute(dataset, distribution))
    );

    const streams: AsyncIterable<Quad>[] = [];
    for (const result of results) {
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
