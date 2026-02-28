import { describe, it, expect } from 'vitest';
import { ConsoleReporter } from '../src/consoleReporter.js';

describe('ConsoleReporter', () => {
  it('can be instantiated', () => {
    const reporter = new ConsoleReporter();
    expect(reporter).toBeInstanceOf(ConsoleReporter);
  });
});
