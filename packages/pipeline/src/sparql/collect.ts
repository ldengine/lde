import { Store } from 'n3';
import type { QuadStream } from './executor.js';

/**
 * Collect all quads from a stream into an N3 Store.
 *
 * @param stream The quad stream to collect from.
 * @returns Promise that resolves to a Store containing all quads.
 *
 * @example
 * ```typescript
 * const result = await executor.execute(dataset);
 * if (!(result instanceof NotSupported)) {
 *   const store = await collect(result);
 *   console.log(`Collected ${store.size} quads`);
 * }
 * ```
 */
export async function collect(stream: QuadStream): Promise<Store> {
  const store = new Store();
  for await (const quad of stream) {
    store.addQuad(quad);
  }
  return store;
}
