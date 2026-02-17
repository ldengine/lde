import { createReadStream } from 'node:fs';
import { Dataset, Distribution } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import { StreamParser } from 'n3';
import type { DatasetSelector } from './selector.js';
import { Stage } from './stage.js';
import type { Writer } from './writer/writer.js';
import { FileWriter } from './writer/fileWriter.js';
import {
  type DistributionResolver,
  NoDistributionAvailable,
} from './distribution/resolver.js';
import { SparqlDistributionResolver } from './distribution/index.js';
import { NotSupported } from './sparql/executor.js';
import type { StageOutputResolver } from './stageOutputResolver.js';
import type { ProgressReporter } from './progressReporter.js';

export interface PipelineOptions {
  datasetSelector: DatasetSelector;
  stages: Stage[];
  writers: Writer | Writer[];
  name?: string;
  distributionResolver?: DistributionResolver;
  chaining?: {
    stageOutputResolver: StageOutputResolver;
    outputDir: string;
  };
  reporter?: ProgressReporter;
}

class FanOutWriter implements Writer {
  constructor(private readonly writers: Writer[]) {}

  async write(dataset: Dataset, quads: AsyncIterable<Quad>): Promise<void> {
    const collected: Quad[] = [];
    for await (const quad of quads) collected.push(quad);
    for (const w of this.writers) {
      await w.write(
        dataset,
        (async function* () {
          yield* collected;
        })(),
      );
    }
  }
}

export class Pipeline {
  private readonly name: string;
  private readonly datasetSelector: DatasetSelector;
  private readonly stages: Stage[];
  private readonly writer: Writer;
  private readonly distributionResolver: DistributionResolver;
  private readonly chaining?: PipelineOptions['chaining'];
  private readonly reporter?: ProgressReporter;

  constructor(options: PipelineOptions) {
    const hasSubStages = options.stages.some(
      (stage) => stage.stages.length > 0,
    );
    if (hasSubStages && !options.chaining) {
      throw new Error('chaining is required when any stage has sub-stages');
    }

    this.name = options.name ?? '';
    this.datasetSelector = options.datasetSelector;
    this.stages = options.stages;
    this.writer = Array.isArray(options.writers)
      ? new FanOutWriter(options.writers)
      : options.writers;
    this.distributionResolver =
      options.distributionResolver ?? new SparqlDistributionResolver();
    this.chaining = options.chaining;
    this.reporter = options.reporter;
  }

  async run(): Promise<void> {
    const start = Date.now();

    this.reporter?.pipelineStart(this.name);

    const datasets = await this.datasetSelector.select();
    for await (const dataset of datasets) {
      await this.processDataset(dataset);
    }

    this.reporter?.pipelineComplete({ duration: Date.now() - start });
  }

  private async processDataset(dataset: Dataset): Promise<void> {
    const datasetIri = dataset.iri.toString();

    this.reporter?.datasetStart(datasetIri);

    const resolved = await this.distributionResolver.resolve(dataset);
    if (resolved instanceof NoDistributionAvailable) {
      this.reporter?.datasetSkipped(datasetIri, resolved.message);
      return;
    }

    try {
      for (const stage of this.stages) {
        if (stage.stages.length > 0) {
          await this.runChain(dataset, resolved.distribution, stage);
        } else {
          await this.runStage(dataset, resolved.distribution, stage);
        }
      }
    } catch {
      // Stage error for this dataset; continue to next dataset.
    } finally {
      await this.distributionResolver.cleanup?.();
    }

    this.reporter?.datasetComplete(datasetIri);
  }

  private async runStage(
    dataset: Dataset,
    distribution: Distribution,
    stage: Stage,
  ): Promise<void> {
    this.reporter?.stageStart(stage.name);
    const stageStart = Date.now();

    let elementsProcessed = 0;
    let quadsGenerated = 0;

    const result = await stage.run(dataset, distribution, this.writer, {
      onProgress: (elements, quads) => {
        elementsProcessed = elements;
        quadsGenerated = quads;
        this.reporter?.stageProgress({ elementsProcessed, quadsGenerated });
      },
    });

    if (result instanceof NotSupported) {
      this.reporter?.stageSkipped(stage.name, result.message);
    } else {
      this.reporter?.stageComplete(stage.name, {
        elementsProcessed,
        quadsGenerated,
        duration: Date.now() - stageStart,
      });
    }
  }

  private async runChain(
    dataset: Dataset,
    distribution: Distribution,
    stage: Stage,
  ): Promise<void> {
    const { stageOutputResolver, outputDir } = this.chaining!;
    const outputFiles: string[] = [];

    try {
      // 1. Run parent stage → FileWriter.
      const parentWriter = new FileWriter({
        outputDir: `${outputDir}/${stage.name}`,
        format: 'n-triples',
      });

      await this.runChainedStage(dataset, distribution, stage, parentWriter);
      outputFiles.push(parentWriter.getOutputPath(dataset));

      // 2. Chain through children.
      let currentDistribution = await stageOutputResolver.resolve(
        parentWriter.getOutputPath(dataset),
      );
      for (let i = 0; i < stage.stages.length; i++) {
        const child = stage.stages[i];
        const childWriter = new FileWriter({
          outputDir: `${outputDir}/${child.name}`,
          format: 'n-triples',
        });

        await this.runChainedStage(
          dataset,
          currentDistribution,
          child,
          childWriter,
        );
        outputFiles.push(childWriter.getOutputPath(dataset));

        if (i < stage.stages.length - 1) {
          currentDistribution = await stageOutputResolver.resolve(
            childWriter.getOutputPath(dataset),
          );
        }
      }

      // 3. Concatenate all output files → user writer.
      await this.writer.write(dataset, this.readFiles(outputFiles));
    } finally {
      await stageOutputResolver.cleanup();
    }
  }

  private async runChainedStage(
    dataset: Dataset,
    distribution: Distribution,
    stage: Stage,
    stageWriter: FileWriter,
  ): Promise<void> {
    this.reporter?.stageStart(stage.name);
    const stageStart = Date.now();

    let elementsProcessed = 0;
    let quadsGenerated = 0;

    const result = await stage.run(dataset, distribution, stageWriter, {
      onProgress: (elements, quads) => {
        elementsProcessed = elements;
        quadsGenerated = quads;
        this.reporter?.stageProgress({ elementsProcessed, quadsGenerated });
      },
    });

    if (result instanceof NotSupported) {
      this.reporter?.stageSkipped(stage.name, result.message);
      throw new Error(
        `Stage '${stage.name}' returned NotSupported in chained mode`,
      );
    }

    this.reporter?.stageComplete(stage.name, {
      elementsProcessed,
      quadsGenerated,
      duration: Date.now() - stageStart,
    });
  }

  private async *readFiles(paths: string[]): AsyncIterable<Quad> {
    for (const path of paths) {
      const stream = createReadStream(path);
      const parser = new StreamParser();
      stream.pipe(parser);
      for await (const quad of parser) {
        yield quad as Quad;
      }
    }
  }
}
