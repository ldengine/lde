import { createReadStream } from 'node:fs';
import { Dataset, Distribution } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import { StreamParser } from 'n3';
import type { Selector } from './selector.js';
import { Stage } from './stage.js';
import type { Writer } from './writer/writer.js';
import { FileWriter } from './writer/fileWriter.js';
import {
  type DistributionResolver,
  NoDistributionAvailable,
} from './distribution/resolver.js';
import { NotSupported } from './sparql/executor.js';
import type { StageOutputResolver } from './stageOutputResolver.js';
import type { ProgressReporter } from './progressReporter.js';

export interface PipelineOptions {
  name: string;
  selector: Selector;
  stages: Stage[];
  writer: Writer;
  distributionResolver: DistributionResolver;
  stageOutputResolver?: StageOutputResolver;
  outputDir?: string;
  outputFormat?: 'turtle' | 'n-triples' | 'n-quads';
  reporter?: ProgressReporter;
}

export class Pipeline {
  private readonly options: PipelineOptions;

  constructor(options: PipelineOptions) {
    const hasSubStages = options.stages.some(
      (stage) => stage.stages.length > 0
    );
    if (hasSubStages && !options.stageOutputResolver) {
      throw new Error(
        'stageOutputResolver is required when any stage has sub-stages'
      );
    }
    if (hasSubStages && !options.outputDir) {
      throw new Error('outputDir is required when any stage has sub-stages');
    }
    this.options = options;
  }

  async run(): Promise<void> {
    const { selector, reporter, name } = this.options;
    const start = Date.now();

    reporter?.pipelineStart(name);

    const datasets = await selector.select();
    for await (const dataset of datasets) {
      await this.processDataset(dataset);
    }

    reporter?.pipelineComplete({ duration: Date.now() - start });
  }

  private async processDataset(dataset: Dataset): Promise<void> {
    const { distributionResolver, reporter } = this.options;
    const datasetIri = dataset.iri.toString();

    reporter?.datasetStart(datasetIri);

    const resolved = await distributionResolver.resolve(dataset);
    if (resolved instanceof NoDistributionAvailable) {
      reporter?.datasetSkipped(datasetIri, resolved.message);
      return;
    }

    try {
      for (const stage of this.options.stages) {
        if (stage.stages.length > 0) {
          await this.runChain(dataset, resolved.distribution, stage);
        } else {
          await this.runStage(dataset, resolved.distribution, stage);
        }
      }
    } catch {
      // Stage error for this dataset; continue to next dataset.
    }

    reporter?.datasetComplete(datasetIri);
  }

  private async runStage(
    dataset: Dataset,
    distribution: Distribution,
    stage: Stage
  ): Promise<void> {
    const { writer, reporter } = this.options;

    reporter?.stageStart(stage.name);
    const stageStart = Date.now();

    let elementsProcessed = 0;
    let quadsGenerated = 0;

    const result = await stage.run(dataset, distribution, writer, {
      onProgress: (elements, quads) => {
        elementsProcessed = elements;
        quadsGenerated = quads;
        reporter?.stageProgress({ elementsProcessed, quadsGenerated });
      },
    });

    if (result instanceof NotSupported) {
      reporter?.stageSkipped(stage.name, result.message);
    } else {
      reporter?.stageComplete(stage.name, {
        elementsProcessed,
        quadsGenerated,
        duration: Date.now() - stageStart,
      });
    }
  }

  private async runChain(
    dataset: Dataset,
    distribution: Distribution,
    stage: Stage
  ): Promise<void> {
    const { writer, stageOutputResolver, outputDir, outputFormat } =
      this.options;
    const outputFiles: string[] = [];

    try {
      // 1. Run parent stage → FileWriter.
      const parentWriter = new FileWriter({
        outputDir: `${outputDir}/${stage.name}`,
        format: outputFormat,
      });

      await this.runChainedStage(dataset, distribution, stage, parentWriter);
      outputFiles.push(parentWriter.getOutputPath(dataset));

      // 2. Chain through children.
      let currentDistribution = await stageOutputResolver!.resolve(
        parentWriter.getOutputPath(dataset)
      );
      for (let i = 0; i < stage.stages.length; i++) {
        const child = stage.stages[i];
        const childWriter = new FileWriter({
          outputDir: `${outputDir}/${child.name}`,
          format: outputFormat,
        });

        await this.runChainedStage(
          dataset,
          currentDistribution,
          child,
          childWriter
        );
        outputFiles.push(childWriter.getOutputPath(dataset));

        if (i < stage.stages.length - 1) {
          currentDistribution = await stageOutputResolver!.resolve(
            childWriter.getOutputPath(dataset)
          );
        }
      }

      // 3. Concatenate all output files → user writer.
      await writer.write(dataset, this.readFiles(outputFiles));
    } finally {
      await stageOutputResolver!.cleanup();
    }
  }

  private async runChainedStage(
    dataset: Dataset,
    distribution: Distribution,
    stage: Stage,
    stageWriter: FileWriter
  ): Promise<void> {
    const { reporter } = this.options;

    reporter?.stageStart(stage.name);
    const stageStart = Date.now();

    let elementsProcessed = 0;
    let quadsGenerated = 0;

    const result = await stage.run(dataset, distribution, stageWriter, {
      onProgress: (elements, quads) => {
        elementsProcessed = elements;
        quadsGenerated = quads;
        reporter?.stageProgress({ elementsProcessed, quadsGenerated });
      },
    });

    if (result instanceof NotSupported) {
      reporter?.stageSkipped(stage.name, result.message);
      throw new Error(
        `Stage '${stage.name}' returned NotSupported in chained mode`
      );
    }

    reporter?.stageComplete(stage.name, {
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
