import { describe, it, expect } from 'vitest';
import { DataFactory } from 'n3';
import { Parser, type ConstructQuery, type ValuesPattern } from 'sparqljs';
import { injectValues } from '../../src/sparql/values.js';

const { namedNode } = DataFactory;
const parser = new Parser();

function parseConstruct(sparql: string): ConstructQuery {
  return parser.parse(sparql) as ConstructQuery;
}

describe('injectValues', () => {
  const baseQuery = parseConstruct(
    'CONSTRUCT { ?s a ?class } WHERE { ?s a ?class ; ?p ?o }'
  );

  it('injects a single-variable, single-row VALUES clause', () => {
    const result = injectValues(baseQuery, [
      { class: namedNode('http://example.com/Person') },
    ]);

    const values = result.where?.find(
      (p): p is ValuesPattern => p.type === 'values'
    );
    expect(values).toBeDefined();
    expect(values!.values).toHaveLength(1);
    expect(values!.values[0]['?class']).toMatchObject({
      termType: 'NamedNode',
      value: 'http://example.com/Person',
    });
  });

  it('injects a single-variable, multiple-row VALUES clause', () => {
    const result = injectValues(baseQuery, [
      { class: namedNode('http://example.com/Person') },
      { class: namedNode('http://example.com/Book') },
    ]);

    const values = result.where?.find(
      (p): p is ValuesPattern => p.type === 'values'
    );
    expect(values!.values).toHaveLength(2);
    expect(values!.values[0]['?class']).toMatchObject({
      termType: 'NamedNode',
      value: 'http://example.com/Person',
    });
    expect(values!.values[1]['?class']).toMatchObject({
      termType: 'NamedNode',
      value: 'http://example.com/Book',
    });
  });

  it('injects a multi-variable VALUES clause', () => {
    const result = injectValues(baseQuery, [
      {
        class: namedNode('http://example.com/Person'),
        property: namedNode('http://example.com/name'),
      },
    ]);

    const values = result.where?.find(
      (p): p is ValuesPattern => p.type === 'values'
    );
    expect(values!.values).toHaveLength(1);
    expect(values!.values[0]['?class']).toMatchObject({
      termType: 'NamedNode',
      value: 'http://example.com/Person',
    });
    expect(values!.values[0]['?property']).toMatchObject({
      termType: 'NamedNode',
      value: 'http://example.com/name',
    });
  });

  it('preserves existing WHERE patterns', () => {
    const result = injectValues(baseQuery, [
      { class: namedNode('http://example.com/Person') },
    ]);

    // VALUES is prepended; original BGP pattern(s) follow.
    expect(result.where!.length).toBeGreaterThan(1);
    expect(result.where![0].type).toBe('values');
  });

  it('preserves the CONSTRUCT template', () => {
    const result = injectValues(baseQuery, [
      { class: namedNode('http://example.com/Person') },
    ]);

    expect(result.template).toBeDefined();
    expect(result.template!.length).toBeGreaterThan(0);
  });

  it('produces an empty VALUES clause for empty bindings', () => {
    const result = injectValues(baseQuery, []);

    const values = result.where?.find(
      (p): p is ValuesPattern => p.type === 'values'
    );
    expect(values!.values).toHaveLength(0);
  });

  it('does not mutate the input query', () => {
    const original = parseConstruct(
      'CONSTRUCT { ?s a ?class } WHERE { ?s a ?class }'
    );
    const originalWhereLength = original.where!.length;

    injectValues(original, [{ class: namedNode('http://example.com/Person') }]);

    expect(original.where!.length).toBe(originalWhereLength);
  });
});
