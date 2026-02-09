import type { ConstructQuery, ValuesPattern } from 'sparqljs';
import type { StageSelectorBindings } from '../stage.js';

/**
 * Inject a VALUES clause into a parsed CONSTRUCT query for the given binding rows.
 *
 * Each row's keys become `?`-prefixed SPARQL variables; NamedNode values
 * become IRIs in the VALUES block. The VALUES clause is prepended to the
 * query's WHERE patterns.
 *
 * The caller owns parsing and stringifying; this function operates on the AST.
 */
export function injectValues(
  query: ConstructQuery,
  bindings: StageSelectorBindings[]
): ConstructQuery {
  const valuesPattern: ValuesPattern = {
    type: 'values',
    values: bindings.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([name, node]) => [`?${name}`, node])
      )
    ),
  };

  return {
    ...query,
    where: [valuesPattern, ...(query.where ?? [])],
  };
}
