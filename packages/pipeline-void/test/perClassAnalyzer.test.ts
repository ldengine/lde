import {
  perClassDatatype,
  perClassLanguage,
  perClassObjectClass,
  Stage,
} from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('per-class stages', () => {
  it('perClassDatatype() returns a Stage', async () => {
    const stage = await perClassDatatype();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-datatypes.rq');
  });

  it('perClassLanguage() returns a Stage', async () => {
    const stage = await perClassLanguage();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-languages.rq');
  });

  it('perClassObjectClass() returns a Stage', async () => {
    const stage = await perClassObjectClass();

    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('class-property-object-classes.rq');
  });
});
