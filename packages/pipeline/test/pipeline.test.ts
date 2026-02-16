import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pipeline } from '../src/pipeline.js';
import { Dataset, Distribution } from '@lde/dataset';
import { Stage } from '../src/stage.js';
import { NotSupported } from '../src/sparql/executor.js';
import {
  ResolvedDistribution,
  NoDistributionAvailable,
  type DistributionResolver,
} from '../src/distribution/resolver.js';
import type { Writer } from '../src/writer/writer.js';
import type { ProgressReporter } from '../src/progressReporter.js';
import type { StageOutputResolver } from '../src/stageOutputResolver.js';
import type { DatasetSelector } from '../src/selector.js';
import { Paginator } from '@lde/dataset-registry-client';

function makeDataset(iri = 'http://example.org/dataset'): Dataset {
  return new Dataset({
    iri: new URL(iri),
    distributions: [],
  });
}

const sparqlDistribution = Distribution.sparql(
  new URL('http://example.org/sparql'),
);

function makeDatasetSelector(...datasets: Dataset[]): DatasetSelector {
  return {
    select: async () => new Paginator(async () => datasets, datasets.length),
  };
}

function makeResolver(
  result: ResolvedDistribution | NoDistributionAvailable,
): DistributionResolver {
  return { resolve: vi.fn().mockResolvedValue(result) };
}

function makeResolvedDistribution(): ResolvedDistribution {
  return new ResolvedDistribution(sparqlDistribution, []);
}

function makeWriter(): Writer & { write: ReturnType<typeof vi.fn> } {
  return { write: vi.fn().mockResolvedValue(undefined) };
}

function makeReporter(): ProgressReporter & {
  [K in keyof ProgressReporter]: ReturnType<typeof vi.fn>;
} {
  return {
    pipelineStart: vi.fn<ProgressReporter['pipelineStart']>(),
    datasetStart: vi.fn<ProgressReporter['datasetStart']>(),
    stageStart: vi.fn<ProgressReporter['stageStart']>(),
    stageProgress: vi.fn<ProgressReporter['stageProgress']>(),
    stageComplete: vi.fn<ProgressReporter['stageComplete']>(),
    stageSkipped: vi.fn<ProgressReporter['stageSkipped']>(),
    datasetComplete: vi.fn<ProgressReporter['datasetComplete']>(),
    datasetSkipped: vi.fn<ProgressReporter['datasetSkipped']>(),
    pipelineComplete: vi.fn<ProgressReporter['pipelineComplete']>(),
  };
}

function makeStageOutputResolver(): StageOutputResolver & {
  resolve: ReturnType<typeof vi.fn>;
  cleanup: ReturnType<typeof vi.fn>;
} {
  return {
    resolve: vi
      .fn<StageOutputResolver['resolve']>()
      .mockResolvedValue(
        Distribution.sparql(new URL('http://resolved.example.org/sparql')),
      ),
    cleanup: vi
      .fn<StageOutputResolver['cleanup']>()
      .mockResolvedValue(undefined),
  };
}

function makeStage(
  name: string,
  result: NotSupported | void = undefined,
  subStages: Stage[] = [],
): Stage {
  const stage = new Stage({ name, executors: [], stages: subStages });
  vi.spyOn(stage, 'run').mockResolvedValue(result);
  return stage;
}

describe('Pipeline', () => {
  let dataset: Dataset;
  let writer: ReturnType<typeof makeWriter>;

  beforeEach(() => {
    dataset = makeDataset();
    writer = makeWriter();
  });

  describe('flat stages', () => {
    it('runs stages with the same distribution and user writer', async () => {
      const stage1 = makeStage('stage1');
      const stage2 = makeStage('stage2');

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [stage1, stage2],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
      });

      await pipeline.run();

      expect(stage1.run).toHaveBeenCalledWith(
        dataset,
        sparqlDistribution,
        writer,
        expect.objectContaining({ onProgress: expect.any(Function) }),
      );
      expect(stage2.run).toHaveBeenCalledWith(
        dataset,
        sparqlDistribution,
        writer,
        expect.objectContaining({ onProgress: expect.any(Function) }),
      );
    });

    it('skips dataset when no distribution is available', async () => {
      const stage = makeStage('stage1');
      const reporter = makeReporter();

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [stage],
        writers: writer,
        distributionResolver: makeResolver(
          new NoDistributionAvailable(dataset, 'No SPARQL endpoint', []),
        ),
        reporter,
      });

      await pipeline.run();

      expect(stage.run).not.toHaveBeenCalled();
      expect(reporter.datasetSkipped).toHaveBeenCalledWith(
        dataset.iri.toString(),
        'No SPARQL endpoint',
      );
    });

    it('fans out to multiple writers', async () => {
      const writer2 = makeWriter();
      const stage = makeStage('stage1');

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [stage],
        writers: [writer, writer2],
        distributionResolver: makeResolver(makeResolvedDistribution()),
      });

      await pipeline.run();

      // Both stages should receive a FanOutWriter, not the individual writers.
      const usedWriter = (stage.run as ReturnType<typeof vi.fn>).mock
        .calls[0][2];
      expect(usedWriter).not.toBe(writer);
      expect(usedWriter).not.toBe(writer2);
    });

    it('skips stage returning NotSupported', async () => {
      const stage1 = makeStage(
        'stage1',
        new NotSupported('Not supported reason'),
      );
      const stage2 = makeStage('stage2');
      const reporter = makeReporter();

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [stage1, stage2],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        reporter,
      });

      await pipeline.run();

      expect(reporter.stageSkipped).toHaveBeenCalledWith(
        'stage1',
        'Not supported reason',
      );
      expect(stage2.run).toHaveBeenCalled();
    });
  });

  describe('sub-stage chaining', () => {
    it('runs parent with FileWriter, children chain off parent output', async () => {
      const resolvedDistribution = Distribution.sparql(
        new URL('http://resolved.example.org/sparql'),
      );
      const stageOutputResolver = makeStageOutputResolver();
      stageOutputResolver.resolve.mockResolvedValue(resolvedDistribution);

      const child = makeStage('child');
      const parent = makeStage('parent', undefined, [child]);

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [parent],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          stageOutputResolver,
          outputDir: '/tmp/test',
          outputFormat: 'n-triples',
        },
      });

      await pipeline.run();

      // Parent should get a FileWriter, not the user writer.
      const parentWriter = (parent.run as ReturnType<typeof vi.fn>).mock
        .calls[0][2];
      expect(parentWriter).not.toBe(writer);
      expect(parentWriter.constructor.name).toBe('FileWriter');

      // Child should receive the resolved distribution.
      const childDistribution = (child.run as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      expect(childDistribution).toBe(resolvedDistribution);

      // Resolver should be called with the parent's output path.
      expect(stageOutputResolver.resolve).toHaveBeenCalled();
    });

    it('calls stageOutputResolver between chained stages', async () => {
      const dist1 = Distribution.sparql(
        new URL('http://resolved.example.org/sparql/1'),
      );
      const dist2 = Distribution.sparql(
        new URL('http://resolved.example.org/sparql/2'),
      );
      const stageOutputResolver = makeStageOutputResolver();
      stageOutputResolver.resolve
        .mockResolvedValueOnce(dist1)
        .mockResolvedValueOnce(dist2);

      const child1 = makeStage('child1');
      const child2 = makeStage('child2');
      const parent = makeStage('parent', undefined, [child1, child2]);

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [parent],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          stageOutputResolver,
          outputDir: '/tmp/test',
          outputFormat: 'n-triples',
        },
      });

      await pipeline.run();

      // resolve() called: once for parent→child1, once for child1→child2.
      expect(stageOutputResolver.resolve).toHaveBeenCalledTimes(2);

      // child1 gets dist1 (resolved from parent output).
      expect((child1.run as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe(
        dist1,
      );
      // child2 gets dist2 (resolved from child1 output).
      expect((child2.run as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe(
        dist2,
      );
    });

    it('concatenates all output files to user writer', async () => {
      const stageOutputResolver = makeStageOutputResolver();
      const child = makeStage('child');
      const parent = makeStage('parent', undefined, [child]);

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [parent],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          stageOutputResolver,
          outputDir: '/tmp/test',
          outputFormat: 'n-triples',
        },
      });

      await pipeline.run();

      // writer.write() should have been called with the dataset and an async iterable.
      expect(writer.write).toHaveBeenCalledWith(dataset, expect.anything());
    });

    it('cleans up on success', async () => {
      const stageOutputResolver = makeStageOutputResolver();
      const child = makeStage('child');
      const parent = makeStage('parent', undefined, [child]);

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [parent],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          stageOutputResolver,
          outputDir: '/tmp/test',
        },
      });

      await pipeline.run();

      expect(stageOutputResolver.cleanup).toHaveBeenCalledTimes(1);
    });

    it('cleans up on error', async () => {
      const stageOutputResolver = makeStageOutputResolver();
      const child = makeStage('child');
      const failingParent = makeStage('failing', undefined, [child]);
      vi.spyOn(failingParent, 'run').mockRejectedValue(
        new Error('Stage failed'),
      );

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [failingParent],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          stageOutputResolver,
          outputDir: '/tmp/test',
        },
      });

      await pipeline.run();

      expect(stageOutputResolver.cleanup).toHaveBeenCalledTimes(1);
    });

    it('validates chaining is required for sub-stages', () => {
      const child = makeStage('child');
      const parent = makeStage('parent', undefined, [child]);

      expect(
        () =>
          new Pipeline({
            datasetSelector: makeDatasetSelector(dataset),
            stages: [parent],
            writers: writer,
            distributionResolver: makeResolver(makeResolvedDistribution()),
          }),
      ).toThrow('chaining is required when any stage has sub-stages');
    });
  });

  describe('mixed flat and chained stages', () => {
    it('runs flat stages with user writer and chained stages through chain', async () => {
      const stageOutputResolver = makeStageOutputResolver();

      const flatStage = makeStage('flat');
      const child = makeStage('child');
      const chainedParent = makeStage('chained', undefined, [child]);

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [flatStage, chainedParent],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          stageOutputResolver,
          outputDir: '/tmp/test',
          outputFormat: 'n-triples',
        },
      });

      await pipeline.run();

      // Flat stage gets user writer.
      const flatWriter = (flatStage.run as ReturnType<typeof vi.fn>).mock
        .calls[0][2];
      expect(flatWriter).toBe(writer);

      // Chained parent gets FileWriter.
      const chainedWriter = (chainedParent.run as ReturnType<typeof vi.fn>).mock
        .calls[0][2];
      expect(chainedWriter).not.toBe(writer);
      expect(chainedWriter.constructor.name).toBe('FileWriter');
    });
  });

  describe('reporter', () => {
    it('calls reporter hooks in order', async () => {
      const reporter = makeReporter();
      const stage = makeStage('stage1');

      const pipeline = new Pipeline({
        name: 'my-pipeline',
        datasetSelector: makeDatasetSelector(dataset),
        stages: [stage],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        reporter,
      });

      await pipeline.run();

      const callOrder = [
        reporter.pipelineStart,
        reporter.datasetStart,
        reporter.stageStart,
        reporter.stageComplete,
        reporter.datasetComplete,
        reporter.pipelineComplete,
      ];

      for (let i = 0; i < callOrder.length; i++) {
        expect(callOrder[i]).toHaveBeenCalledTimes(1);
        if (i > 0) {
          expect(callOrder[i].mock.invocationCallOrder[0]).toBeGreaterThan(
            callOrder[i - 1].mock.invocationCallOrder[0],
          );
        }
      }

      expect(reporter.pipelineStart).toHaveBeenCalledWith('my-pipeline');
      expect(reporter.datasetStart).toHaveBeenCalledWith(
        dataset.iri.toString(),
      );
      expect(reporter.stageStart).toHaveBeenCalledWith('stage1');
      expect(reporter.pipelineComplete).toHaveBeenCalledWith(
        expect.objectContaining({ duration: expect.any(Number) }),
      );
    });

    it('calls reporter hooks for parent and child stages in chain', async () => {
      const reporter = makeReporter();
      const stageOutputResolver = makeStageOutputResolver();
      const child = makeStage('child');
      const parent = makeStage('parent', undefined, [child]);

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [parent],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          stageOutputResolver,
          outputDir: '/tmp/test',
        },
        reporter,
      });

      await pipeline.run();

      expect(reporter.stageStart).toHaveBeenCalledWith('parent');
      expect(reporter.stageStart).toHaveBeenCalledWith('child');
      expect(reporter.stageComplete).toHaveBeenCalledWith(
        'parent',
        expect.objectContaining({ duration: expect.any(Number) }),
      );
      expect(reporter.stageComplete).toHaveBeenCalledWith(
        'child',
        expect.objectContaining({ duration: expect.any(Number) }),
      );
    });

    it('works without reporter', async () => {
      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset),
        stages: [makeStage('stage1')],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
      });

      await expect(pipeline.run()).resolves.toBeUndefined();
    });
  });

  describe('multiple datasets', () => {
    it('processes each dataset through all stages', async () => {
      const dataset1 = makeDataset('http://example.org/dataset/1');
      const dataset2 = makeDataset('http://example.org/dataset/2');
      const stage = makeStage('stage1');
      const resolver = makeResolver(makeResolvedDistribution());

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset1, dataset2),
        stages: [stage],
        writers: writer,
        distributionResolver: resolver,
      });

      await pipeline.run();

      expect(stage.run).toHaveBeenCalledTimes(2);
      expect(resolver.resolve).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('continues to next dataset when a stage throws', async () => {
      const dataset1 = makeDataset('http://example.org/dataset/1');
      const dataset2 = makeDataset('http://example.org/dataset/2');

      const failingStage = makeStage('failing');
      let callCount = 0;
      vi.spyOn(failingStage, 'run').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Stage failed');
        }
      });

      const reporter = makeReporter();

      const pipeline = new Pipeline({
        datasetSelector: makeDatasetSelector(dataset1, dataset2),
        stages: [failingStage],
        writers: writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        reporter,
      });

      await pipeline.run();

      // Both datasets should be attempted.
      expect(failingStage.run).toHaveBeenCalledTimes(2);
      expect(reporter.datasetComplete).toHaveBeenCalledTimes(2);
    });
  });
});
