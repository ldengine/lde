import { describe, it, expect, vi } from 'vitest';
import { DataFactory } from 'n3';
import type { Quad } from '@rdfjs/types';
import { Stage } from '../src/stage.js';
import type { StageSelector } from '../src/stage.js';
import type { Executor, ExecuteOptions } from '../src/sparql/executor.js';
import { NotSupported } from '../src/sparql/executor.js';
import { Dataset, Distribution } from '@lde/dataset';

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
    async execute(
      _dataset: Dataset,
      _distribution: Distribution,
      _options?: ExecuteOptions
    ): Promise<AsyncIterable<Quad> | NotSupported> {
      return (async function* () {
        yield* quads;
      })();
    },
  };
}

function capturingExecutor(quads: Quad[]): Executor & {
  execute: ReturnType<typeof vi.fn>;
} {
  const executor = {
    execute: vi.fn(
      async (
        _dataset: Dataset,
        _distribution: Distribution,
        _options?: ExecuteOptions
      ): Promise<AsyncIterable<Quad> | NotSupported> => {
        return (async function* () {
          yield* quads;
        })();
      }
    ),
  };
  return executor;
}

function notSupportedExecutor(message = 'not supported'): Executor {
  return {
    async execute(): Promise<AsyncIterable<Quad> | NotSupported> {
      return new NotSupported(message);
    },
  };
}

function mockSelector(
  rows: Record<string, ReturnType<typeof namedNode>>[]
): StageSelector {
  return {
    async *[Symbol.asyncIterator]() {
      yield* rows;
    },
  };
}

const dataset = new Dataset({
  iri: new URL('http://example.org/dataset'),
  distributions: [],
});

const distribution = Distribution.sparql(new URL('http://example.org/sparql'));

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

    const result = await stage.run(dataset, distribution);
    expect(result).not.toBeInstanceOf(NotSupported);

    const quads = await collectQuads(result as AsyncIterable<Quad>);
    expect(quads).toEqual([q1, q2]);
  });

  it('returns NotSupported when single executor returns NotSupported', async () => {
    const stage = new Stage({
      name: 'test',
      executors: notSupportedExecutor(),
    });

    const result = await stage.run(dataset, distribution);
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

    const result = await stage.run(dataset, distribution);
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

    const result = await stage.run(dataset, distribution);
    expect(result).not.toBeInstanceOf(NotSupported);

    const quads = await collectQuads(result as AsyncIterable<Quad>);
    expect(quads).toEqual([q1, q2]);
  });

  it('returns NotSupported when all executors return NotSupported', async () => {
    const stage = new Stage({
      name: 'test',
      executors: [notSupportedExecutor('a'), notSupportedExecutor('b')],
    });

    const result = await stage.run(dataset, distribution);
    expect(result).toBeInstanceOf(NotSupported);
    expect((result as NotSupported).message).toBe(
      'All executors returned NotSupported'
    );
  });

  it('passes selector bindings to executors in a single batch', async () => {
    const executor = capturingExecutor([q1]);
    const bindings = [
      { class: namedNode('http://example.org/Person') },
      { class: namedNode('http://example.org/Book') },
    ];

    const stage = new Stage({
      name: 'test',
      executors: executor,
      selector: mockSelector(bindings),
    });

    const result = await stage.run(dataset, distribution);
    expect(result).not.toBeInstanceOf(NotSupported);

    expect(executor.execute).toHaveBeenCalledOnce();
    expect(executor.execute).toHaveBeenCalledWith(dataset, distribution, {
      bindings,
    });
  });

  it('batches bindings across multiple executor calls', async () => {
    const executor = capturingExecutor([q1]);
    const bindings = [
      { class: namedNode('http://example.org/A') },
      { class: namedNode('http://example.org/B') },
      { class: namedNode('http://example.org/C') },
    ];

    const stage = new Stage({
      name: 'test',
      executors: executor,
      selector: mockSelector(bindings),
      batchSize: 2,
    });

    const result = await stage.run(dataset, distribution);
    expect(result).not.toBeInstanceOf(NotSupported);

    expect(executor.execute).toHaveBeenCalledTimes(2);
    expect(executor.execute).toHaveBeenNthCalledWith(1, dataset, distribution, {
      bindings: [bindings[0], bindings[1]],
    });
    expect(executor.execute).toHaveBeenNthCalledWith(2, dataset, distribution, {
      bindings: [bindings[2]],
    });
  });

  it('uses custom batchSize', async () => {
    const executor = capturingExecutor([q1]);
    const bindings = [
      { class: namedNode('http://example.org/A') },
      { class: namedNode('http://example.org/B') },
      { class: namedNode('http://example.org/C') },
    ];

    const stage = new Stage({
      name: 'test',
      executors: executor,
      selector: mockSelector(bindings),
      batchSize: 1,
    });

    await stage.run(dataset, distribution);

    expect(executor.execute).toHaveBeenCalledTimes(3);
  });

  it('returns NotSupported when selector yields nothing', async () => {
    const executor = capturingExecutor([q1]);

    const stage = new Stage({
      name: 'test',
      executors: executor,
      selector: mockSelector([]),
    });

    const result = await stage.run(dataset, distribution);
    expect(result).toBeInstanceOf(NotSupported);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('works without a selector (backward compatibility)', async () => {
    const executor = capturingExecutor([q1, q2]);

    const stage = new Stage({
      name: 'test',
      executors: executor,
    });

    const result = await stage.run(dataset, distribution);
    expect(result).not.toBeInstanceOf(NotSupported);

    const quads = await collectQuads(result as AsyncIterable<Quad>);
    expect(quads).toEqual([q1, q2]);
    expect(executor.execute).toHaveBeenCalledWith(dataset, distribution);
  });

  it('forwards distribution to executors', async () => {
    const executor = capturingExecutor([q1]);
    const namedGraphDistribution = Distribution.sparql(
      new URL('http://example.org/sparql'),
      'http://example.org/graph'
    );

    const stage = new Stage({
      name: 'test',
      executors: executor,
    });

    await stage.run(dataset, namedGraphDistribution);

    expect(executor.execute).toHaveBeenCalledWith(
      dataset,
      namedGraphDistribution
    );
  });
});
