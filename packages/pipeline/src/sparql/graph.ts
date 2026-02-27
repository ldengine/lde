import { AstFactory, type QueryConstruct } from '@traqula/rules-sparql-1-1';

const F = new AstFactory();

/**
 * Set the default graph (FROM clause) on a parsed CONSTRUCT query.
 *
 * Mutates the query in place, replacing any existing FROM clause.
 */
export function withDefaultGraph(
  query: QueryConstruct,
  graphIri: string,
): void {
  query.datasets = F.datasetClauses(
    [{ clauseType: 'default', value: F.termNamed(F.gen(), graphIri) }],
    F.gen(),
  );
}
