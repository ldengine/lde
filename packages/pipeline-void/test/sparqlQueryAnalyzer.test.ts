import { createQueryStage, Stage } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('createQueryStage', () => {
  it('returns a Stage with the query filename as name', async () => {
    const stage = await createQueryStage('triples.rq');

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('triples.rq');
  });

  it('creates a stage for any query file', async () => {
    const stage = await createQueryStage('properties.rq');

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('properties.rq');
  });
});
