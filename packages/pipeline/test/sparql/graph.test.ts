import { describe, it, expect } from 'vitest';
import { Parser } from '@traqula/parser-sparql-1-1';
import type { QueryConstruct } from '@traqula/rules-sparql-1-1';
import { withDefaultGraph } from '../../src/sparql/graph.js';

const parser = new Parser();

function parseConstruct(sparql: string): QueryConstruct {
  return parser.parse(sparql) as QueryConstruct;
}

describe('withDefaultGraph', () => {
  it('sets datasets to the given graph IRI', () => {
    const query = parseConstruct('CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }');

    withDefaultGraph(query, 'http://example.org/graph');

    expect(query.datasets.clauses).toEqual([
      {
        clauseType: 'default',
        value: expect.objectContaining({
          type: 'term',
          subType: 'namedNode',
          value: 'http://example.org/graph',
        }),
      },
    ]);
  });

  it('replaces an existing FROM clause', () => {
    const query = parseConstruct(
      'CONSTRUCT { ?s ?p ?o } FROM <http://old.org/graph> WHERE { ?s ?p ?o }',
    );

    withDefaultGraph(query, 'http://new.org/graph');

    expect(query.datasets.clauses).toHaveLength(1);
    expect(query.datasets.clauses[0]).toMatchObject({
      clauseType: 'default',
      value: expect.objectContaining({
        type: 'term',
        subType: 'namedNode',
        value: 'http://new.org/graph',
      }),
    });
  });
});
