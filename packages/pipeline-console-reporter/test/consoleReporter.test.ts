import { describe, it, expect, vi } from 'vitest';
import { ConsoleReporter } from '../src/consoleReporter.js';
import { Dataset, Distribution } from '@lde/dataset';
import type { DistributionAnalysisResult } from '@lde/pipeline';

function makeDataset(): Dataset {
  return new Dataset({
    iri: new URL('http://example.org/dataset'),
    distributions: [],
  });
}

function makeProbeResult(
  url: string,
  overrides: Partial<DistributionAnalysisResult> = {},
): DistributionAnalysisResult {
  return {
    distribution: Distribution.sparql(new URL(url)),
    type: 'sparql',
    available: true,
    statusCode: 200,
    ...overrides,
  };
}

describe('ConsoleReporter', () => {
  it('can be instantiated', () => {
    const reporter = new ConsoleReporter();
    expect(reporter).toBeInstanceOf(ConsoleReporter);
  });

  describe('stageValidated', () => {
    it('shows success when validation conforms', () => {
      const reporter = new ConsoleReporter();
      const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      reporter.stageValidated('transform', {
        conforms: true,
        violations: 0,
        quadsValidated: 5000,
      });

      const output = spy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).toContain('Validated');
      expect(output).toContain('5K');
      spy.mockRestore();
    });

    it('shows failure with violation count when validation does not conform', () => {
      const reporter = new ConsoleReporter();
      const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      reporter.stageValidated('transform', {
        conforms: false,
        violations: 3,
        quadsValidated: 10000,
      });

      const output = spy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).toContain('Validated');
      expect(output).toContain('10K');
      expect(output).toContain('violation');
      spy.mockRestore();
    });
  });

  describe('distributionSelected', () => {
    it('includes triple count when present', () => {
      const reporter = new ConsoleReporter();
      const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      reporter.distributionSelected(
        makeDataset(),
        Distribution.sparql(new URL('http://localhost:7001/sparql')),
        new Distribution(
          new URL('http://example.org/data.nt'),
          'application/n-triples',
        ),
        5000,
        4800000,
      );

      const output = spy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).toContain('4.8M triples');
      expect(output).toContain('to http://localhost:7001/sparql');
      spy.mockRestore();
    });

    it('appends "(selected)" to matching probe line instead of printing a separate line', () => {
      const reporter = new ConsoleReporter();
      const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      reporter.datasetStart(makeDataset());

      const sparqlUrl = 'http://sparql.example.com/';
      reporter.distributionProbed(makeProbeResult(sparqlUrl));
      reporter.distributionSelected(
        makeDataset(),
        Distribution.sparql(new URL(sparqlUrl)),
      );

      const output = spy.mock.calls.map((call) => String(call[0])).join('');
      // The rewritten probe line should contain both the probe text and "(selected)".
      expect(output).toContain('SPARQL endpoint');
      expect(output).toContain('(selected)');
      // There should be a cursor-up escape sequence, indicating in-place rewrite.
      expect(output).toContain('\x1B[1A');
      spy.mockRestore();
    });

    it('omits triple count when absent', () => {
      const reporter = new ConsoleReporter();
      const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

      reporter.distributionSelected(
        makeDataset(),
        Distribution.sparql(new URL('http://localhost:7001/sparql')),
        new Distribution(
          new URL('http://example.org/data.nt'),
          'application/n-triples',
        ),
        5000,
      );

      const output = spy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).not.toContain('triples');
      expect(output).toContain('to http://localhost:7001/sparql');
      spy.mockRestore();
    });
  });
});
