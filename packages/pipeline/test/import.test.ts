import { Dataset, Distribution } from '@lde/dataset';
import { Import } from '../src/import.js';
import { Importer, ImportSuccessful } from '@lde/sparql-importer';
import { SparqlServer } from '@lde/sparql-server';
import { vi } from 'vitest';
import { NotSupported, Success } from '../src/index.js';

const distribution = new Distribution(
  new URL('http://foo.org/distribution/1'),
  'application/n-triples'
);
distribution.isValid = true;
const dataset = new Dataset({
  iri: new URL('http://foo.org/dataset/1'),
  distributions: [distribution],
});

const importer: Importer = {
  import: vi.fn().mockResolvedValue(new ImportSuccessful(distribution)),
};
const server: SparqlServer = {
  start: vi.fn(),
  stop: vi.fn(),
  queryEndpoint: new URL('http://foo.org/sparql'),
};

describe('Import', () => {
  describe('execute', () => {
    it('imports a distribution and starts a SPARQL server', async () => {
      const importStep = new Import({
        importer,
        server,
      });

      const result = await importStep.execute(dataset);

      expect(importer.import).toHaveBeenCalledTimes(1);
      expect(server.start).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(Success);
    });

    it('skips import if dataset has a valid SPARQL distribution', async () => {
      const importStep = new Import({
        importer,
        server,
      });

      const result = await importStep.execute(dataset);
      expect(result).toBeInstanceOf(NotSupported);
      expect((result as NotSupported).message).toBe(
        'A valid SPARQL distribution is available so no import needed'
      );
    });
  });
});
