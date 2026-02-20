import { countTriples, countProperties, Stage } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('named stage functions', () => {
  it('countTriples() returns a Stage with triples.rq', async () => {
    const stage = await countTriples();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('triples.rq');
  });

  it('countProperties() returns a Stage with properties.rq', async () => {
    const stage = await countProperties();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('properties.rq');
  });
});
