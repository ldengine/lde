import { FileWriter } from '../src/fileWriter.js';
import { Dataset, Distribution } from '@lde/dataset';
import { Store, DataFactory } from 'n3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { namedNode, literal } = DataFactory;

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

  function createStore(): Store {
    return new Store();
  }

  describe('write', () => {
    it('writes quads to Turtle file', async () => {
      const writer = new FileWriter({ outputDir: tempDir });

      const dataset = createDataset('http://example.com/dataset/1');
      const data = createStore();
      data.addQuad(
        namedNode('http://example.com/subject'),
        namedNode('http://example.com/predicate'),
        literal('object')
      );

      await writer.write(dataset, data);

      const files = await readFile(
        join(tempDir, 'example.com_dataset_1.ttl'),
        'utf-8'
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
      const data = createStore();
      data.addQuad(
        namedNode('http://example.com/subject'),
        namedNode('http://example.com/predicate'),
        literal('object')
      );

      await writer.write(dataset, data);

      const content = await readFile(
        join(tempDir, 'example.com_dataset_1.nt'),
        'utf-8'
      );
      expect(content).toContain('<http://example.com/subject>');
    });

    it('does not write empty data', async () => {
      const writer = new FileWriter({ outputDir: tempDir });

      const dataset = createDataset('http://example.com/dataset/1');
      const data = createStore();

      await writer.write(dataset, data);

      await expect(
        readFile(join(tempDir, 'example.com_dataset_1.ttl'))
      ).rejects.toThrow();
    });

    it('creates nested output directories', async () => {
      const nestedDir = join(tempDir, 'nested', 'output');
      const writer = new FileWriter({ outputDir: nestedDir });

      const dataset = createDataset('http://example.com/dataset/1');
      const data = createStore();
      data.addQuad(
        namedNode('http://example.com/s'),
        namedNode('http://example.com/p'),
        literal('o')
      );

      await writer.write(dataset, data);

      const content = await readFile(
        join(nestedDir, 'example.com_dataset_1.ttl'),
        'utf-8'
      );
      expect(content).toBeTruthy();
    });
  });
});
