import { DatasetSchema } from './schema.js';
import { createLens } from 'ldkit';
export class Client {
  constructor(
    private readonly sparqlEndpoint: URL,
    private readonly schema = DatasetSchema
  ) {}

  public async query(criteria: object = {}) {
    const datasets = createLens(this.schema, {
      sources: [this.sparqlEndpoint.toString()],
      logQuery: (query) => console.log(query),
    });

    return datasets.find(criteria);
  }
}
