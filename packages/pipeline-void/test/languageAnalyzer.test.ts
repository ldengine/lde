import { createLanguageStage, Stage } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('createLanguageStage', () => {
  it('creates a stage with the correct query file', async () => {
    const stage = await createLanguageStage();

    expect(stage.name).toBe('class-property-languages.rq');
    expect(stage).toBeInstanceOf(Stage);
  });
});
