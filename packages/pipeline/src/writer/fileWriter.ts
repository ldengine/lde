import { Dataset } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import { createWriteStream, type WriteStream } from 'node:fs';
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
   * @default 'n-triples'
   */
  format?: 'turtle' | 'n-triples' | 'n-quads';
  /**
   * Character used to replace URL-unsafe characters in filenames.
   * @default '-'
   */
  replacementCharacter?: string;
  /**
   * Turtle prefix declarations. Keys are prefix names, values are namespace IRIs.
   * Only used when format is 'turtle'.
   */
  prefixes?: Record<string, string>;
}

/**
 * Streams RDF quads to files on disk using N3 Writer.
 *
 * Files are named based on the dataset IRI using filenamify-url.
 *
 * A single N3Writer is kept open per dataset across all {@link write} calls,
 * so Turtle prefix declarations are written once and triples can be grouped
 * by subject. Call {@link flush} after all stages complete to finalize the file.
 */
const formatMap: Record<string, string> = {
  turtle: 'Turtle',
  'n-triples': 'N-Triples',
  'n-quads': 'N-Quads',
};

export class FileWriter implements Writer {
  private readonly outputDir: string;
  readonly format: 'turtle' | 'n-triples' | 'n-quads';
  private readonly replacementCharacter: string;
  private readonly prefixes?: Record<string, string>;
  private readonly activeWriters = new Map<
    string,
    { n3Writer: N3Writer; stream: WriteStream }
  >();

  constructor(options: FileWriterOptions) {
    this.outputDir = options.outputDir;
    this.format = options.format ?? 'n-triples';
    this.replacementCharacter = options.replacementCharacter ?? '-';
    this.prefixes = options.prefixes;
  }

  async write(dataset: Dataset, quads: AsyncIterable<Quad>): Promise<void> {
    // Peek at the first quad to avoid creating empty files.
    const iterator = quads[Symbol.asyncIterator]();
    const first = await iterator.next();
    if (first.done) return;

    const { n3Writer } = await this.getOrCreateWriter(dataset);

    n3Writer.addQuad(first.value);
    for await (const quad of { [Symbol.asyncIterator]: () => iterator }) {
      n3Writer.addQuad(quad);
    }
  }

  async flush(dataset: Dataset): Promise<void> {
    const key = this.getFilePath(dataset);
    const entry = this.activeWriters.get(key);
    if (!entry) return;

    this.activeWriters.delete(key);
    await new Promise<void>((resolve, reject) => {
      if (entry.stream.errored) {
        reject(entry.stream.errored);
        return;
      }
      entry.n3Writer.end((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  getOutputPath(dataset: Dataset): string {
    return this.getFilePath(dataset);
  }

  getFilename(dataset: Dataset): string {
    const extension = this.getExtension();
    const baseName = filenamifyUrl(dataset.iri.toString(), {
      replacement: this.replacementCharacter,
    });
    return `${baseName}.${extension}`;
  }

  private getFilePath(dataset: Dataset): string {
    return join(this.outputDir, this.getFilename(dataset));
  }

  private async getOrCreateWriter(
    dataset: Dataset,
  ): Promise<{ n3Writer: N3Writer; stream: WriteStream }> {
    const key = this.getFilePath(dataset);
    const existing = this.activeWriters.get(key);
    if (existing) return existing;

    await mkdir(dirname(key), { recursive: true });

    const stream = createWriteStream(key, { flags: 'w' });
    stream.on('error', (error) => {
      // Surface stream errors when flushing; prevents 'unhandled error' crashes.
      stream.destroy(error);
    });
    const n3Writer = new N3Writer(stream, {
      format: formatMap[this.format],
      prefixes: this.prefixes,
    });

    const entry = { n3Writer, stream };
    this.activeWriters.set(key, entry);
    return entry;
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
