import { Dataset, Distribution } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import type { Executor, VariableBindings } from './sparql/executor.js';
import { NotSupported } from './sparql/executor.js';
import { batch } from './batch.js';
import type { Validator } from './validator.js';
import type { Writer } from './writer/writer.js';
import { AsyncQueue } from './asyncQueue.js';

/** Transforms a quad stream, optionally using dataset metadata. */
export type QuadTransform = (
  quads: AsyncIterable<Quad>,
  dataset: Dataset,
) => AsyncIterable<Quad>;

export interface StageOptions {
  name: string;
  executors: Executor | Executor[];
  itemSelector?: ItemSelector;
  /** Maximum number of bindings per executor call. @default 10 */
  batchSize?: number;
  /** Maximum concurrent in-flight executor batches. @default 10 */
  maxConcurrency?: number;
  /** Child stages that chain off this stage's output. */
  stages?: Stage[];
  /** Optional validation of quads produced by each executor batch. */
  validation?: {
    validator: Validator;
    /** What to do when a batch fails validation. @default 'write' */
    onInvalid?: 'write' | 'skip' | 'halt';
  };
}

export interface RunOptions {
  onProgress?: (itemsProcessed: number, quadsGenerated: number) => void;
}

export class Stage {
  readonly name: string;
  readonly stages: readonly Stage[];
  private readonly executors: Executor[];
  private readonly itemSelector?: ItemSelector;
  private readonly batchSize: number;
  private readonly maxConcurrency: number;
  private readonly validation?: StageOptions['validation'];

  constructor(options: StageOptions) {
    this.name = options.name;
    this.stages = options.stages ?? [];
    this.executors = Array.isArray(options.executors)
      ? options.executors
      : [options.executors];
    this.itemSelector = options.itemSelector;
    this.batchSize = options.batchSize ?? 10;
    this.maxConcurrency = options.maxConcurrency ?? 10;
    this.validation = options.validation;
  }

  /** The validator for this stage, if configured. */
  get validator(): Validator | undefined {
    return this.validation?.validator;
  }

  async run(
    dataset: Dataset,
    distribution: Distribution,
    writer: Writer,
    options?: RunOptions,
  ): Promise<NotSupported | void> {
    if (this.itemSelector) {
      return this.runWithSelector(
        this.itemSelector.select(distribution),
        dataset,
        distribution,
        writer,
        options,
      );
    }

    const streams = await this.executeAll(dataset, distribution);
    if (streams instanceof NotSupported) {
      return streams;
    }

    if (this.validation) {
      const validated = this.validateStreams(streams, dataset);
      await writer.write(dataset, validated);
    } else {
      await writer.write(dataset, mergeStreams(streams));
    }
  }

  private async runWithSelector(
    selector: AsyncIterable<VariableBindings>,
    dataset: Dataset,
    distribution: Distribution,
    writer: Writer,
    options?: RunOptions,
  ): Promise<NotSupported | void> {
    // Peek the first batch to detect an empty selector before starting the
    // writer (important because e.g. SparqlUpdateWriter does CLEAR GRAPH).
    const batches = batch(selector, this.batchSize);
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
    let itemsProcessed = 0;
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
          },
        );
        inFlight.add(p);
      };

      try {
        for await (const bindings of allBatches) {
          if (firstError) break;

          for (let i = 0; i < this.executors.length; i++) {
            const executor = this.executors[i];
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
                  if (this.validation) {
                    const buffer: Quad[] = [];
                    for await (const quad of result) {
                      buffer.push(quad);
                    }
                    const v = await this.validation.validator.validate(
                      buffer,
                      dataset,
                      { executor: executor.name ?? `executor-${i}` },
                    );
                    const onInvalid = this.validation.onInvalid ?? 'write';
                    if (!v.conforms && onInvalid === 'halt') {
                      throw new Error(
                        `Validation failed: ${v.violations} violation(s)`,
                      );
                    }
                    if (v.conforms || onInvalid === 'write') {
                      for (const quad of buffer) {
                        await queue.push(quad);
                        quadsGenerated++;
                      }
                    }
                    // 'skip': buffer is discarded
                  } else {
                    for await (const quad of result) {
                      await queue.push(quad);
                      quadsGenerated++;
                    }
                  }
                }
                itemsProcessed += bindings.length;
                options?.onProgress?.(itemsProcessed, quadsGenerated);
              })(),
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

  private async *validateStreams(
    streams: AsyncIterable<Quad>[],
    dataset: Dataset,
  ): AsyncIterable<Quad> {
    for (let i = 0; i < streams.length; i++) {
      const buffer: Quad[] = [];
      for await (const quad of streams[i]) {
        buffer.push(quad);
      }
      const executor = this.executors[i];
      const v = await this.validation!.validator.validate(buffer, dataset, {
        executor: executor.name ?? `executor-${i}`,
      });
      const onInvalid = this.validation!.onInvalid ?? 'write';
      if (!v.conforms && onInvalid === 'halt') {
        throw new Error(`Validation failed: ${v.violations} violation(s)`);
      }
      if (v.conforms || onInvalid === 'write') {
        yield* buffer;
      }
      // 'skip': buffer is discarded
    }
  }

  private async executeAll(
    dataset: Dataset,
    distribution: Distribution,
  ): Promise<AsyncIterable<Quad>[] | NotSupported> {
    const results = await Promise.all(
      this.executors.map((executor) => executor.execute(dataset, distribution)),
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
  streams: AsyncIterable<Quad>[],
): AsyncIterable<Quad> {
  for (const stream of streams) {
    yield* stream;
  }
}

/** Selects items (as variable bindings) for executors to process. Pagination is an implementation detail. */
export interface ItemSelector {
  select(distribution: Distribution): AsyncIterable<VariableBindings>;
}
