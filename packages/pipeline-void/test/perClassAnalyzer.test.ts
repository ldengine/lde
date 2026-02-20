import {
  perClassDatatypes,
  perClassLanguages,
  perClassObjectClasses,
  Stage,
} from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('per-class stages', () => {
  it('perClassDatatypes() returns a Stage', async () => {
    const stage = await perClassDatatypes();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-datatypes.rq');
  });

  it('perClassLanguages() returns a Stage', async () => {
    const stage = await perClassLanguages();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-languages.rq');
  });

  it('perClassObjectClasses() returns a Stage', async () => {
    const stage = await perClassObjectClasses();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-object-classes.rq');
  });
});
