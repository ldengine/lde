import type { Quad } from '@rdfjs/types';
import { Writer as N3Writer } from 'n3';

export type SerializationFormat = 'Turtle' | 'N-Triples' | 'N-Quads';

/**
 * Serialize quads to a string using N3.
 */
export function serializeQuads(
  quads: Quad[],
  format: SerializationFormat
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new N3Writer({ format });
    for (const quad of quads) {
      writer.addQuad(quad);
    }
    writer.end((error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}
