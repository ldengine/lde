import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Quad } from '@rdfjs/types';
import { Writer } from 'n3';
import type { Dataset } from '@lde/dataset';
import type {
  Validator,
  ValidationResult,
  ValidationReport,
} from '@lde/pipeline';
// @ts-expect-error -- shacl-engine has no type declarations.
import ShaclEngine from 'shacl-engine/Validator.js';
// @ts-expect-error -- rdf-ext has no type declarations.
import rdf from 'rdf-ext';
import { rdfDereferencer } from 'rdf-dereference';
import filenamifyUrl from 'filenamify-url';

/** Options for {@link ShaclValidator}. */
export interface ShaclValidatorOptions {
  /** Path to an RDF file containing SHACL shapes (any format supported by rdf-dereference). */
  shapesFile: string;
  /** Directory for validation report files. */
  reportDir: string;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private shapesDataset: any | undefined;
  private readonly accumulators = new Map<string, DatasetAccumulator>();

  constructor(options: ShaclValidatorOptions) {
    this.shapesFile = options.shapesFile;
    this.reportDir = options.reportDir;
  }

  async validate(quads: Quad[], dataset: Dataset): Promise<ValidationResult> {
    if (quads.length === 0) {
      return { conforms: true, violations: 0 };
    }

    const shapes = await this.loadShapes();
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
  private async loadShapes(): Promise<any> {
    if (this.shapesDataset) return this.shapesDataset;

    const { data } = await rdfDereferencer.dereference(this.shapesFile, {
      localFiles: true,
    });
    const dataset = rdf.dataset();
    for await (const quad of data) {
      dataset.add(quad);
    }
    this.shapesDataset = dataset;
    return this.shapesDataset;
  }

  private async writeReportFile(
    dataset: Dataset,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    report: any,
  ): Promise<string> {
    await mkdir(this.reportDir, { recursive: true });

    const datasetName = filenamifyUrl(dataset.iri.toString());
    const filePath = join(this.reportDir, `${datasetName}.validation.ttl`);

    // Serialize the SHACL report dataset to Turtle.
    const reportQuads: Quad[] = [...report.dataset];
    const turtle = await new Promise<string>((resolve, reject) => {
      const writer = new Writer({
        prefixes: {
          sh: 'http://www.w3.org/ns/shacl#',
        },
      });
      for (const quad of reportQuads) {
        writer.addQuad(quad);
      }
      writer.end((error: Error | null, result: string) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    // Check if file exists; if so, append. Otherwise, create.
    try {
      await appendFile(filePath, '\n' + turtle);
    } catch {
      await writeFile(filePath, turtle);
    }

    return filePath;
  }
}
