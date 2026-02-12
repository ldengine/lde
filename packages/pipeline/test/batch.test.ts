import { describe, it, expect } from 'vitest';
import { batch } from '../src/batch.js';

async function* fromArray<T>(items: T[]): AsyncIterable<T> {
  yield* items;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) {
    result.push(item);
  }
  return result;
}

describe('batch', () => {
  it('batches items into groups of the specified size', async () => {
    const result = await collect(batch(fromArray([1, 2, 3, 4]), 2));
    expect(result).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('yields a partial final batch when items do not divide evenly', async () => {
    const result = await collect(batch(fromArray([1, 2, 3, 4, 5]), 2));
    expect(result).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('yields nothing for an empty iterable', async () => {
    const result = await collect(batch(fromArray([]), 3));
    expect(result).toEqual([]);
  });

  it('yields single-item batches when size is 1', async () => {
    const result = await collect(batch(fromArray([1, 2, 3]), 1));
    expect(result).toEqual([[1], [2], [3]]);
  });
});
