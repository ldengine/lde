import { createPerClassObjectClassStage, Stage } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('createPerClassObjectClassStage', () => {
  it('creates a stage with the correct query file', async () => {
    const stage = await createPerClassObjectClassStage();

    expect(stage.name).toBe('class-property-object-classes.rq');
    expect(stage).toBeInstanceOf(Stage);
  });
});
