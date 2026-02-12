import { withProvenance } from '../src/index.js';
import { describe, it, expect } from 'vitest';
import { DataFactory } from 'n3';
import type { Quad } from '@rdfjs/types';

const { namedNode, literal, quad } = DataFactory;

const PROV = 'http://www.w3.org/ns/prov#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const XSD_DATE_TIME = 'http://www.w3.org/2001/XMLSchema#dateTime';

async function* toAsync(...quads: Quad[]): AsyncIterable<Quad> {
  yield* quads;
}

async function collect(stream: AsyncIterable<Quad>): Promise<Quad[]> {
  const result: Quad[] = [];
  for await (const q of stream) {
    result.push(q);
  }
  return result;
}

describe('withProvenance', () => {
  const iri = 'http://example.com/dataset/1';
  const startedAt = new Date('2024-01-15T10:00:00.000Z');
  const endedAt = new Date('2024-01-15T10:05:00.000Z');

  it('adds prov:Entity type', async () => {
    const result = await collect(
      withProvenance(toAsync(), iri, startedAt, endedAt)
    );

    const entityQuads = result.filter(
      (q) =>
        q.subject.value === iri &&
        q.predicate.value === RDF_TYPE &&
        q.object.value === `${PROV}Entity`
    );
    expect(entityQuads).toHaveLength(1);
  });

  it('adds prov:wasGeneratedBy linking to an activity', async () => {
    const result = await collect(
      withProvenance(toAsync(), iri, startedAt, endedAt)
    );

    const generatedByQuads = result.filter(
      (q) =>
        q.subject.value === iri && q.predicate.value === `${PROV}wasGeneratedBy`
    );
    expect(generatedByQuads).toHaveLength(1);
    expect(generatedByQuads[0].object.termType).toBe('BlankNode');
  });

  it('adds prov:Activity type to the activity', async () => {
    const result = await collect(
      withProvenance(toAsync(), iri, startedAt, endedAt)
    );

    const activityQuads = result.filter(
      (q) =>
        q.predicate.value === RDF_TYPE && q.object.value === `${PROV}Activity`
    );
    expect(activityQuads).toHaveLength(1);
    expect(activityQuads[0].subject.termType).toBe('BlankNode');
  });

  it('adds prov:startedAtTime as xsd:dateTime', async () => {
    const result = await collect(
      withProvenance(toAsync(), iri, startedAt, endedAt)
    );

    const startQuads = result.filter(
      (q) => q.predicate.value === `${PROV}startedAtTime`
    );
    expect(startQuads).toHaveLength(1);
    expect(startQuads[0].object.value).toBe('2024-01-15T10:00:00.000Z');
    expect(
      'datatype' in startQuads[0].object
        ? (startQuads[0].object as { datatype: { value: string } }).datatype
            .value
        : undefined
    ).toBe(XSD_DATE_TIME);
  });

  it('adds prov:endedAtTime as xsd:dateTime', async () => {
    const result = await collect(
      withProvenance(toAsync(), iri, startedAt, endedAt)
    );

    const endQuads = result.filter(
      (q) => q.predicate.value === `${PROV}endedAtTime`
    );
    expect(endQuads).toHaveLength(1);
    expect(endQuads[0].object.value).toBe('2024-01-15T10:05:00.000Z');
    expect(
      'datatype' in endQuads[0].object
        ? (endQuads[0].object as { datatype: { value: string } }).datatype.value
        : undefined
    ).toBe(XSD_DATE_TIME);
  });

  it('preserves existing triples', async () => {
    const existing = quad(
      namedNode(iri),
      namedNode('http://rdfs.org/ns/void#triples'),
      literal('100')
    );

    const result = await collect(
      withProvenance(toAsync(existing), iri, startedAt, endedAt)
    );

    const existingQuads = result.filter(
      (q) => q.predicate.value === 'http://rdfs.org/ns/void#triples'
    );
    expect(existingQuads).toHaveLength(1);
    // 1 existing + 5 provenance triples
    expect(result).toHaveLength(6);
  });
});
