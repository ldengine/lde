import { loadConfig } from 'c12';
import {
  PipelineConfig,
  QleverConfig,
  WriterConfig,
  registry,
  manual,
} from './builder.js';
import { Selector } from './selector.js';
import { Step } from './step.js';
import { SparqlQuery } from './step/sparqlQuery.js';

/**
 * Raw configuration schema from YAML/JSON files.
 */
export interface RawPipelineConfig {
  selector?: {
    type: 'registry' | 'manual';
    endpoint?: string;
    datasets?: string[];
  };
  qlever?: QleverConfig;
  steps?: Array<{
    type: 'sparql-query';
    query: string;
  }>;
  writers?: Array<{
    type: 'file' | 'sparql';
    outputDir?: string;
    endpoint?: string;
  }>;
}

/**
 * Options for loading pipeline configuration.
 */
export interface LoadConfigOptions {
  /**
   * Configuration file name (without extension).
   * @default 'pipeline.config'
   */
  name?: string;
  /**
   * Working directory to search for config files.
   * @default process.cwd()
   */
  cwd?: string;
}

/**
 * Define a pipeline configuration with TypeScript type checking.
 *
 * @example
 * ```typescript
 * // pipeline.config.ts
 * import { defineConfig } from '@lde/pipeline';
 *
 * export default defineConfig({
 *   selector: { type: 'registry', endpoint: 'https://example.com/sparql' },
 *   steps: [{ type: 'sparql-query', query: 'queries/triples.rq' }],
 * });
 * ```
 */
export function defineConfig(config: RawPipelineConfig): RawPipelineConfig {
  return config;
}

/**
 * Load pipeline configuration from files.
 *
 * Searches for configuration files in the following order:
 * - pipeline.config.ts
 * - pipeline.config.js
 * - pipeline.config.yaml
 * - pipeline.config.yml
 * - pipeline.config.json
 *
 * @param options Load options
 * @returns Resolved pipeline configuration
 */
export async function loadPipelineConfig(
  options?: LoadConfigOptions
): Promise<PipelineConfig> {
  const { config } = await loadConfig<RawPipelineConfig>({
    name: options?.name ?? 'pipeline.config',
    cwd: options?.cwd,
  });

  if (!config) {
    throw new Error('No pipeline configuration found');
  }

  return normalizeConfig(config);
}

/**
 * Normalize raw configuration into a typed PipelineConfig.
 */
export function normalizeConfig(raw: RawPipelineConfig): PipelineConfig {
  return {
    selector: normalizeSelector(raw.selector),
    steps: normalizeSteps(raw.steps),
    writers: normalizeWriters(raw.writers),
    qlever: raw.qlever,
  };
}

function normalizeSelector(raw?: RawPipelineConfig['selector']): Selector {
  if (!raw) {
    throw new Error('Selector configuration is required');
  }

  switch (raw.type) {
    case 'registry':
      if (!raw.endpoint) {
        throw new Error('Registry selector requires endpoint');
      }
      return registry(raw.endpoint);

    case 'manual':
      if (!raw.datasets || raw.datasets.length === 0) {
        throw new Error('Manual selector requires datasets');
      }
      return manual(...raw.datasets.map((d) => new URL(d)));

    default:
      throw new Error(`Unknown selector type: ${raw.type}`);
  }
}

function normalizeSteps(raw?: RawPipelineConfig['steps']): Step[] {
  if (!raw) {
    return [];
  }

  return raw.map((step) => {
    switch (step.type) {
      case 'sparql-query':
        return new SparqlQuery({
          identifier: step.query,
          query: step.query, // Will be loaded from file by SparqlQuery.fromFile if path
        });

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  });
}

function normalizeWriters(
  raw?: RawPipelineConfig['writers']
): WriterConfig[] | undefined {
  if (!raw || raw.length === 0) {
    return undefined;
  }

  return raw.map((writer) => {
    switch (writer.type) {
      case 'file':
        if (!writer.outputDir) {
          throw new Error('File writer requires outputDir');
        }
        return { type: 'file' as const, outputDir: writer.outputDir };

      case 'sparql':
        if (!writer.endpoint) {
          throw new Error('SPARQL writer requires endpoint');
        }
        return { type: 'sparql' as const, endpoint: new URL(writer.endpoint) };

      default:
        throw new Error(`Unknown writer type: ${writer.type}`);
    }
  });
}
