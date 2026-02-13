import { describe, it, expect } from 'vitest';
import { AsyncQueue } from '../src/asyncQueue.js';

describe('AsyncQueue', () => {
  it('delivers items in order and ends after close', async () => {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    queue.push(2);
    queue.push(3);
    queue.close();

    const items: number[] = [];
    for await (const item of queue) {
      items.push(item);
    }
    expect(items).toEqual([1, 2, 3]);
  });

  it('ends immediately when closed with no items', async () => {
    const queue = new AsyncQueue<number>();
    queue.close();

    const items: number[] = [];
    for await (const item of queue) {
      items.push(item);
    }
    expect(items).toEqual([]);
  });

  it('applies backpressure when buffer is full', async () => {
    const queue = new AsyncQueue<number>(2);
    let pushResolved = false;

    // Fill the buffer.
    await queue.push(1);
    await queue.push(2);

    // Third push should block.
    const pushPromise = queue.push(3).then(() => {
      pushResolved = true;
    });

    // Let microtasks run — push should still be blocked.
    await Promise.resolve();
    expect(pushResolved).toBe(false);

    // Pull one item to free space.
    const iter = queue[Symbol.asyncIterator]();
    const first = await iter.next();
    expect(first).toEqual({ value: 1, done: false });

    // Now the blocked push should resolve.
    await pushPromise;
    expect(pushResolved).toBe(true);

    // Drain remaining and close.
    queue.close();
    const second = await iter.next();
    expect(second).toEqual({ value: 2, done: false });
    const third = await iter.next();
    expect(third).toEqual({ value: 3, done: false });
    const done = await iter.next();
    expect(done).toEqual({ value: undefined, done: true });
  });

  it('propagates abort error to consumer', async () => {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    queue.abort(new Error('boom'));

    const iter = queue[Symbol.asyncIterator]();
    // Buffered item is delivered first.
    const first = await iter.next();
    expect(first).toEqual({ value: 1, done: false });

    // Next pull rejects with the abort error.
    await expect(iter.next()).rejects.toThrow('boom');
  });

  it('unblocks waiting producers on abort', async () => {
    const queue = new AsyncQueue<number>(1);
    await queue.push(1);

    // This push blocks because buffer is full.
    const pushPromise = queue.push(2);
    queue.abort(new Error('cancelled'));

    await expect(pushPromise).rejects.toThrow('cancelled');
  });

  it('throws on push after close', async () => {
    const queue = new AsyncQueue<number>();
    queue.close();

    await expect(queue.push(1)).rejects.toThrow(
      'Cannot push to a closed queue'
    );
  });

  it('throws on push after abort', async () => {
    const queue = new AsyncQueue<number>();
    queue.abort(new Error('aborted'));

    await expect(queue.push(1)).rejects.toThrow('aborted');
  });
});
