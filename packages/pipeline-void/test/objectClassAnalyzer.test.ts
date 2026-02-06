import { ObjectClassAnalyzer } from '../src/index.js';
import { describe, it, expect } from 'vitest';

describe('ObjectClassAnalyzer', () => {
  describe('create', () => {
    it('creates an analyzer with the correct query file', async () => {
      const analyzer = await ObjectClassAnalyzer.create();

      expect(analyzer.name).toBe('class-property-object-classes.rq');
      expect(analyzer).toBeInstanceOf(ObjectClassAnalyzer);
    });
  });
});
