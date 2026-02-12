/**
 * Groups items from an async iterable into arrays of at most `size` items.
 * Yields partial final batches.
 */
export async function* batch<T>(
  iterable: AsyncIterable<T>,
  size: number
): AsyncIterable<T[]> {
  let buffer: T[] = [];
  for await (const item of iterable) {
    buffer.push(item);
    if (buffer.length === size) {
      yield buffer;
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    yield buffer;
  }
}
