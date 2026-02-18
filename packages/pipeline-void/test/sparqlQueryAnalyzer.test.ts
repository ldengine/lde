import {
  createTriplesStage,
  createPropertiesStage,
  Stage,
} from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('named stage functions', () => {
  it('createTriplesStage returns a Stage with triples.rq', async () => {
    const stage = await createTriplesStage();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('triples.rq');
  });

  it('createPropertiesStage returns a Stage with properties.rq', async () => {
    const stage = await createPropertiesStage();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('properties.rq');
  });
});
