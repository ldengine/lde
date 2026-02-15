import type { Term } from '@rdfjs/types';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import {
  Generator,
  Parser,
  type SelectQuery,
  type Variable,
  type VariableTerm,
} from 'sparqljs';
import type { ItemSelector } from '../stage.js';
import type { VariableBindings } from './executor.js';

const parser = new Parser();
const generator = new Generator();

export interface SparqlItemSelectorOptions {
  /** SELECT query projecting at least one named variable. A LIMIT in the query sets the default page size. */
  query: string;
  /** SPARQL endpoint URL. */
  endpoint: URL;
  /** Results per page. Overrides any LIMIT in the query. @default 10 */
  pageSize?: number;
  /** Custom fetcher instance. */
  fetcher?: SparqlEndpointFetcher;
}

/**
 * {@link ItemSelector} that pages through SPARQL SELECT results,
 * yielding all projected variable bindings (NamedNode values only) per row.
 *
 * Pagination is an internal detail — consumers iterate binding rows directly.
 * If the query contains a LIMIT, it is used as the default page size
 * (can be overridden by the `pageSize` option). Pagination continues
 * until a page returns fewer results than the page size.
 */
export class SparqlItemSelector implements ItemSelector {
  private readonly parsed: SelectQuery;
  private readonly endpoint: URL;
  private readonly pageSize: number;
  private readonly fetcher: SparqlEndpointFetcher;

  constructor(options: SparqlItemSelectorOptions) {
    const parsed = parser.parse(options.query);
    if (parsed.type !== 'query' || parsed.queryType !== 'SELECT') {
      throw new Error('Query must be a SELECT query');
    }

    const variables = parsed.variables.filter(isVariableTerm);
    if (variables.length === 0) {
      throw new Error(
        'Query must project at least one named variable (SELECT * is not supported)'
      );
    }

    this.parsed = parsed;
    this.endpoint = options.endpoint;
    this.pageSize = options.pageSize ?? parsed.limit ?? 10;
    this.fetcher = options.fetcher ?? new SparqlEndpointFetcher();
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<VariableBindings> {
    let offset = 0;

    while (true) {
      this.parsed.limit = this.pageSize;
      this.parsed.offset = offset;
      const paginatedQuery = generator.stringify(this.parsed);

      const stream = (await this.fetcher.fetchBindings(
        this.endpoint.toString(),
        paginatedQuery
      )) as AsyncIterable<Record<string, Term>>;

      let pageSize = 0;
      for await (const record of stream) {
        const row = Object.fromEntries(
          Object.entries(record).filter(
            ([, term]) => term.termType === 'NamedNode'
          )
        ) as VariableBindings;

        if (Object.keys(row).length > 0) {
          yield row;
          pageSize++;
        }
      }

      if (pageSize === 0 || pageSize < this.pageSize) {
        return;
      }

      offset += pageSize;
    }
  }
}

function isVariableTerm(v: Variable | object): v is VariableTerm {
  return 'termType' in v && v.termType === 'Variable';
}
