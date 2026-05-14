import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { DataFactory } from 'n3';
import {
  buildSampleQuery,
  buildSubjectSelectorQuery,
  shaclSampleStages,
} from '../src/sampleStages.js';
import type { TargetShape } from '../src/pathExtractor.js';

const { namedNode } = DataFactory;
const shapesFile = join(__dirname, 'fixtures', 'schema-profile.ttl');

describe('buildSampleQuery', () => {
  const shape: TargetShape = {
    targetClass: namedNode('https://schema.org/CreativeWork'),
    pathChains: [
      [namedNode('https://schema.org/creator')],
      [
        namedNode('https://schema.org/creator'),
        namedNode('https://schema.org/birthPlace'),
      ],
    ],
  };

  it('contains no inner SELECT or LIMIT — sample selection is the ItemSelector’s job', () => {
    const query = buildSampleQuery(shape);
    expect(query).not.toMatch(/\bSELECT\b/);
    expect(query).not.toMatch(/\bLIMIT\b/);
  });

  it('emits one UNION branch per path chain using SPARQL property-paths', () => {
    const query = buildSampleQuery(shape);
    expect(query).toContain('<https://schema.org/creator> ?neighbour');
    expect(query).toContain(
      '<https://schema.org/creator>/<https://schema.org/birthPlace> ?neighbour',
    );
  });

  it('emits CONSTRUCT for the sampled subject and its neighbours', () => {
    const query = buildSampleQuery(shape);
    expect(query).toMatch(/^CONSTRUCT \{\s*\?s \?p \?o \./);
    expect(query).toContain('?neighbour ?np ?nv');
  });
});

describe('buildSubjectSelectorQuery', () => {
  const targetClass = namedNode('https://schema.org/CreativeWork');

  it('produces a SELECT DISTINCT ?s with LIMIT', () => {
    const query = buildSubjectSelectorQuery(targetClass, 50);
    expect(query).toMatch(/SELECT DISTINCT \?s/);
    expect(query).toMatch(/LIMIT 50/);
    expect(query).toContain('?s a <https://schema.org/CreativeWork>');
  });

  it('inlines a subjectFilter when provided', () => {
    const query = buildSubjectSelectorQuery(
      targetClass,
      10,
      '?s <https://example.org/inDataset> <urn:d> .',
    );
    expect(query).toContain('?s <https://example.org/inDataset> <urn:d> .');
  });

  it('emits a FROM clause when the distribution has a named graph', () => {
    const query = buildSubjectSelectorQuery(
      targetClass,
      10,
      undefined,
      'https://example.org/graph',
    );
    expect(query).toContain('FROM <https://example.org/graph>');
  });
});

describe('shaclSampleStages', () => {
  it('returns one Stage per sh:targetClass in the SHACL', async () => {
    const stages = await shaclSampleStages({ shapesFile });
    const names = stages.map((s) => s.name).sort();
    expect(names).toEqual([
      'shacl-sample-CreativeWork',
      'shacl-sample-Organization',
      'shacl-sample-Person',
      'shacl-sample-Place',
    ]);
  });

  it('does not attach a validator slot when no validator is passed', async () => {
    const stages = await shaclSampleStages({ shapesFile });
    for (const stage of stages) {
      expect(stage.validator).toBeUndefined();
    }
  });

  it('attaches the provided validator to every stage', async () => {
    const validator = {
      validate: async () => ({ conforms: true, violations: 0 }),
      report: async () => ({
        conforms: true,
        violations: 0,
        quadsValidated: 0,
      }),
    };
    const stages = await shaclSampleStages({ shapesFile, validator });
    for (const stage of stages) {
      expect(stage.validator).toBe(validator);
    }
  });
});
