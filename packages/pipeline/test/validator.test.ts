import { describe, it, expect, vi } from 'vitest';
import { Dataset } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import {
  requireNonEmptyData,
  type Validator,
  type ValidationResult,
  type ValidationReport,
} from '../src/validator.js';

const datasetA = new Dataset({
  iri: new URL('http://example.org/dataset/a'),
  distributions: [],
});

const datasetB = new Dataset({
  iri: new URL('http://example.org/dataset/b'),
  distributions: [],
});

function fakeValidator(report: ValidationReport): Validator {
  const validate =
    vi.fn<(quads: Quad[], dataset: Dataset) => Promise<ValidationResult>>();
  validate.mockResolvedValue({
    conforms: report.conforms,
    violations: report.violations,
  });
  return {
    validate,
    report: vi
      .fn<(dataset: Dataset) => Promise<ValidationReport>>()
      .mockResolvedValue(report),
  };
}

describe('requireNonEmptyData', () => {
  it('forwards validate calls unchanged', async () => {
    const inner = fakeValidator({
      conforms: true,
      violations: 0,
      quadsValidated: 0,
    });
    const wrapped = requireNonEmptyData(inner);

    const quads: Quad[] = [];
    await wrapped.validate(quads, datasetA);

    expect(inner.validate).toHaveBeenCalledWith(quads, datasetA);
  });

  it('returns the inner report unchanged when quadsValidated > 0', async () => {
    const innerReport: ValidationReport = {
      conforms: true,
      violations: 0,
      quadsValidated: 42,
    };
    const wrapped = requireNonEmptyData(fakeValidator(innerReport));

    const report = await wrapped.report(datasetA);

    expect(report).toEqual(innerReport);
  });

  it('flips to non-conforming when quadsValidated is 0', async () => {
    const wrapped = requireNonEmptyData(
      fakeValidator({ conforms: true, violations: 0, quadsValidated: 0 }),
    );

    const report = await wrapped.report(datasetA);

    expect(report.conforms).toBe(false);
    expect(report.violations).toBe(1);
    expect(report.quadsValidated).toBe(0);
    expect(report.message).toMatch(/no quads/i);
  });

  it('increments existing violations rather than overwriting them', async () => {
    const wrapped = requireNonEmptyData(
      fakeValidator({ conforms: false, violations: 3, quadsValidated: 0 }),
    );

    const report = await wrapped.report(datasetA);

    expect(report.violations).toBe(4);
  });

  it('surfaces a custom message when provided', async () => {
    const wrapped = requireNonEmptyData(
      fakeValidator({ conforms: true, violations: 0, quadsValidated: 0 }),
      { message: 'No SCHEMA-AP-NDE target class matched.' },
    );

    const report = await wrapped.report(datasetA);

    expect(report.message).toBe('No SCHEMA-AP-NDE target class matched.');
  });

  it('produces independent reports for different datasets', async () => {
    // The inner validator’s mock returns one report; in real use it would
    // accumulate per-dataset state. Here we just check the wrapper doesn’t
    // hold on to dataset-scoped state of its own.
    const innerReport: ValidationReport = {
      conforms: true,
      violations: 0,
      quadsValidated: 10,
    };
    const wrapped = requireNonEmptyData(fakeValidator(innerReport));

    expect(await wrapped.report(datasetA)).toEqual(innerReport);
    expect(await wrapped.report(datasetB)).toEqual(innerReport);
  });
});
