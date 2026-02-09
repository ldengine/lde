import {
  Generator,
  Parser,
  type ConstructQuery,
  type ValuesPattern,
} from 'sparqljs';
import type { StageSelectorBindings } from '../stage.js';

const parser = new Parser();
const generator = new Generator();

/**
 * Inject a VALUES clause into a CONSTRUCT query for the given binding rows.
 *
 * Each row's keys become `?`-prefixed SPARQL variables; NamedNode values
 * become IRIs in the VALUES block. The VALUES clause is prepended to the
 * query's WHERE patterns.
 */
export function injectValues(
  query: string,
  bindings: StageSelectorBindings[]
): string {
  const parsed = parser.parse(query) as ConstructQuery;
  if (parsed.type !== 'query' || parsed.queryType !== 'CONSTRUCT') {
    throw new Error('Query must be a CONSTRUCT query');
  }

  const valuesPattern: ValuesPattern = {
    type: 'values',
    values: bindings.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([name, node]) => [`?${name}`, node])
      )
    ),
  };

  parsed.where = [valuesPattern, ...(parsed.where ?? [])];

  return generator.stringify(parsed);
}
