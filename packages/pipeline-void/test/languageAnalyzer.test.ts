import { LanguageAnalyzer } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('LanguageAnalyzer', () => {
  describe('create', () => {
    it('creates an analyzer with the correct query file', async () => {
      const analyzer = await LanguageAnalyzer.create();

      expect(analyzer.name).toBe('class-property-languages.rq');
      expect(analyzer).toBeInstanceOf(LanguageAnalyzer);
    });
  });
});
