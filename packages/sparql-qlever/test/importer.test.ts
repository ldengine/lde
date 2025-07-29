import { Importer } from '../src/importer.js';
import { DockerTaskRunner } from '@lde/task-runner-docker';
import { ImportSuccessful } from '@lde/sparql-importer';
import { Dataset, Distribution } from '@lde/dataset';
import { resolve } from 'node:path';

describe('Importer', () => {
  describe('import', () => {
    it('imports Turtle data', async () => {
      const taskRunner = new DockerTaskRunner({
        image: process.env.QLEVER_IMAGE!,
        containerName: 'qlever-importer-test',
        mountDir: resolve('test/fixtures/index'),
      });

      const importer = new Importer({
        taskRunner,
        indexName: 'test-index',
        downloader: {
          async download() {
            return resolve('test/fixtures/index/data.ttl');
          },
        },
      });

      const distribution = new Distribution(
        new URL('https://example.com/dataset/distribution'),
        'text/turtle'
      );
      distribution.isValid = true;

      const dataset = new Dataset({
        iri: new URL('https://example.com'),
        distributions: [distribution],
      });

      const result = await importer.import(dataset);
      expect(result).toBeInstanceOf(ImportSuccessful);
    }, 30_000);
  });
});
