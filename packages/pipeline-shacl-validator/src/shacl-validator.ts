import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Quad } from '@rdfjs/types';
import type { Dataset } from '@lde/dataset';

import type {
  Validator,
  ValidationResult,
  ValidationReport,
} from '@lde/pipeline';
import { serializeQuads, type SerializationFormat } from '@lde/pipeline';
// @ts-expect-error -- shacl-engine has no type declarations.
import ShaclEngine from 'shacl-engine/Validator.js';
// @ts-expect-error -- rdf-ext has no type declarations.
import rdf from 'rdf-ext';
import { rdfDereferencer } from 'rdf-dereference';
import filenamifyUrl from 'filenamify-url';

/** File extension per serialization format. */
const formatExtensions: Record<SerializationFormat, string> = {
  Turtle: '.ttl',
  'N-Triples': '.nt',
  'N-Quads': '.nq',
};

/** Options for {@link ShaclValidator}. */
export interface ShaclValidatorOptions {
  /** Path to an RDF file containing SHACL shapes (any format supported by rdf-dereference). */
  shapesFile: string;
  /** Directory for validation report files. */
  reportDir: string;
  /** Serialization format for report files. @default 'Turtle' */
  reportFormat?: SerializationFormat;
}

interface DatasetAccumulator {
  quadsValidated: number;
  violations: number;
  conforms: boolean;
}

/**
 * SHACL-based {@link Validator} for `@lde/pipeline`.
 *
 * Validates quads against shapes loaded from an RDF file (any format
 * supported by rdf-dereference) and writes per-dataset report files
 * in SHACL validation report format.
 */
export class ShaclValidator implements Validator {
  private readonly shapesFile: string;
  private readonly reportDir: string;
  private readonly reportFormat: SerializationFormat;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private shapesDataset: any | undefined;
  private readonly accumulators = new Map<string, DatasetAccumulator>();

  constructor(options: ShaclValidatorOptions) {
    this.shapesFile = options.shapesFile;
    this.reportDir = options.reportDir;
    this.reportFormat = options.reportFormat ?? 'Turtle';
  }

  async validate(quads: Quad[], dataset: Dataset): Promise<ValidationResult> {
    if (quads.length === 0) {
      return { conforms: true, violations: 0 };
    }

    const shapes = await this.getShapes();
    const dataDataset = rdf.dataset(quads);

    const validator = new ShaclEngine(shapes, { factory: rdf });
    const report = await validator.validate({ dataset: dataDataset });

    const violations = report.results.length;
    const conforms = report.conforms as boolean;

    // Accumulate per dataset.
    const key = dataset.iri.toString();
    const acc = this.accumulators.get(key) ?? {
      quadsValidated: 0,
      violations: 0,
      conforms: true,
    };
    acc.quadsValidated += quads.length;
    acc.violations += violations;
    if (!conforms) acc.conforms = false;
    this.accumulators.set(key, acc);

    // Write violations to report file.
    if (violations > 0) {
      const reportFile = await this.writeReportFile(dataset, report);
      return { conforms, violations, message: `See ${reportFile}` };
    }

    return { conforms, violations };
  }

  async report(dataset: Dataset): Promise<ValidationReport> {
    const key = dataset.iri.toString();
    const acc = this.accumulators.get(key);
    if (!acc) {
      return { conforms: true, violations: 0, quadsValidated: 0 };
    }
    return {
      conforms: acc.conforms,
      violations: acc.violations,
      quadsValidated: acc.quadsValidated,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getShapes(): Promise<any> {
    if (!this.shapesDataset) {
      const { data } = await rdfDereferencer.dereference(this.shapesFile, {
        localFiles: true,
      });
      this.shapesDataset = await rdf.dataset().import(data);
    }
    return this.shapesDataset;
  }

  private async writeReportFile(
    dataset: Dataset,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    report: any,
  ): Promise<string> {
    await mkdir(this.reportDir, { recursive: true });

    const datasetName = filenamifyUrl(dataset.iri.toString());
    const extension = formatExtensions[this.reportFormat];
    const filePath = join(
      this.reportDir,
      `${datasetName}.validation${extension}`,
    );

    const reportQuads: Quad[] = [...report.dataset];
    const serialized = await serializeQuads(reportQuads, this.reportFormat);

    // Append to existing file or create a new one.
    try {
      await appendFile(filePath, '\n' + serialized);
    } catch {
      await writeFile(filePath, serialized);
    }

    return filePath;
  }
}
