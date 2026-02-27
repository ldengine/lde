import {
  AstFactory,
  type QueryConstruct,
  type ValuePatternRow,
} from '@traqula/rules-sparql-1-1';
import type { VariableBindings } from './executor.js';

const F = new AstFactory();

/**
 * Inject a VALUES clause into a parsed CONSTRUCT query for the given binding rows.
 *
 * Each row's keys become SPARQL variables; NamedNode values become IRIs in the
 * VALUES block. The VALUES clause is prepended to the query's WHERE patterns.
 *
 * The caller owns parsing and stringifying; this function operates on the AST.
 */
export function injectValues(
  query: QueryConstruct,
  bindings: VariableBindings[],
): QueryConstruct {
  const variableNames = bindings.length > 0 ? Object.keys(bindings[0]) : [];

  const variables = variableNames.map((name) => F.termVariable(name, F.gen()));

  const values: ValuePatternRow[] = bindings.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([name, node]) => [
        name,
        F.termNamed(F.gen(), node.value),
      ]),
    ),
  );

  const valuesPattern = F.patternValues(variables, values, F.gen());

  return {
    ...query,
    where: F.patternGroup([valuesPattern, ...query.where.patterns], F.gen()),
  };
}
