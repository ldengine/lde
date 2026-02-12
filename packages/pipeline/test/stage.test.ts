import { describe, it, expect, vi } from 'vitest';
import { DataFactory } from 'n3';
import type { Quad } from '@rdfjs/types';
import { Stage } from '../src/stage.js';
import type { StageSelector } from '../src/stage.js';
import type { Executor, ExecuteOptions } from '../src/sparql/executor.js';
import { NotSupported } from '../src/sparql/executor.js';
import { Dataset, Distribution } from '@lde/dataset';
import type { Writer } from '../src/writer/writer.js';

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

function collectingWriter(): Writer & { quads: Quad[] } {
  const quads: Quad[] = [];
  return {
    quads,
    async write(_dataset, data) {
      for await (const quad of data) {
        quads.push(quad);
      }
    },
  };
}

const dataset = new Dataset({
  iri: new URL('http://example.org/dataset'),
  distributions: [],
});

const distribution = Distribution.sparql(new URL('http://example.org/sparql'));

describe('Stage', () => {
  it('writes quads from a single executor', async () => {
    const stage = new Stage({
      name: 'test',
      executors: mockExecutor([q1, q2]),
    });

    const writer = collectingWriter();
    const result = await stage.run(dataset, distribution, writer);
    expect(result).not.toBeInstanceOf(NotSupported);
    expect(writer.quads).toEqual([q1, q2]);
  });

  it('returns NotSupported when single executor returns NotSupported', async () => {
    const stage = new Stage({
      name: 'test',
      executors: notSupportedExecutor(),
    });

    const writer = collectingWriter();
    const result = await stage.run(dataset, distribution, writer);
    expect(result).toBeInstanceOf(NotSupported);
    expect((result as NotSupported).message).toBe(
      'All executors returned NotSupported'
    );
    expect(writer.quads).toEqual([]);
  });

  it('writes all quads merged from multiple executors', async () => {
    const stage = new Stage({
      name: 'test',
      executors: [mockExecutor([q1]), mockExecutor([q2, q3])],
    });

    const writer = collectingWriter();
    const result = await stage.run(dataset, distribution, writer);
    expect(result).not.toBeInstanceOf(NotSupported);
    expect(writer.quads).toEqual([q1, q2, q3]);
  });

  it('writes quads only from successful executors when some return NotSupported', async () => {
    const stage = new Stage({
      name: 'test',
      executors: [
        notSupportedExecutor(),
        mockExecutor([q1, q2]),
        notSupportedExecutor(),
      ],
    });

    const writer = collectingWriter();
    const result = await stage.run(dataset, distribution, writer);
    expect(result).not.toBeInstanceOf(NotSupported);
    expect(writer.quads).toEqual([q1, q2]);
  });

  it('returns NotSupported when all executors return NotSupported', async () => {
    const stage = new Stage({
      name: 'test',
      executors: [notSupportedExecutor('a'), notSupportedExecutor('b')],
    });

    const writer = collectingWriter();
    const result = await stage.run(dataset, distribution, writer);
    expect(result).toBeInstanceOf(NotSupported);
    expect((result as NotSupported).message).toBe(
      'All executors returned NotSupported'
    );
    expect(writer.quads).toEqual([]);
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

    const writer = collectingWriter();
    const result = await stage.run(dataset, distribution, writer);
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

    const writer = collectingWriter();
    const result = await stage.run(dataset, distribution, writer);
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

    const writer = collectingWriter();
    await stage.run(dataset, distribution, writer);

    expect(executor.execute).toHaveBeenCalledTimes(3);
  });

  it('returns NotSupported when selector yields nothing', async () => {
    const executor = capturingExecutor([q1]);

    const stage = new Stage({
      name: 'test',
      executors: executor,
      selector: mockSelector([]),
    });

    const writer = collectingWriter();
    const result = await stage.run(dataset, distribution, writer);
    expect(result).toBeInstanceOf(NotSupported);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('works without a selector', async () => {
    const executor = capturingExecutor([q1, q2]);

    const stage = new Stage({
      name: 'test',
      executors: executor,
    });

    const writer = collectingWriter();
    const result = await stage.run(dataset, distribution, writer);
    expect(result).not.toBeInstanceOf(NotSupported);
    expect(writer.quads).toEqual([q1, q2]);
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

    const writer = collectingWriter();
    await stage.run(dataset, namedGraphDistribution, writer);

    expect(executor.execute).toHaveBeenCalledWith(
      dataset,
      namedGraphDistribution
    );
  });
});
