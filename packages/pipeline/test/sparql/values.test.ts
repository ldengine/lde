import { describe, it, expect } from 'vitest';
import { DataFactory } from 'n3';
import { Parser, type ConstructQuery, type ValuesPattern } from 'sparqljs';
import { injectValues } from '../../src/sparql/values.js';

const { namedNode } = DataFactory;
const parser = new Parser();

function parseConstruct(sparql: string): ConstructQuery {
  return parser.parse(sparql) as ConstructQuery;
}

function getValuesPattern(sparql: string): ValuesPattern {
  const parsed = parseConstruct(sparql);
  const values = parsed.where?.find(
    (p): p is ValuesPattern => p.type === 'values'
  );
  if (!values) {
    throw new Error('No VALUES pattern found');
  }
  return values;
}

describe('injectValues', () => {
  const baseQuery = 'CONSTRUCT { ?s a ?class } WHERE { ?s a ?class ; ?p ?o }';

  it('injects a single-variable, single-row VALUES clause', () => {
    const result = injectValues(baseQuery, [
      { class: namedNode('http://example.com/Person') },
    ]);

    const values = getValuesPattern(result);
    expect(values.values).toHaveLength(1);
    expect(values.values[0]['?class']).toMatchObject({
      termType: 'NamedNode',
      value: 'http://example.com/Person',
    });
  });

  it('injects a single-variable, multiple-row VALUES clause', () => {
    const result = injectValues(baseQuery, [
      { class: namedNode('http://example.com/Person') },
      { class: namedNode('http://example.com/Book') },
    ]);

    const values = getValuesPattern(result);
    expect(values.values).toHaveLength(2);
    expect(values.values[0]['?class']).toMatchObject({
      termType: 'NamedNode',
      value: 'http://example.com/Person',
    });
    expect(values.values[1]['?class']).toMatchObject({
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

    const values = getValuesPattern(result);
    expect(values.values).toHaveLength(1);
    expect(values.values[0]['?class']).toMatchObject({
      termType: 'NamedNode',
      value: 'http://example.com/Person',
    });
    expect(values.values[0]['?property']).toMatchObject({
      termType: 'NamedNode',
      value: 'http://example.com/name',
    });
  });

  it('preserves existing WHERE patterns', () => {
    const result = injectValues(baseQuery, [
      { class: namedNode('http://example.com/Person') },
    ]);

    const parsed = parseConstruct(result);
    // VALUES is prepended; original BGP pattern(s) follow.
    expect(parsed.where!.length).toBeGreaterThan(1);
    expect(parsed.where![0].type).toBe('values');
  });

  it('preserves the CONSTRUCT template', () => {
    const result = injectValues(baseQuery, [
      { class: namedNode('http://example.com/Person') },
    ]);

    const parsed = parseConstruct(result);
    expect(parsed.template).toBeDefined();
    expect(parsed.template!.length).toBeGreaterThan(0);
  });

  it('throws on a non-CONSTRUCT query', () => {
    expect(() =>
      injectValues('SELECT ?s WHERE { ?s ?p ?o }', [
        { s: namedNode('http://example.com/1') },
      ])
    ).toThrow('Query must be a CONSTRUCT query');
  });

  it('produces an empty VALUES clause for empty bindings', () => {
    const result = injectValues(baseQuery, []);

    const values = getValuesPattern(result);
    expect(values.values).toHaveLength(0);
  });

  it('produces valid SPARQL output', () => {
    const result = injectValues(baseQuery, [
      { class: namedNode('http://example.com/Person') },
      { class: namedNode('http://example.com/Book') },
    ]);

    // The output must be parseable SPARQL.
    expect(() => parser.parse(result)).not.toThrow();
  });
});
