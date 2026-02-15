import {
  createDatatypeStage,
  createLanguageStage,
  createObjectClassStage,
  Stage,
} from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('per-class stages', () => {
  it('createDatatypeStage returns a Stage', async () => {
    const stage = await createDatatypeStage();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-datatypes.rq');
  });

  it('createLanguageStage returns a Stage', async () => {
    const stage = await createLanguageStage();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-languages.rq');
  });

  it('createObjectClassStage returns a Stage', async () => {
    const stage = await createObjectClassStage();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-object-classes.rq');
  });
});
