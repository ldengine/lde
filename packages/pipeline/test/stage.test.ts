import { describe, it, expect, vi } from 'vitest';
import { DataFactory } from 'n3';
import type { Quad } from '@rdfjs/types';
import { Stage } from '../src/stage.js';
import type { ItemSelector, RunOptions } from '../src/stage.js';
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

function mockItemSelector(
  rows: Record<string, ReturnType<typeof namedNode>>[]
): ItemSelector {
  return {
    async *select() {
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

  it('passes item selector bindings to executors in a single batch', async () => {
    const executor = capturingExecutor([q1]);
    const bindings = [
      { class: namedNode('http://example.org/Person') },
      { class: namedNode('http://example.org/Book') },
    ];

    const stage = new Stage({
      name: 'test',
      executors: executor,
      itemSelector: mockItemSelector(bindings),
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
      itemSelector: mockItemSelector(bindings),
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
      itemSelector: mockItemSelector(bindings),
      batchSize: 1,
    });

    const writer = collectingWriter();
    await stage.run(dataset, distribution, writer);

    expect(executor.execute).toHaveBeenCalledTimes(3);
  });

  it('returns NotSupported when item selector yields nothing', async () => {
    const executor = capturingExecutor([q1]);

    const stage = new Stage({
      name: 'test',
      executors: executor,
      itemSelector: mockItemSelector([]),
    });

    const writer = collectingWriter();
    const result = await stage.run(dataset, distribution, writer);
    expect(result).toBeInstanceOf(NotSupported);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('works without an item selector', async () => {
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

  it('passes the distribution to the item selector', async () => {
    const executor = capturingExecutor([q1]);
    const bindings = [{ class: namedNode('http://example.org/Person') }];
    const selectFn = vi.fn(async function* () {
      yield* bindings;
    });

    const stage = new Stage({
      name: 'test',
      executors: executor,
      itemSelector: { select: selectFn },
    });

    const writer = collectingWriter();
    const result = await stage.run(dataset, distribution, writer);
    expect(result).not.toBeInstanceOf(NotSupported);

    expect(selectFn).toHaveBeenCalledWith(distribution);
    expect(executor.execute).toHaveBeenCalledWith(dataset, distribution, {
      bindings,
    });
  });

  describe('sub-stages', () => {
    it('stores sub-stages', () => {
      const child1 = new Stage({ name: 'child1', executors: mockExecutor([]) });
      const child2 = new Stage({ name: 'child2', executors: mockExecutor([]) });
      const parent = new Stage({
        name: 'parent',
        executors: mockExecutor([]),
        stages: [child1, child2],
      });

      expect(parent.stages).toEqual([child1, child2]);
    });

    it('defaults to empty stages', () => {
      const stage = new Stage({ name: 'test', executors: mockExecutor([]) });
      expect(stage.stages).toEqual([]);
    });
  });

  describe('concurrent execution', () => {
    function delayExecutor(
      quads: Quad[],
      delayMs: number,
      tracker: { current: number; max: number }
    ): Executor {
      return {
        async execute(
          _dataset: Dataset,
          _distribution: Distribution,
          _options?: ExecuteOptions
        ): Promise<AsyncIterable<Quad> | NotSupported> {
          tracker.current++;
          tracker.max = Math.max(tracker.max, tracker.current);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          tracker.current--;
          return (async function* () {
            yield* quads;
          })();
        },
      };
    }

    function failingExecutor(failOnCall: number): Executor {
      let callCount = 0;
      return {
        async execute(): Promise<AsyncIterable<Quad> | NotSupported> {
          callCount++;
          if (callCount === failOnCall) {
            throw new Error('executor failure');
          }
          return (async function* () {
            yield q1;
          })();
        },
      };
    }

    it('runs executor batches concurrently', async () => {
      const tracker = { current: 0, max: 0 };
      const stage = new Stage({
        name: 'test',
        executors: delayExecutor([q1], 20, tracker),
        itemSelector: mockItemSelector([
          { class: namedNode('http://example.org/A') },
          { class: namedNode('http://example.org/B') },
          { class: namedNode('http://example.org/C') },
          { class: namedNode('http://example.org/D') },
        ]),
        batchSize: 1,
        maxConcurrency: 2,
      });

      const writer = collectingWriter();
      await stage.run(dataset, distribution, writer);

      expect(tracker.max).toBe(2);
      expect(writer.quads).toHaveLength(4);
    });

    it('bounds parallelism to maxConcurrency', async () => {
      const tracker = { current: 0, max: 0 };
      const stage = new Stage({
        name: 'test',
        executors: delayExecutor([q1], 10, tracker),
        itemSelector: mockItemSelector([
          { class: namedNode('http://example.org/A') },
          { class: namedNode('http://example.org/B') },
          { class: namedNode('http://example.org/C') },
          { class: namedNode('http://example.org/D') },
          { class: namedNode('http://example.org/E') },
          { class: namedNode('http://example.org/F') },
        ]),
        batchSize: 1,
        maxConcurrency: 3,
      });

      const writer = collectingWriter();
      await stage.run(dataset, distribution, writer);

      expect(tracker.max).toBeLessThanOrEqual(3);
      expect(writer.quads).toHaveLength(6);
    });

    it('propagates executor errors', async () => {
      const stage = new Stage({
        name: 'test',
        executors: failingExecutor(2),
        itemSelector: mockItemSelector([
          { class: namedNode('http://example.org/A') },
          { class: namedNode('http://example.org/B') },
          { class: namedNode('http://example.org/C') },
        ]),
        batchSize: 1,
        maxConcurrency: 1,
      });

      const writer = collectingWriter();
      await expect(stage.run(dataset, distribution, writer)).rejects.toThrow(
        'executor failure'
      );
    });

    it('stops execution when writer throws', async () => {
      const tracker = { current: 0, max: 0 };
      const stage = new Stage({
        name: 'test',
        executors: delayExecutor([q1, q2], 10, tracker),
        itemSelector: mockItemSelector([
          { class: namedNode('http://example.org/A') },
          { class: namedNode('http://example.org/B') },
          { class: namedNode('http://example.org/C') },
        ]),
        batchSize: 1,
        maxConcurrency: 1,
      });

      let quadsSeen = 0;
      const failingWriter: Writer = {
        async write(_dataset, quads) {
          for await (const _quad of quads) {
            quadsSeen++;
            if (quadsSeen >= 1) {
              throw new Error('writer failure');
            }
          }
        },
      };

      await expect(
        stage.run(dataset, distribution, failingWriter)
      ).rejects.toThrow('writer failure');
    });

    it('calls onProgress callback', async () => {
      const progressCalls: Array<{
        elements: number;
        quads: number;
      }> = [];

      const stage = new Stage({
        name: 'test',
        executors: mockExecutor([q1]),
        itemSelector: mockItemSelector([
          { class: namedNode('http://example.org/A') },
          { class: namedNode('http://example.org/B') },
          { class: namedNode('http://example.org/C') },
        ]),
        batchSize: 1,
        maxConcurrency: 1,
      });

      const writer = collectingWriter();
      const options: RunOptions = {
        onProgress: (elements, quads) => {
          progressCalls.push({ elements, quads });
        },
      };

      await stage.run(dataset, distribution, writer, options);

      expect(progressCalls).toHaveLength(3);
      // With maxConcurrency=1, execution is sequential so progress is monotonic.
      expect(progressCalls[0].elements).toBe(1);
      expect(progressCalls[1].elements).toBe(2);
      expect(progressCalls[2].elements).toBe(3);
    });

    it('returns NotSupported when all executors return NotSupported with item selector', async () => {
      const stage = new Stage({
        name: 'test',
        executors: notSupportedExecutor(),
        itemSelector: mockItemSelector([
          { class: namedNode('http://example.org/A') },
          { class: namedNode('http://example.org/B') },
        ]),
        batchSize: 1,
        maxConcurrency: 2,
      });

      const writer = collectingWriter();
      const result = await stage.run(dataset, distribution, writer);
      expect(result).toBeInstanceOf(NotSupported);
      expect(writer.quads).toEqual([]);
    });
  });
});
