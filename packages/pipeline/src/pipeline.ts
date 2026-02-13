import { Dataset } from '@lde/dataset';
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
  chaining?: {
    outputDir: string;
    format?: 'turtle' | 'n-triples' | 'n-quads';
    stageOutputResolver: StageOutputResolver;
  };
  reporter?: ProgressReporter;
}

export class Pipeline {
  private readonly options: PipelineOptions;

  constructor(options: PipelineOptions) {
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
    const { distributionResolver, reporter, chaining } = this.options;
    const datasetIri = dataset.iri.toString();

    reporter?.datasetStart(datasetIri);

    const resolved = await distributionResolver.resolve(dataset);
    if (resolved instanceof NoDistributionAvailable) {
      reporter?.datasetSkipped(datasetIri, resolved.message);
      return;
    }

    try {
      if (chaining) {
        await this.runChained(dataset, resolved.distribution);
      } else {
        await this.runParallel(dataset, resolved.distribution);
      }
    } catch {
      // Stage error for this dataset; continue to next dataset.
    }

    reporter?.datasetComplete(datasetIri);
  }

  private async runParallel(
    dataset: Dataset,
    distribution: import('@lde/dataset').Distribution
  ): Promise<void> {
    const { stages, writer, reporter } = this.options;

    for (const stage of stages) {
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
  }

  private async runChained(
    dataset: Dataset,
    distribution: import('@lde/dataset').Distribution
  ): Promise<void> {
    const { stages, writer, reporter, chaining } = this.options;
    const { stageOutputResolver } = chaining!;

    let currentDistribution = distribution;

    try {
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const isLast = i === stages.length - 1;

        reporter?.stageStart(stage.name);
        const stageStart = Date.now();

        let elementsProcessed = 0;
        let quadsGenerated = 0;

        const stageWriter = isLast
          ? writer
          : new FileWriter({
              outputDir: `${chaining!.outputDir}/${stage.name}`,
              format: chaining!.format,
            });

        const result = await stage.run(
          dataset,
          currentDistribution,
          stageWriter,
          {
            onProgress: (elements, quads) => {
              elementsProcessed = elements;
              quadsGenerated = quads;
              reporter?.stageProgress({ elementsProcessed, quadsGenerated });
            },
          }
        );

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

        if (!isLast) {
          const fileWriter = stageWriter as FileWriter;
          currentDistribution = await stageOutputResolver.resolve(
            fileWriter.getOutputPath(dataset)
          );
        }
      }
    } finally {
      await stageOutputResolver.cleanup();
    }
  }
}
