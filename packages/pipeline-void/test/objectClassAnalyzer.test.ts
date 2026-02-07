import { createObjectClassAnalyzer, PerClassAnalyzer } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('createObjectClassAnalyzer', () => {
  it('creates an analyzer with the correct query file', async () => {
    const analyzer = await createObjectClassAnalyzer();

    expect(analyzer.name).toBe('class-property-object-classes.rq');
    expect(analyzer).toBeInstanceOf(PerClassAnalyzer);
  });
});
