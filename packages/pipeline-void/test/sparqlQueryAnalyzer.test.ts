import { createQueryStage, Stage } from '../src/index.js';
import { Distribution } from '@lde/dataset';
import { describe, it, expect } from 'vitest';

describe('createQueryStage', () => {
  const distribution = Distribution.sparql(
    new URL('http://example.com/sparql')
  );

  it('returns a Stage with the query filename as name', async () => {
    const stage = await createQueryStage('triples.rq', distribution);

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('triples.rq');
  });

  it('creates a stage for any query file', async () => {
    const stage = await createQueryStage('properties.rq', distribution);

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('properties.rq');
  });

  it('accepts a distribution with subjectFilter', async () => {
    const dist = Distribution.sparql(new URL('http://example.com/sparql'));
    dist.subjectFilter = 'FILTER(?s = <http://example.com/s>)';

    const stage = await createQueryStage('triples.rq', dist);

    expect(stage).toBeInstanceOf(Stage);
  });

  it('accepts a distribution without subjectFilter', async () => {
    const dist = Distribution.sparql(new URL('http://example.com/sparql'));

    const stage = await createQueryStage('triples.rq', dist);

    expect(stage).toBeInstanceOf(Stage);
  });
});
