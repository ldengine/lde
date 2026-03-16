import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Importer } from '../src/importer.js';
import { DockerTaskRunner } from '@lde/task-runner-docker';
import { ImportSuccessful } from '@lde/sparql-importer';
import { Dataset, Distribution } from '@lde/dataset';
import { join, resolve } from 'node:path';
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  copyFile,
  utimes,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { TaskRunner } from '@lde/task-runner';

function makeDataset() {
  const distribution = new Distribution(
    new URL('https://example.com/dataset/distribution'),
    'text/turtle',
  );
  return new Dataset({
    iri: new URL('https://example.com'),
    distributions: [distribution],
  });
}

/**
 * Stub TaskRunner that records calls and returns fake QLever metadata output.
 */
function stubTaskRunner(tripleCount = 42): TaskRunner<string> & {
  commands: string[];
} {
  const commands: string[] = [];
  return {
    commands,
    async run(command: string) {
      commands.push(command);
      return command;
    },
    async wait() {
      return `{"num-triples":{"normal":${tripleCount}}}`;
    },
    async stop() {
      return null;
    },
  };
}

describe('Importer', () => {
  describe('import', () => {
    it('imports Turtle data', async () => {
      const taskRunner = new DockerTaskRunner({
        image: process.env.QLEVER_IMAGE!,
        containerName: 'qlever-importer-test',
        mountDir: resolve('test/fixtures/importer'),
      });

      const importer = new Importer({
        taskRunner,
        indexName: 'test-index',
        downloader: {
          async download() {
            return resolve('test/fixtures/importer/data.ttl');
          },
        },
      });

      const distribution = new Distribution(
        new URL('https://example.com/dataset/distribution'),
        'text/turtle',
      );

      const dataset = new Dataset({
        iri: new URL('https://example.com'),
        distributions: [distribution],
      });

      const result = await importer.import(dataset);
      expect(result).toBeInstanceOf(ImportSuccessful);
      expect((result as ImportSuccessful).tripleCount).toBe(1);
    }, 30_000);
  });

  describe('index caching', () => {
    let tempDir: string;
    let dataFile: string;
    const indexName = 'test-index';

    /** Write the QLever metadata file that `readTripleCount` reads on cache hits. */
    async function writeMetadata(tripleCount: number) {
      await writeFile(
        join(tempDir, `${indexName}.meta-data.json`),
        JSON.stringify({ 'num-triples': { normal: tripleCount } }),
      );
    }

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'qlever-cache-'));
      dataFile = join(tempDir, 'data.ttl');
      await copyFile(resolve('test/fixtures/importer/data.ttl'), dataFile);
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    function createImporter(
      taskRunner: TaskRunner<unknown>,
      options?: { cacheIndex?: boolean },
    ) {
      return new Importer({
        taskRunner,
        indexName,
        downloader: {
          async download() {
            return dataFile;
          },
        },
        cacheIndex: options?.cacheIndex,
      });
    }

    it('writes cache marker after successful indexing', async () => {
      const runner = stubTaskRunner(42);
      const importer = createImporter(runner);

      const result = await importer.import(makeDataset());

      expect(result).toBeInstanceOf(ImportSuccessful);
      expect((result as ImportSuccessful).tripleCount).toBe(42);
      expect(runner.commands.length).toBe(1);

      // Cache marker should exist with only the source file name.
      const cacheInfo = JSON.parse(
        await readFile(join(tempDir, `${indexName}.cache-info.json`), 'utf-8'),
      );
      expect(cacheInfo.sourceFile).toBe('data.ttl');
      expect(cacheInfo).not.toHaveProperty('tripleCount');
    });

    it('skips indexing when cache is up to date', async () => {
      const runner = stubTaskRunner(42);
      const importer = createImporter(runner);

      // First run: indexes and writes cache marker.
      await importer.import(makeDataset());
      expect(runner.commands.length).toBe(1);

      // Write metadata file (normally created by qlever-index inside the task runner).
      await writeMetadata(42);

      // Second run: cache hit, no indexing.
      const result = await importer.import(makeDataset());
      expect(result).toBeInstanceOf(ImportSuccessful);
      expect((result as ImportSuccessful).tripleCount).toBe(42);
      expect(runner.commands.length).toBe(1); // Still only one index call.
    });

    it('re-indexes when data file is newer than cache marker', async () => {
      const runner = stubTaskRunner(42);
      const importer = createImporter(runner);

      // First run: creates cache.
      await importer.import(makeDataset());
      expect(runner.commands.length).toBe(1);

      // Simulate re-download: touch data file to be newer than cache marker.
      const futureTime = new Date(Date.now() + 10_000);
      await utimes(dataFile, futureTime, futureTime);

      // Second run: should re-index because data is newer.
      await importer.import(makeDataset());
      expect(runner.commands.length).toBe(2);
    });

    it('re-indexes when no cache marker exists (first run)', async () => {
      const runner = stubTaskRunner(10);
      const importer = createImporter(runner);

      const result = await importer.import(makeDataset());
      expect(result).toBeInstanceOf(ImportSuccessful);
      expect((result as ImportSuccessful).tripleCount).toBe(10);
      expect(runner.commands.length).toBe(1);
    });

    it('re-indexes when source file does not match', async () => {
      const runner = stubTaskRunner(42);
      const importer = createImporter(runner);

      // First run with current data file.
      await importer.import(makeDataset());
      expect(runner.commands.length).toBe(1);

      // Manually write a cache marker with a different source file.
      await writeFile(
        join(tempDir, `${indexName}.cache-info.json`),
        JSON.stringify({ sourceFile: 'other-dataset.nt' }),
      );

      // Should re-index because source doesn't match.
      await importer.import(makeDataset());
      expect(runner.commands.length).toBe(2);
    });

    it('re-indexes when cacheIndex is false even with fresh cache', async () => {
      // First: create a cache marker via a cacheIndex=true run.
      const runner = stubTaskRunner(42);
      const importerWithCache = createImporter(runner, { cacheIndex: true });
      await importerWithCache.import(makeDataset());
      expect(runner.commands.length).toBe(1);

      // Now create an importer with cacheIndex=false.
      const importerNoCache = createImporter(runner, { cacheIndex: false });
      await importerNoCache.import(makeDataset());
      expect(runner.commands.length).toBe(2); // Forced re-index.
    });
  });
});
