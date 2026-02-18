import {
  createPerClassDatatypeStage,
  createPerClassLanguageStage,
  createPerClassObjectClassStage,
  Stage,
} from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('per-class stages', () => {
  it('createPerClassDatatypeStage returns a Stage', async () => {
    const stage = await createPerClassDatatypeStage();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-datatypes.rq');
  });

  it('createPerClassLanguageStage returns a Stage', async () => {
    const stage = await createPerClassLanguageStage();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-languages.rq');
  });

  it('createPerClassObjectClassStage returns a Stage', async () => {
    const stage = await createPerClassObjectClassStage();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-object-classes.rq');
  });
});
