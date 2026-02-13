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
import type { Selector } from '../src/selector.js';
import { Paginator } from '@lde/dataset-registry-client';

function makeDataset(iri = 'http://example.org/dataset'): Dataset {
  return new Dataset({
    iri: new URL(iri),
    distributions: [],
  });
}

const sparqlDistribution = Distribution.sparql(
  new URL('http://example.org/sparql')
);

function makeSelector(...datasets: Dataset[]): Selector {
  return {
    select: async () => new Paginator(async () => datasets, datasets.length),
  };
}

function makeResolver(
  result: ResolvedDistribution | NoDistributionAvailable
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
        Distribution.sparql(new URL('http://resolved.example.org/sparql'))
      ),
    cleanup: vi
      .fn<StageOutputResolver['cleanup']>()
      .mockResolvedValue(undefined),
  };
}

function makeStage(
  name: string,
  result: NotSupported | void = undefined
): Stage {
  const stage = new Stage({ name, executors: [] });
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

  describe('parallel mode', () => {
    it('runs stages with the same distribution and user writer', async () => {
      const stage1 = makeStage('stage1');
      const stage2 = makeStage('stage2');

      const pipeline = new Pipeline({
        name: 'test',
        selector: makeSelector(dataset),
        stages: [stage1, stage2],
        writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
      });

      await pipeline.run();

      expect(stage1.run).toHaveBeenCalledWith(
        dataset,
        sparqlDistribution,
        writer,
        expect.objectContaining({ onProgress: expect.any(Function) })
      );
      expect(stage2.run).toHaveBeenCalledWith(
        dataset,
        sparqlDistribution,
        writer,
        expect.objectContaining({ onProgress: expect.any(Function) })
      );
    });

    it('skips dataset when no distribution is available', async () => {
      const stage = makeStage('stage1');
      const reporter = makeReporter();

      const pipeline = new Pipeline({
        name: 'test',
        selector: makeSelector(dataset),
        stages: [stage],
        writer,
        distributionResolver: makeResolver(
          new NoDistributionAvailable(dataset, 'No SPARQL endpoint', [])
        ),
        reporter,
      });

      await pipeline.run();

      expect(stage.run).not.toHaveBeenCalled();
      expect(reporter.datasetSkipped).toHaveBeenCalledWith(
        dataset.iri.toString(),
        'No SPARQL endpoint'
      );
    });

    it('skips stage returning NotSupported', async () => {
      const stage1 = makeStage(
        'stage1',
        new NotSupported('Not supported reason')
      );
      const stage2 = makeStage('stage2');
      const reporter = makeReporter();

      const pipeline = new Pipeline({
        name: 'test',
        selector: makeSelector(dataset),
        stages: [stage1, stage2],
        writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        reporter,
      });

      await pipeline.run();

      expect(reporter.stageSkipped).toHaveBeenCalledWith(
        'stage1',
        'Not supported reason'
      );
      expect(stage2.run).toHaveBeenCalled();
    });
  });

  describe('chained mode', () => {
    it('uses FileWriter for intermediate stages and resolver for next distribution', async () => {
      const resolvedDistribution = Distribution.sparql(
        new URL('http://resolved.example.org/sparql')
      );
      const stageOutputResolver = makeStageOutputResolver();
      stageOutputResolver.resolve.mockResolvedValue(resolvedDistribution);

      const stage1 = makeStage('stage1');
      const stage2 = makeStage('stage2');

      const pipeline = new Pipeline({
        name: 'test',
        selector: makeSelector(dataset),
        stages: [stage1, stage2],
        writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          outputDir: '/tmp/test',
          format: 'n-triples',
          stageOutputResolver,
        },
      });

      await pipeline.run();

      // Stage 1 should get an auto-created FileWriter, not the user writer.
      const stage1Writer = (stage1.run as ReturnType<typeof vi.fn>).mock
        .calls[0][2];
      expect(stage1Writer).not.toBe(writer);
      expect(stage1Writer.constructor.name).toBe('FileWriter');

      // Resolver should be called with the output path.
      expect(stageOutputResolver.resolve).toHaveBeenCalled();
    });

    it('passes resolved distribution to next stage', async () => {
      const resolvedDistribution = Distribution.sparql(
        new URL('http://resolved.example.org/sparql')
      );
      const stageOutputResolver = makeStageOutputResolver();
      stageOutputResolver.resolve.mockResolvedValue(resolvedDistribution);

      const stage1 = makeStage('stage1');
      const stage2 = makeStage('stage2');

      const pipeline = new Pipeline({
        name: 'test',
        selector: makeSelector(dataset),
        stages: [stage1, stage2],
        writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          outputDir: '/tmp/test',
          stageOutputResolver,
        },
      });

      await pipeline.run();

      // Stage 2 should receive the distribution from the resolver.
      const stage2Distribution = (stage2.run as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      expect(stage2Distribution).toBe(resolvedDistribution);
    });

    it('uses user writer for the last stage', async () => {
      const stageOutputResolver = makeStageOutputResolver();
      const stage1 = makeStage('stage1');
      const stage2 = makeStage('stage2');

      const pipeline = new Pipeline({
        name: 'test',
        selector: makeSelector(dataset),
        stages: [stage1, stage2],
        writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          outputDir: '/tmp/test',
          stageOutputResolver,
        },
      });

      await pipeline.run();

      const stage2Writer = (stage2.run as ReturnType<typeof vi.fn>).mock
        .calls[0][2];
      expect(stage2Writer).toBe(writer);
    });

    it('cleans up on success', async () => {
      const stageOutputResolver = makeStageOutputResolver();

      const pipeline = new Pipeline({
        name: 'test',
        selector: makeSelector(dataset),
        stages: [makeStage('stage1')],
        writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          outputDir: '/tmp/test',
          stageOutputResolver,
        },
      });

      await pipeline.run();

      expect(stageOutputResolver.cleanup).toHaveBeenCalledTimes(1);
    });

    it('cleans up on error', async () => {
      const stageOutputResolver = makeStageOutputResolver();
      const failingStage = makeStage('failing');
      vi.spyOn(failingStage, 'run').mockRejectedValue(
        new Error('Stage failed')
      );

      const pipeline = new Pipeline({
        name: 'test',
        selector: makeSelector(dataset),
        stages: [failingStage],
        writer,
        distributionResolver: makeResolver(makeResolvedDistribution()),
        chaining: {
          outputDir: '/tmp/test',
          stageOutputResolver,
        },
      });

      await pipeline.run();

      expect(stageOutputResolver.cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('reporter', () => {
    it('calls reporter hooks in order', async () => {
      const reporter = makeReporter();
      const stage = makeStage('stage1');

      const pipeline = new Pipeline({
        name: 'my-pipeline',
        selector: makeSelector(dataset),
        stages: [stage],
        writer,
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
            callOrder[i - 1].mock.invocationCallOrder[0]
          );
        }
      }

      expect(reporter.pipelineStart).toHaveBeenCalledWith('my-pipeline');
      expect(reporter.datasetStart).toHaveBeenCalledWith(
        dataset.iri.toString()
      );
      expect(reporter.stageStart).toHaveBeenCalledWith('stage1');
      expect(reporter.pipelineComplete).toHaveBeenCalledWith(
        expect.objectContaining({ duration: expect.any(Number) })
      );
    });

    it('works without reporter', async () => {
      const pipeline = new Pipeline({
        name: 'test',
        selector: makeSelector(dataset),
        stages: [makeStage('stage1')],
        writer,
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
        name: 'test',
        selector: makeSelector(dataset1, dataset2),
        stages: [stage],
        writer,
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
        name: 'test',
        selector: makeSelector(dataset1, dataset2),
        stages: [failingStage],
        writer,
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
