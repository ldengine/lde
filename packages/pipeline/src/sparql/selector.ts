import type { Distribution } from '@lde/dataset';
import type { Term } from '@rdfjs/types';
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import { Parser } from '@traqula/parser-sparql-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import {
  AstFactory,
  type QuerySelect,
  type TermVariable,
} from '@traqula/rules-sparql-1-1';
import type { ItemSelector } from '../stage.js';
import type { VariableBindings } from './executor.js';

const parser = new Parser();
const generator = new Generator();
const F = new AstFactory();

export interface SparqlItemSelectorOptions {
  /** SELECT query projecting at least one named variable. A LIMIT in the query sets the default page size. */
  query: string;
  /** Results per page. Overrides any LIMIT in the query. @default 10 */
  pageSize?: number;
  /** Custom fetcher instance. */
  fetcher?: SparqlEndpointFetcher;
}

/**
 * {@link ItemSelector} that pages through SPARQL SELECT results,
 * yielding all projected variable bindings (NamedNode values only) per row.
 *
 * The endpoint URL comes from the {@link Distribution} passed to {@link select}.
 * Pagination is an internal detail — consumers iterate binding rows directly.
 * If the query contains a LIMIT, it is used as the default page size
 * (can be overridden by the `pageSize` option). Pagination continues
 * until a page returns fewer results than the page size.
 */
export class SparqlItemSelector implements ItemSelector {
  private readonly parsed: QuerySelect;
  private readonly pageSize: number;
  private readonly fetcher: SparqlEndpointFetcher;

  constructor(options: SparqlItemSelectorOptions) {
    const parsed = parser.parse(options.query);
    if (parsed.type !== 'query' || parsed.subType !== 'select') {
      throw new Error('Query must be a SELECT query');
    }

    const variables = (parsed as QuerySelect).variables.filter(isVariableTerm);
    if (variables.length === 0) {
      throw new Error(
        'Query must project at least one named variable (SELECT * is not supported)',
      );
    }

    this.parsed = parsed as QuerySelect;
    this.pageSize =
      options.pageSize ??
      this.parsed.solutionModifiers.limitOffset?.limit ??
      10;
    this.fetcher = options.fetcher ?? new SparqlEndpointFetcher();
  }

  async *select(
    distribution: Distribution,
  ): AsyncIterableIterator<VariableBindings> {
    const endpoint = distribution.accessUrl!;
    let offset = 0;

    while (true) {
      this.parsed.solutionModifiers.limitOffset = F.solutionModifierLimitOffset(
        this.pageSize,
        offset,
        F.gen(),
      );
      const paginatedQuery = generator.generate(this.parsed);

      const stream = (await this.fetcher.fetchBindings(
        endpoint.toString(),
        paginatedQuery,
      )) as AsyncIterable<Record<string, Term>>;

      let pageSize = 0;
      for await (const record of stream) {
        const row = Object.fromEntries(
          Object.entries(record).filter(
            ([, term]) => term.termType === 'NamedNode',
          ),
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

function isVariableTerm(v: object): v is TermVariable {
  return (
    'type' in v &&
    v.type === 'term' &&
    'subType' in v &&
    v.subType === 'variable'
  );
}
