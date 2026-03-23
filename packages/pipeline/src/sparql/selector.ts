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
  /**
   * SELECT query projecting at least one named variable.
   *
   * A `LIMIT` clause in the query overrides the stage's `batchSize` as the
   * page size — use this when the SPARQL endpoint enforces a result limit.
   */
  query: string;
  /** Custom fetcher instance. */
  fetcher?: SparqlEndpointFetcher;
}

/**
 * {@link ItemSelector} that pages through SPARQL SELECT results,
 * yielding all projected variable bindings (NamedNode values only) per row.
 *
 * The endpoint URL comes from the {@link Distribution} passed to {@link select}.
 * Pagination is an internal detail — consumers iterate binding rows directly.
 *
 * The page size (results per SPARQL request) is determined by, in order:
 * 1. A `LIMIT` clause in the selector query (for endpoints with hard result limits)
 * 2. The stage's {@link StageOptions.batchSize} (passed via {@link select})
 * 3. A default of 10
 */
export class SparqlItemSelector implements ItemSelector {
  private readonly parsed: QuerySelect;
  private readonly queryLimit?: number;
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
    this.queryLimit = this.parsed.solutionModifiers.limitOffset?.limit;
    this.fetcher = options.fetcher ?? new SparqlEndpointFetcher();
  }

  async *select(
    distribution: Distribution,
    batchSize?: number,
  ): AsyncIterableIterator<VariableBindings> {
    const effectivePageSize = this.queryLimit ?? batchSize ?? 10;
    const endpoint = distribution.accessUrl!;
    let offset = 0;

    while (true) {
      this.parsed.solutionModifiers.limitOffset = F.solutionModifierLimitOffset(
        effectivePageSize,
        offset,
        F.gen(),
      );
      const paginatedQuery = generator.generate(this.parsed);

      const stream = (await this.fetcher.fetchBindings(
        endpoint.toString(),
        paginatedQuery,
      )) as AsyncIterable<Record<string, Term>>;

      let count = 0;
      for await (const record of stream) {
        const row = Object.fromEntries(
          Object.entries(record).filter(
            ([, term]) => term.termType === 'NamedNode',
          ),
        ) as VariableBindings;

        if (Object.keys(row).length > 0) {
          yield row;
          count++;
        }
      }

      if (count === 0 || count < effectivePageSize) {
        return;
      }

      offset += count;
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
