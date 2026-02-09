import { DataEmittingStep, NotSupported } from './../step.js';
import { Dataset } from '@lde/dataset';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import {
  SparqlConstructExecutor,
  substituteQueryTemplates,
  readQueryFile,
} from '../sparql/index.js';

/**
 * Arguments for the SparqlQuery step.
 *
 * @param identifier Unique identifier for the step.
 * @param query: SPARQL CONSTRUCT query to execute.
 * @param fetcher Optional SPARQL endpoint fetcher; defaults to SparqlEndpointFetcher.
 */
export interface Args {
  identifier: string;
  query: string;
  fetcher?: SparqlEndpointFetcher;
}

/**
 * Executes a SPARQL CONSTRUCT query and emits the resulting quads.
 *
 * This step wraps the SparqlConstructExecutor to provide the DataEmittingStep interface
 * for use in pipelines. Supports legacy template substitution (`#namedGraph#`,
 * `#subjectFilter#`, `?dataset`); for new code prefer the AST-based executor directly.
 */
export class SparqlQuery implements DataEmittingStep {
  public readonly identifier;
  private readonly query: string;
  private readonly fetcher?: SparqlEndpointFetcher;

  constructor({ identifier, query, fetcher }: Args) {
    this.identifier = identifier;
    this.query = query;
    this.fetcher = fetcher;
  }

  async execute(dataset: Dataset) {
    const distribution = dataset.getSparqlDistribution();
    if (distribution === null || !distribution.isValid) {
      return new NotSupported('No SPARQL distribution available');
    }
    const substituted = substituteQueryTemplates(
      this.query,
      distribution,
      dataset
    );
    const executor = new SparqlConstructExecutor({
      query: substituted,
      fetcher: this.fetcher,
    });
    return await executor.execute(dataset);
  }

  public static async fromFile(filename: string) {
    return new this({
      identifier: filename,
      query: await readQueryFile(filename),
    });
  }
}

/**
 * @deprecated Use readQueryFile from '@lde/pipeline/sparql' instead.
 */
export async function fromFile(filename: string) {
  return readQueryFile(filename);
}
