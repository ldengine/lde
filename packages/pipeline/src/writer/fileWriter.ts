import { Dataset } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import filenamifyUrl from 'filenamify-url';
import { Writer } from './writer.js';
import { serializeQuads, type SerializationFormat } from './serialize.js';

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
 * Writes RDF data to files on disk.
 *
 * Files are named based on the dataset IRI using filenamify-url.
 */
const formatMap: Record<string, SerializationFormat> = {
  turtle: 'Turtle',
  'n-triples': 'N-Triples',
  'n-quads': 'N-Quads',
};

export class FileWriter implements Writer {
  private readonly outputDir: string;
  private readonly format: 'turtle' | 'n-triples' | 'n-quads';

  constructor(options: FileWriterOptions) {
    this.outputDir = options.outputDir;
    this.format = options.format ?? 'turtle';
  }

  async write(dataset: Dataset, quads: AsyncIterable<Quad>): Promise<void> {
    const collected: Quad[] = [];
    for await (const quad of quads) {
      collected.push(quad);
    }

    if (collected.length === 0) {
      return;
    }

    const filename = this.getFilename(dataset);
    const filePath = join(this.outputDir, filename);

    // Ensure the output directory exists.
    await mkdir(dirname(filePath), { recursive: true });

    const content = await serializeQuads(collected, formatMap[this.format]);
    await writeFile(filePath, content, 'utf-8');
  }

  private getFilename(dataset: Dataset): string {
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
