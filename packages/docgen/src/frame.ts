import type { JsonLdArray } from 'jsonld/jsonld-spec.js';
import jsonld from 'jsonld';
import { readFile } from 'node:fs/promises';

export async function frame(document: JsonLdArray, frame: string) {
  return await jsonld.frame(
    document,
    JSON.parse(await readFile(frame, 'utf8')),
    {
      omitGraph: false,
    }
  );
}
