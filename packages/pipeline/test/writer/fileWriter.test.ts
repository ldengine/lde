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
    it('writes quads to Turtle file', async () => {
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

      const files = await readFile(
        join(tempDir, 'example.com_dataset_1.ttl'),
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

      const content = await readFile(
        join(tempDir, 'example.com_dataset_1.nt'),
        'utf-8',
      );
      expect(content).toContain('<http://example.com/subject>');
    });

    it('does not write empty data', async () => {
      const writer = new FileWriter({ outputDir: tempDir });

      const dataset = createDataset('http://example.com/dataset/1');

      await writer.write(dataset, quadsOf());

      await expect(
        readFile(join(tempDir, 'example.com_dataset_1.ttl')),
      ).rejects.toThrow();
    });

    it('appends quads from a second write to the same dataset (n-triples)', async () => {
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

      const content = await readFile(
        join(tempDir, 'example.com_dataset_1.nt'),
        'utf-8',
      );
      expect(content).toContain('<http://example.com/s1>');
      expect(content).toContain('<http://example.com/s2>');
      expect(content).toContain('"first"');
      expect(content).toContain('"second"');
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

      const content = await readFile(
        join(nestedDir, 'example.com_dataset_1.ttl'),
        'utf-8',
      );
      expect(content).toBeTruthy();
    });
  });
});
