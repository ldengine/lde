import { createObjectClassStage, Stage } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('createObjectClassStage', () => {
  it('creates a stage with the correct query file', async () => {
    const stage = await createObjectClassStage();

    expect(stage.name).toBe('class-property-object-classes.rq');
    expect(stage).toBeInstanceOf(Stage);
  });
});
