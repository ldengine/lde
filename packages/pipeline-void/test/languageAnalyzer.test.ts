import { createLanguageAnalyzer, PerClassAnalyzer } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('createLanguageAnalyzer', () => {
  it('creates an analyzer with the correct query file', async () => {
    const analyzer = await createLanguageAnalyzer();

    expect(analyzer.name).toBe('class-property-languages.rq');
    expect(analyzer).toBeInstanceOf(PerClassAnalyzer);
  });
});
