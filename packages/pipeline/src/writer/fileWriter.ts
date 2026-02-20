import { Dataset } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import filenamifyUrl from 'filenamify-url';
import { Writer as N3Writer } from 'n3';
import { Writer } from './writer.js';

export interface FileWriterOptions {
  /**
   * Output directory for written files.
   */
  outputDir: string;
  /**
   * File format to write.
   * @default 'turtle'
   */
  format?: 'turtle' | 'n-triples' | 'n-quads';
}

/**
 * Streams RDF quads to files on disk using N3 Writer.
 *
 * Files are named based on the dataset IRI using filenamify-url.
 *
 * The first {@link write} call for a given dataset creates (or overwrites) the file.
 * Subsequent calls for the same dataset append to it, so that multiple pipeline stages
 * can each contribute quads to a single output file.
 *
 * **Note:** With `format: 'turtle'` (the default) each append will repeat the prefix
 * declarations at the start of each chunk. For multi-stage pipelines, prefer
 * `format: 'n-triples'` or `format: 'n-quads'`, which produce clean line-oriented
 * output without repeated headers.
 */
const formatMap: Record<string, string> = {
  turtle: 'Turtle',
  'n-triples': 'N-Triples',
  'n-quads': 'N-Quads',
};

export class FileWriter implements Writer {
  private readonly outputDir: string;
  readonly format: 'turtle' | 'n-triples' | 'n-quads';
  private readonly writtenFiles = new Set<string>();

  constructor(options: FileWriterOptions) {
    this.outputDir = options.outputDir;
    this.format = options.format ?? 'turtle';
  }

  async write(dataset: Dataset, quads: AsyncIterable<Quad>): Promise<void> {
    // Peek at the first quad to avoid creating empty files.
    const iterator = quads[Symbol.asyncIterator]();
    const first = await iterator.next();
    if (first.done) return;

    const filePath = join(this.outputDir, this.getFilename(dataset));
    await mkdir(dirname(filePath), { recursive: true });

    const flags = this.writtenFiles.has(filePath) ? 'a' : 'w';
    this.writtenFiles.add(filePath);

    const stream = createWriteStream(filePath, { flags });
    const writer = new N3Writer(stream, { format: formatMap[this.format] });

    writer.addQuad(first.value);
    for await (const quad of { [Symbol.asyncIterator]: () => iterator }) {
      writer.addQuad(quad);
    }

    await new Promise<void>((resolve, reject) => {
      writer.end((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  getOutputPath(dataset: Dataset): string {
    return join(this.outputDir, this.getFilename(dataset));
  }

  getFilename(dataset: Dataset): string {
    const extension = this.getExtension();
    const baseName = filenamifyUrl(dataset.iri.toString(), {
      replacement: '_',
    });
    return `${baseName}.${extension}`;
  }

  private getExtension(): string {
    switch (this.format) {
      case 'turtle':
        return 'ttl';
      case 'n-triples':
        return 'nt';
      case 'n-quads':
        return 'nq';
    }
  }
}
