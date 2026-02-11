import {
  createDatatypeStage,
  createLanguageStage,
  createObjectClassStage,
  Stage,
} from '../src/index.js';
import { Distribution } from '@lde/dataset';
import { describe, it, expect } from 'vitest';

describe('per-class stages', () => {
  const distribution = Distribution.sparql(
    new URL('http://example.com/sparql')
  );

  it('createDatatypeStage returns a Stage', async () => {
    const stage = await createDatatypeStage(distribution);

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-datatypes.rq');
  });

  it('createLanguageStage returns a Stage', async () => {
    const stage = await createLanguageStage(distribution);

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-languages.rq');
  });

  it('createObjectClassStage returns a Stage', async () => {
    const stage = await createObjectClassStage(distribution);

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-object-classes.rq');
  });

  it('accepts a distribution with subjectFilter', async () => {
    const filtered = Distribution.sparql(new URL('http://example.com/sparql'));
    filtered.subjectFilter = '?s <http://example.com/inDataset> ?dataset .';

    const stage = await createDatatypeStage(filtered);

    expect(stage).toBeInstanceOf(Stage);
  });

  it('accepts a distribution with namedGraph', async () => {
    const graphDist = Distribution.sparql(
      new URL('http://example.com/sparql'),
      'http://example.com/graph'
    );

    const stage = await createDatatypeStage(graphDist);

    expect(stage).toBeInstanceOf(Stage);
  });
});
