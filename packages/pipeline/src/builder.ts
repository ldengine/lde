import { Dataset } from '@lde/dataset';
import {
  Selector,
  ManualDatasetSelection,
  RegistrySelector,
} from './selector.js';
import { Step } from './step.js';
import { Client } from '@lde/dataset-registry-client';

/**
 * Configuration for QLever SPARQL server.
 */
export interface QleverConfig {
  /**
   * Execution mode: 'docker' for containerized, 'native' for local binary.
   */
  mode: 'docker' | 'native';
  /**
   * Docker image to use (for docker mode).
   * @default 'adfreiburg/qlever'
   */
  image?: string;
  /**
   * Port for the SPARQL endpoint.
   * @default 7001
   */
  port?: number;
  /**
   * Working directory for imports.
   */
  workingDir?: string;
}

/**
 * Writer configuration.
 */
export interface WriterConfig {
  type: 'file' | 'sparql';
  outputDir?: string;
  endpoint?: URL;
}

/**
 * Complete pipeline configuration.
 */
export interface PipelineConfig {
  selector: Selector;
  steps: Step[];
  writers?: WriterConfig[];
  qlever?: QleverConfig;
}

/**
 * Fluent builder for creating pipeline configurations.
 *
 * @example
 * ```typescript
 * const config = PipelineBuilder.create()
 *   .withSelector(registry('https://example.com/sparql'))
 *   .addStep(sparqlQuery('queries/triples.rq'))
 *   .addWriter(fileWriter({ outputDir: 'output' }))
 *   .build();
 * ```
 */
export class PipelineBuilder {
  private selector?: Selector;
  private steps: Step[] = [];
  private writers: WriterConfig[] = [];
  private qleverConfig?: QleverConfig;

  /**
   * Create a new PipelineBuilder instance.
   */
  static create(): PipelineBuilder {
    return new PipelineBuilder();
  }

  /**
   * Set the dataset selector.
   */
  withSelector(selector: Selector): this {
    this.selector = selector;
    return this;
  }

  /**
   * Configure QLever for local SPARQL imports.
   */
  withQlever(config: QleverConfig): this {
    this.qleverConfig = config;
    return this;
  }

  /**
   * Add a single step to the pipeline.
   */
  addStep(step: Step): this {
    this.steps.push(step);
    return this;
  }

  /**
   * Add multiple steps to the pipeline.
   */
  addSteps(...steps: Step[]): this {
    this.steps.push(...steps);
    return this;
  }

  /**
   * Add a writer for pipeline output.
   */
  addWriter(writer: WriterConfig): this {
    this.writers.push(writer);
    return this;
  }

  /**
   * Build the final pipeline configuration.
   * @throws Error if selector is not set
   */
  build(): PipelineConfig {
    if (!this.selector) {
      throw new Error('Selector is required. Use withSelector() to set it.');
    }

    return {
      selector: this.selector,
      steps: this.steps,
      writers: this.writers.length > 0 ? this.writers : undefined,
      qlever: this.qleverConfig,
    };
  }
}

// Helper functions for fluent construction.

/**
 * Create a selector that queries a Dataset Registry.
 *
 * @param endpoint SPARQL endpoint URL of the registry
 */
export function registry(endpoint: string | URL): RegistrySelector {
  return new RegistrySelector({
    registry: new Client(
      typeof endpoint === 'string' ? new URL(endpoint) : endpoint
    ),
  });
}

/**
 * Create a selector for manually specified datasets.
 *
 * @param datasets Array of dataset IRIs
 */
export function manual(...datasetIris: URL[]): ManualDatasetSelection {
  const datasets = datasetIris.map(
    (iri) => new Dataset({ iri, distributions: [] })
  );
  return new ManualDatasetSelection(datasets);
}

/**
 * Create a file writer configuration.
 */
export function fileWriter(options: { outputDir: string }): WriterConfig {
  return {
    type: 'file',
    outputDir: options.outputDir,
  };
}

/**
 * Create a SPARQL UPDATE writer configuration.
 */
export function sparqlWriter(options: { endpoint: URL }): WriterConfig {
  return {
    type: 'sparql',
    endpoint: options.endpoint,
  };
}
