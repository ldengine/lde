/**
 * A bounded async channel: producers `push()` items, a single consumer
 * iterates with `for await...of`. Backpressure is applied when the buffer
 * reaches `capacity` — `push()` will block until the consumer pulls.
 */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private buffer: T[] = [];
  private readonly capacity: number;
  private closed = false;
  private error: unknown = undefined;

  /** Resolvers for a blocked consumer waiting for data or close/abort. */
  private consumerResolve?: (value: IteratorResult<T, undefined>) => void;
  private consumerReject?: (reason: unknown) => void;

  /** Resolvers for blocked producers waiting for buffer space. */
  private producerResolvers: Array<{
    resolve: () => void;
    reject: (reason: unknown) => void;
  }> = [];

  constructor(capacity = 128) {
    this.capacity = capacity;
  }

  /**
   * Push an item into the queue. Blocks (returns a Promise) when the buffer
   * is full. Throws if the queue has been closed or aborted.
   */
  async push(item: T): Promise<void> {
    if (this.error !== undefined) {
      throw this.error;
    }
    if (this.closed) {
      throw new Error('Cannot push to a closed queue');
    }

    // If a consumer is already waiting, deliver directly.
    if (this.consumerResolve) {
      const resolve = this.consumerResolve;
      this.consumerResolve = undefined;
      this.consumerReject = undefined;
      resolve({ value: item, done: false });
      return;
    }

    // Wait for space if buffer is at capacity.
    if (this.buffer.length >= this.capacity) {
      await new Promise<void>((resolve, reject) => {
        this.producerResolvers.push({ resolve, reject });
      });
    }

    this.buffer.push(item);
  }

  /** Signal that no more items will be pushed. */
  close(): void {
    if (this.closed) return;
    this.closed = true;

    // Wake a waiting consumer with done signal if buffer is empty.
    if (this.buffer.length === 0 && this.consumerResolve) {
      const resolve = this.consumerResolve;
      this.consumerResolve = undefined;
      this.consumerReject = undefined;
      resolve({ value: undefined, done: true });
    }
  }

  /** Signal an error. Unblocks all waiting producers and the consumer. */
  abort(error: unknown): void {
    if (this.error !== undefined) return; // first error wins
    this.error = error;
    this.closed = true;

    // Reject all blocked producers.
    for (const { reject } of this.producerResolvers) {
      reject(error);
    }
    this.producerResolvers = [];

    // Reject or resolve the consumer depending on buffered items.
    if (this.consumerReject) {
      const reject = this.consumerReject;
      this.consumerResolve = undefined;
      this.consumerReject = undefined;
      reject(error);
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T, undefined> {
    return {
      next: () => this.pull(),
    };
  }

  private pull(): Promise<IteratorResult<T, undefined>> {
    // Drain buffer first.
    if (this.buffer.length > 0) {
      const item = this.buffer.shift()!;

      // Unblock one waiting producer.
      if (this.producerResolvers.length > 0) {
        this.producerResolvers.shift()!.resolve();
      }

      return Promise.resolve({ value: item, done: false });
    }

    // Buffer empty — check for error or closed.
    if (this.error !== undefined) {
      return Promise.reject(this.error);
    }
    if (this.closed) {
      return Promise.resolve({ value: undefined, done: true });
    }

    // Wait for a producer to push or for close/abort.
    return new Promise((resolve, reject) => {
      this.consumerResolve = resolve;
      this.consumerReject = reject;
    });
  }
}
