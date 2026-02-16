import { ProvenanceExecutor } from '../src/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import { NotSupported } from '@lde/pipeline';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataFactory } from 'n3';
import type { Quad } from '@rdfjs/types';
import type { Executor } from '@lde/pipeline';

const { namedNode, literal, quad } = DataFactory;

const PROV = 'http://www.w3.org/ns/prov#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const XSD_DATE_TIME = 'http://www.w3.org/2001/XMLSchema#dateTime';

const dataset = new Dataset({
  iri: new URL('http://example.com/dataset/1'),
  distributions: [],
});
const distribution = new Distribution(new URL('http://example.com/sparql'));

function mockExecutor(quads: Quad[]): Executor {
  return {
    async execute() {
      return (async function* () {
        yield* quads;
      })();
    },
  };
}

async function collect(stream: AsyncIterable<Quad>): Promise<Quad[]> {
  const result: Quad[] = [];
  for await (const q of stream) {
    result.push(q);
  }
  return result;
}

describe('ProvenanceExecutor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds prov:Entity type', async () => {
    const executor = new ProvenanceExecutor(mockExecutor([]));
    const result = await executor.execute(dataset, distribution);

    const quads = await collect(result as AsyncIterable<Quad>);
    const entityQuads = quads.filter(
      (q) =>
        q.subject.value === dataset.iri.toString() &&
        q.predicate.value === RDF_TYPE &&
        q.object.value === `${PROV}Entity`,
    );
    expect(entityQuads).toHaveLength(1);
  });

  it('adds prov:wasGeneratedBy linking to an activity', async () => {
    const executor = new ProvenanceExecutor(mockExecutor([]));
    const result = await executor.execute(dataset, distribution);

    const quads = await collect(result as AsyncIterable<Quad>);
    const generatedByQuads = quads.filter(
      (q) =>
        q.subject.value === dataset.iri.toString() &&
        q.predicate.value === `${PROV}wasGeneratedBy`,
    );
    expect(generatedByQuads).toHaveLength(1);
    expect(generatedByQuads[0].object.termType).toBe('BlankNode');
  });

  it('adds prov:Activity type to the activity', async () => {
    const executor = new ProvenanceExecutor(mockExecutor([]));
    const result = await executor.execute(dataset, distribution);

    const quads = await collect(result as AsyncIterable<Quad>);
    const activityQuads = quads.filter(
      (q) =>
        q.predicate.value === RDF_TYPE && q.object.value === `${PROV}Activity`,
    );
    expect(activityQuads).toHaveLength(1);
    expect(activityQuads[0].subject.termType).toBe('BlankNode');
  });

  it('adds prov:startedAtTime as xsd:dateTime', async () => {
    const executor = new ProvenanceExecutor(mockExecutor([]));
    const result = await executor.execute(dataset, distribution);

    const quads = await collect(result as AsyncIterable<Quad>);
    const startQuads = quads.filter(
      (q) => q.predicate.value === `${PROV}startedAtTime`,
    );
    expect(startQuads).toHaveLength(1);
    expect(startQuads[0].object.value).toBe('2024-01-15T10:00:00.000Z');
    expect(
      'datatype' in startQuads[0].object
        ? (startQuads[0].object as { datatype: { value: string } }).datatype
            .value
        : undefined,
    ).toBe(XSD_DATE_TIME);
  });

  it('adds prov:endedAtTime as xsd:dateTime', async () => {
    const executor = new ProvenanceExecutor(mockExecutor([]));
    const result = await executor.execute(dataset, distribution);

    // Advance time before consuming the stream.
    vi.setSystemTime(new Date('2024-01-15T10:05:00.000Z'));
    const quads = await collect(result as AsyncIterable<Quad>);

    const endQuads = quads.filter(
      (q) => q.predicate.value === `${PROV}endedAtTime`,
    );
    expect(endQuads).toHaveLength(1);
    expect(endQuads[0].object.value).toBe('2024-01-15T10:05:00.000Z');
    expect(
      'datatype' in endQuads[0].object
        ? (endQuads[0].object as { datatype: { value: string } }).datatype.value
        : undefined,
    ).toBe(XSD_DATE_TIME);
  });

  it('preserves existing triples', async () => {
    const existing = quad(
      namedNode(dataset.iri.toString()),
      namedNode('http://rdfs.org/ns/void#triples'),
      literal('100'),
    );

    const executor = new ProvenanceExecutor(mockExecutor([existing]));
    const result = await executor.execute(dataset, distribution);

    const quads = await collect(result as AsyncIterable<Quad>);
    const existingQuads = quads.filter(
      (q) => q.predicate.value === 'http://rdfs.org/ns/void#triples',
    );
    expect(existingQuads).toHaveLength(1);
    // 1 existing + 5 provenance triples
    expect(quads).toHaveLength(6);
  });

  it('propagates NotSupported from inner executor', async () => {
    const inner: Executor = {
      async execute() {
        return new NotSupported('no endpoint');
      },
    };

    const executor = new ProvenanceExecutor(inner);
    const result = await executor.execute(dataset, distribution);

    expect(result).toBeInstanceOf(NotSupported);
  });
});
