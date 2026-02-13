import { describe, it, expect } from 'vitest';
import { parseRdfToJsonLd } from '../src/parse.js';
import { resolve } from 'path';

describe('parseRdfToJsonLd', () => {
  it('should parse SHACL Turtle file to JSON-LD string', async () => {
    const filePath = resolve('./test/fixtures/shacl.ttl');
    const shapes = await parseRdfToJsonLd(filePath);
    expect(shapes.length).toBe(12);
  });
});
