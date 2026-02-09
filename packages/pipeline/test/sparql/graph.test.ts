import { describe, it, expect } from 'vitest';
import { Parser, type ConstructQuery } from 'sparqljs';
import { withDefaultGraph } from '../../src/sparql/graph.js';

const parser = new Parser();

function parseConstruct(sparql: string): ConstructQuery {
  return parser.parse(sparql) as ConstructQuery;
}

describe('withDefaultGraph', () => {
  it('sets from.default to the given graph IRI', () => {
    const query = parseConstruct('CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }');

    withDefaultGraph(query, 'http://example.org/graph');

    expect(query.from).toEqual({
      default: [
        expect.objectContaining({
          termType: 'NamedNode',
          value: 'http://example.org/graph',
        }),
      ],
      named: [],
    });
  });

  it('replaces an existing FROM clause', () => {
    const query = parseConstruct(
      'CONSTRUCT { ?s ?p ?o } FROM <http://old.org/graph> WHERE { ?s ?p ?o }'
    );

    withDefaultGraph(query, 'http://new.org/graph');

    expect(query.from!.default).toHaveLength(1);
    expect(query.from!.default[0]).toMatchObject({
      termType: 'NamedNode',
      value: 'http://new.org/graph',
    });
  });
});
