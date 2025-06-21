import { Dataset, Distribution } from '@lde/dataset';
import { DatasetSchema } from './schema.js';
import { createLens } from 'ldkit';
import { prepareQuery } from './query.js';

export class Client {
  constructor(
    private readonly sparqlEndpoint: URL,
    private readonly schema = DatasetSchema
  ) {}

  public query(criteria: object): AsyncGenerator<Dataset>;
  public query(constructQuery: string): AsyncGenerator<Dataset>;
  public async *query(args: object | string = {}): AsyncGenerator<Dataset> {
    const datasets = createLens(this.schema, {
      sources: [this.sparqlEndpoint.toString()],
      // logQuery: (query) => console.debug(query),
    });

    let results;
    if (typeof args === 'string') {
      results = datasets.query(prepareQuery(args));
    } else {
      results = datasets.find(args);
    }

    for (const result of await results) {
      yield new Dataset(
        new URL(result.$id),
        result.distribution.map((d) => {
          const distribution = new Distribution(d.accessURL, d.mediaType);
          distribution.byteSize = d.byteSize ?? undefined;
          distribution.lastModified = d.modified ?? undefined;

          return distribution;
        })
      );
    }

    return results;
  }
}
