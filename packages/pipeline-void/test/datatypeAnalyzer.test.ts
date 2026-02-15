import { createDatatypeStage, Stage } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('createDatatypeStage', () => {
  it('creates a stage with the correct query file', async () => {
    const stage = await createDatatypeStage();

    expect(stage.name).toBe('class-property-datatypes.rq');
    expect(stage).toBeInstanceOf(Stage);
  });
});
