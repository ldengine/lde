import { createObjectClassStage, Stage } from '../src/index.js';
import { Distribution } from '@lde/dataset';
import { describe, it, expect } from 'vitest';

describe('createObjectClassStage', () => {
  it('creates a stage with the correct query file', async () => {
    const distribution = Distribution.sparql(
      new URL('http://example.com/sparql')
    );

    const stage = await createObjectClassStage(distribution);

    expect(stage.name).toBe('class-property-object-classes.rq');
    expect(stage).toBeInstanceOf(Stage);
  });
});
