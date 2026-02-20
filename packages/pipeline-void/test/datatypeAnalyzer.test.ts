import { perClassDatatype, Stage } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('perClassDatatype', () => {
  it('creates a stage with the correct query file', async () => {
    const stage = await perClassDatatype();

    expect(stage.name).toBe('class-property-datatypes.rq');
    expect(stage).toBeInstanceOf(Stage);
  });
});
