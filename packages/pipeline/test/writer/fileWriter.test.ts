import { FileWriter } from '../../src/writer/fileWriter.js';
import { Dataset, Distribution } from '@lde/dataset';
import { DataFactory } from 'n3';
import type { Quad } from '@rdfjs/types';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { namedNode, literal, quad } = DataFactory;

async function* quadsOf(...quads: Quad[]): AsyncIterable<Quad> {
  yield* quads;
}

describe('FileWriter', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-writer-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function createDataset(iri: string): Dataset {
    return new Dataset({
      iri: new URL(iri),
      distributions: [
        Distribution.sparql(new URL('http://example.com/sparql')),
      ],
    });
  }

  describe('write', () => {
    it('writes quads to N-Triples file by default', async () => {
      const writer = new FileWriter({ outputDir: tempDir });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/subject'),
            namedNode('http://example.com/predicate'),
            literal('object'),
          ),
        ),
      );
      await writer.flush(dataset);

      const files = await readFile(
        join(tempDir, 'example.com-dataset-1.nt'),
        'utf-8',
      );
      expect(files).toContain('<http://example.com/subject>');
      expect(files).toContain('<http://example.com/predicate>');
      expect(files).toContain('"object"');
    });

    it('writes N-Triples format', async () => {
      const writer = new FileWriter({
        outputDir: tempDir,
        format: 'n-triples',
      });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/subject'),
            namedNode('http://example.com/predicate'),
            literal('object'),
          ),
        ),
      );
      await writer.flush(dataset);

      const content = await readFile(
        join(tempDir, 'example.com-dataset-1.nt'),
        'utf-8',
      );
      expect(content).toContain('<http://example.com/subject>');
    });

    it('does not write empty data', async () => {
      const writer = new FileWriter({ outputDir: tempDir });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(dataset, quadsOf());
      await writer.flush(dataset);

      await expect(
        readFile(join(tempDir, 'example.com-dataset-1.nt')),
      ).rejects.toThrow();
    });

    it('combines quads from multiple write calls into a single file', async () => {
      const writer = new FileWriter({
        outputDir: tempDir,
        format: 'n-triples',
      });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/s1'),
            namedNode('http://example.com/p'),
            literal('first'),
          ),
        ),
      );

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/s2'),
            namedNode('http://example.com/p'),
            literal('second'),
          ),
        ),
      );

      await writer.flush(dataset);

      const content = await readFile(
        join(tempDir, 'example.com-dataset-1.nt'),
        'utf-8',
      );
      expect(content).toContain('<http://example.com/s1>');
      expect(content).toContain('<http://example.com/s2>');
      expect(content).toContain('"first"');
      expect(content).toContain('"second"');
    });

    it('uses custom replacement character in filenames', async () => {
      const writer = new FileWriter({
        outputDir: tempDir,
        replacementCharacter: '_',
      });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/s'),
            namedNode('http://example.com/p'),
            literal('o'),
          ),
        ),
      );
      await writer.flush(dataset);

      const content = await readFile(
        join(tempDir, 'example.com_dataset_1.nt'),
        'utf-8',
      );
      expect(content).toBeTruthy();
    });

    it('creates nested output directories', async () => {
      const nestedDir = join(tempDir, 'nested', 'output');
      const writer = new FileWriter({ outputDir: nestedDir });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/s'),
            namedNode('http://example.com/p'),
            literal('o'),
          ),
        ),
      );
      await writer.flush(dataset);

      const content = await readFile(
        join(nestedDir, 'example.com-dataset-1.nt'),
        'utf-8',
      );
      expect(content).toBeTruthy();
    });
  });

  describe('flush', () => {
    it('is a no-op when no write was made for the dataset', async () => {
      const writer = new FileWriter({ outputDir: tempDir });
      const dataset = createDataset('http://example.com/dataset/1');

      // Should not throw.
      await writer.flush(dataset);
    });
  });

  describe('Turtle prefixes', () => {
    it('writes prefix declarations and compacts IRIs', async () => {
      const writer = new FileWriter({
        outputDir: tempDir,
        format: 'turtle',
        prefixes: {
          ex: 'http://example.com/',
        },
      });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/subject'),
            namedNode('http://example.com/predicate'),
            literal('object'),
          ),
        ),
      );
      await writer.flush(dataset);

      const content = await readFile(
        join(tempDir, 'example.com-dataset-1.ttl'),
        'utf-8',
      );
      expect(content).toContain('@prefix ex: <http://example.com/>');
      expect(content).toContain('ex:subject');
      expect(content).toContain('ex:predicate');
    });

    it('writes a single prefix block across multiple write calls', async () => {
      const writer = new FileWriter({
        outputDir: tempDir,
        format: 'turtle',
        prefixes: {
          ex: 'http://example.com/',
        },
      });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/s1'),
            namedNode('http://example.com/p'),
            literal('first'),
          ),
        ),
      );

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/s2'),
            namedNode('http://example.com/p'),
            literal('second'),
          ),
        ),
      );

      await writer.flush(dataset);

      const content = await readFile(
        join(tempDir, 'example.com-dataset-1.ttl'),
        'utf-8',
      );

      // Prefix block should appear exactly once.
      const prefixCount = content.split('@prefix').length - 1;
      expect(prefixCount).toBe(1);

      // Both triples should be present.
      expect(content).toContain('"first"');
      expect(content).toContain('"second"');
    });

    it('writes full IRIs when no prefixes are provided', async () => {
      const writer = new FileWriter({
        outputDir: tempDir,
        format: 'turtle',
      });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(
        dataset,
        quadsOf(
          quad(
            namedNode('http://example.com/subject'),
            namedNode('http://example.com/predicate'),
            literal('object'),
          ),
        ),
      );
      await writer.flush(dataset);

      const content = await readFile(
        join(tempDir, 'example.com-dataset-1.ttl'),
        'utf-8',
      );
      expect(content).toContain('<http://example.com/subject>');
      expect(content).not.toContain('@prefix');
    });
  });
});
