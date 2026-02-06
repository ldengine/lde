import { collect } from '../../src/sparql/index.js';
import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

describe('collect', () => {
  it('collects quads from stream into Store', async () => {
    const stream = new Readable({
      objectMode: true,
      read() {
        /* no-op */
      },
    });
    stream.push(
      quad(
        namedNode('http://example.org/s1'),
        namedNode('http://example.org/p'),
        literal('o1')
      )
    );
    stream.push(
      quad(
        namedNode('http://example.org/s2'),
        namedNode('http://example.org/p'),
        literal('o2')
      )
    );
    stream.push(null);

    const store = await collect(stream);

    expect(store.size).toBe(2);
    expect(
      store.has(
        quad(
          namedNode('http://example.org/s1'),
          namedNode('http://example.org/p'),
          literal('o1')
        )
      )
    ).toBe(true);
  });

  it('returns empty store for empty stream', async () => {
    const stream = new Readable({
      objectMode: true,
      read() {
        /* no-op */
      },
    });
    stream.push(null);

    const store = await collect(stream);

    expect(store.size).toBe(0);
  });
});
