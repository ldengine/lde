import { describe, it, expect } from 'vitest';
import { DataFactory } from 'n3';
import type { Quad } from '@rdfjs/types';
import { Stage } from '../src/stage.js';
import type { Executor, ExecutableDataset } from '../src/sparql/executor.js';
import { NotSupported } from '../src/sparql/executor.js';
import { Dataset } from '@lde/dataset';

const { namedNode, quad } = DataFactory;

const q1 = quad(
  namedNode('http://example.org/s1'),
  namedNode('http://example.org/p'),
  namedNode('http://example.org/o1')
);
const q2 = quad(
  namedNode('http://example.org/s2'),
  namedNode('http://example.org/p'),
  namedNode('http://example.org/o2')
);
const q3 = quad(
  namedNode('http://example.org/s3'),
  namedNode('http://example.org/p'),
  namedNode('http://example.org/o3')
);

function mockExecutor(quads: Quad[]): Executor {
  return {
    async execute(): Promise<AsyncIterable<Quad> | NotSupported> {
      return (async function* () {
        yield* quads;
      })();
    },
  };
}

function notSupportedExecutor(message = 'not supported'): Executor {
  return {
    async execute(): Promise<AsyncIterable<Quad> | NotSupported> {
      return new NotSupported(message);
    },
  };
}

const dataset: ExecutableDataset = new Dataset({
  iri: new URL('http://example.org/dataset'),
  distributions: [],
});

async function collectQuads(iterable: AsyncIterable<Quad>): Promise<Quad[]> {
  const result: Quad[] = [];
  for await (const quad of iterable) {
    result.push(quad);
  }
  return result;
}

describe('Stage', () => {
  it('yields quads from a single executor', async () => {
    const stage = new Stage({
      name: 'test',
      executors: mockExecutor([q1, q2]),
    });

    const result = await stage.run(dataset);
    expect(result).not.toBeInstanceOf(NotSupported);

    const quads = await collectQuads(result as AsyncIterable<Quad>);
    expect(quads).toEqual([q1, q2]);
  });

  it('returns NotSupported when single executor returns NotSupported', async () => {
    const stage = new Stage({
      name: 'test',
      executors: notSupportedExecutor(),
    });

    const result = await stage.run(dataset);
    expect(result).toBeInstanceOf(NotSupported);
    expect((result as NotSupported).message).toBe(
      'All executors returned NotSupported'
    );
  });

  it('yields all quads merged from multiple executors', async () => {
    const stage = new Stage({
      name: 'test',
      executors: [mockExecutor([q1]), mockExecutor([q2, q3])],
    });

    const result = await stage.run(dataset);
    expect(result).not.toBeInstanceOf(NotSupported);

    const quads = await collectQuads(result as AsyncIterable<Quad>);
    expect(quads).toEqual([q1, q2, q3]);
  });

  it('yields quads only from successful executors when some return NotSupported', async () => {
    const stage = new Stage({
      name: 'test',
      executors: [
        notSupportedExecutor(),
        mockExecutor([q1, q2]),
        notSupportedExecutor(),
      ],
    });

    const result = await stage.run(dataset);
    expect(result).not.toBeInstanceOf(NotSupported);

    const quads = await collectQuads(result as AsyncIterable<Quad>);
    expect(quads).toEqual([q1, q2]);
  });

  it('returns NotSupported when all executors return NotSupported', async () => {
    const stage = new Stage({
      name: 'test',
      executors: [notSupportedExecutor('a'), notSupportedExecutor('b')],
    });

    const result = await stage.run(dataset);
    expect(result).toBeInstanceOf(NotSupported);
    expect((result as NotSupported).message).toBe(
      'All executors returned NotSupported'
    );
  });
});
