import { DatatypeAnalyzer } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('DatatypeAnalyzer', () => {
  describe('create', () => {
    it('creates an analyzer with the correct query file', async () => {
      const analyzer = await DatatypeAnalyzer.create();

      expect(analyzer.name).toBe('class-property-datatypes.rq');
      expect(analyzer).toBeInstanceOf(DatatypeAnalyzer);
    });
  });
});
