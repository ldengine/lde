import { DataEmittingStep, NotSupported } from './../step.js';
import { Dataset } from '@lde/dataset';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
 * Executes a SPARQL CONSTRUCT query and emits the resulting
 */
export class SparqlQuery implements DataEmittingStep {
  public readonly identifier;
  private readonly query;
  private readonly fetcher;

  constructor({ identifier, query, fetcher }: Args) {
    this.identifier = identifier;
    this.query = query;
    this.fetcher = fetcher ?? new SparqlEndpointFetcher();
  }

  async execute(dataset: Dataset) {
    const distribution = dataset.getSparqlDistribution();

    if (null === distribution || !distribution.isValid) {
      return new NotSupported('No SPARQL distribution available');
    }

    const query = this.query
      .replace('#subjectFilter#', distribution.subjectFilter ?? '')
      .replace('?dataset', `<${dataset.iri}>`)
      .replace(
        '#namedGraph#',
        distribution.namedGraph ? `FROM <${distribution.namedGraph}>` : ''
      );

    return await this.fetcher.fetchTriples(
      distribution.accessUrl.toString(),
      query
    );
  }

  public static async fromFile(filename: string) {
    return new this({
      identifier: filename,
      query: await fromFile(filename),
    });
  }
}

export async function fromFile(filename: string) {
  return (await readFile(resolve(filename))).toString();
}
