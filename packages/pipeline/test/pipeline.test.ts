import { Pipeline } from '../src/pipeline.js';
import { Import } from '../src/import.js';
import { ManualDatasetSelection } from '../src/index.js';
import { Dataset, Distribution } from '@lde/dataset';
import {
  Importer,
  ImportFailed,
  ImportSuccessful,
  NotSupported,
} from '@lde/sparql-importer';
import { SparqlServer } from '@lde/sparql-server';
import { vi } from 'vitest';

const distribution = new Distribution(
  new URL('htts://foo.org/distribution/1'),
  'application/n-triples'
);
distribution.isValid = true;

const manualSelection = new ManualDatasetSelection([
  new Dataset(new URL('https://foo.org/dataset/1'), [distribution]),
]);

describe('Pipeline', () => {
  describe('run', () => {
    it('runs a pipeline without steps', async () => {
      const pipeline = new Pipeline({
        selector: manualSelection,
        steps: [],
      });

      await pipeline.run();
    });
  });

  it('runs a pipeline with only an import step', async () => {
    const server = new (class implements SparqlServer {
      start = vi.fn();
      stop = vi.fn();
    })();

    const pipeline = new Pipeline({
      selector: manualSelection,
      steps: [
        new Import({
          importer: new MockImporter(),
          server,
        }),
      ],
    });

    await pipeline.run();

    expect(server.start).toHaveBeenCalledTimes(1);
    expect(server.stop).toHaveBeenCalledTimes(1);
  });
});

class MockImporter implements Importer {
  async import(
    _dataset: Dataset
  ): Promise<NotSupported | ImportSuccessful | ImportFailed> {
    return new ImportSuccessful(
      Distribution.sparql(new URL('http://localhost:7001/sparql'))
    );
  }
}
