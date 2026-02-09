import { DataFactory } from 'n3';
import type { ConstructQuery } from 'sparqljs';

/**
 * Set the default graph (FROM clause) on a parsed CONSTRUCT query.
 *
 * Mutates the query in place, replacing any existing FROM clause.
 */
export function withDefaultGraph(
  query: ConstructQuery,
  graphIri: string
): void {
  query.from = { default: [DataFactory.namedNode(graphIri)], named: [] };
}
