import { createDatatypeAnalyzer, PerClassAnalyzer } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('createDatatypeAnalyzer', () => {
  it('creates an analyzer with the correct query file', async () => {
    const analyzer = await createDatatypeAnalyzer();

    expect(analyzer.name).toBe('class-property-datatypes.rq');
    expect(analyzer).toBeInstanceOf(PerClassAnalyzer);
  });
});
