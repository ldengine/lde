import type { Quad } from '@rdfjs/types';
import type { Dataset } from '@lde/dataset';

/** Validates RDF quads against a set of constraints. */
export interface Validator {
  /** Validate a batch of quads. Accumulates results internally. */
  validate(quads: Quad[], dataset: Dataset): Promise<ValidationResult>;

  /** Return accumulated validation results for a dataset. */
  report(dataset: Dataset): Promise<ValidationReport>;
}

/** Result of validating a single batch. */
export interface ValidationResult {
  violations: number;
  conforms: boolean;
  /** Human-readable detail, e.g. path to the report file. Included in error messages on halt. */
  message?: string;
}

/** Accumulated validation results for a dataset. */
export interface ValidationReport extends ValidationResult {
  quadsValidated: number;
}

/** Options for {@link requireNonEmptyData}. */
export interface RequireNonEmptyDataOptions {
  /**
   * Message attached to the synthesised non-conformance.
   * @default 'Validator received no quads for this dataset.'
   */
  message?: string;
}

/**
 * Decorate a {@link Validator} so its dataset report flips to non-conforming
 * when no quads were ever validated for that dataset.
 *
 * Useful when the upstream stages are expected to produce *some* data — for
 * instance per-class samplers whose `ItemSelector` returns zero subjects for
 * every target class. The decorator keeps the underlying validator’s
 * semantics intact: it only synthesises an extra violation when
 * {@link ValidationReport.quadsValidated} is `0`.
 *
 * The decorator is stateless; per-dataset accumulation stays in the
 * underlying validator.
 */
export function requireNonEmptyData(
  inner: Validator,
  options?: RequireNonEmptyDataOptions,
): Validator {
  const message =
    options?.message ?? 'Validator received no quads for this dataset.';
  return {
    validate: (quads, dataset) => inner.validate(quads, dataset),
    async report(dataset) {
      const innerReport = await inner.report(dataset);
      if (innerReport.quadsValidated > 0) return innerReport;
      return {
        conforms: false,
        violations: innerReport.violations + 1,
        quadsValidated: 0,
        message,
      };
    },
  };
}
