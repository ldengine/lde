import { Client } from '../src/client.js';
import { Dataset, rdfMediaTypes, sparqlMediaTypes } from '@lde/dataset';
import {
  startSparqlEndpoint,
  teardownSparqlEndpoint,
} from '@lde/local-sparql-endpoint';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const port = 3002;
const client = new Client(new URL(`http://localhost:${port}/sparql`));

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Client', () => {
  beforeAll(async () => {
    await startSparqlEndpoint(3002, join(__dirname, 'fixtures/registry.ttl'));
  }, 60_000);

  afterAll(async () => {
    await teardownSparqlEndpoint();
  });

  describe('query', () => {
    it('queries datasets from SPARQL endpoint with criteria', async () => {
      const results = await client.query({
        where: {
          distribution: {
            mediaType: {
              $in: [...sparqlMediaTypes, ...rdfMediaTypes],
            },
          },
        },
      });

      const expectedTotal = 2;
      expect(results.total).toEqual(expectedTotal);
      let count = 0;
      let firstResult;
      for await (const result of results) {
        if (count === 0) {
          firstResult = result;
        }
        count++;
      }
      expect(count).toEqual(expectedTotal);

      expect(firstResult).toBeInstanceOf(Dataset);
      expect(firstResult?.language).toEqual(['nl-NL']);
      expect(firstResult?.license).toEqual(
        new URL('http://creativecommons.org/licenses/by/4.0/')
      );
      expect(firstResult?.distributions[0]?.conformsTo).toEqual(
        new URL('https://www.w3.org/TR/sparql11-protocol/')
      );
      expect(firstResult?.publisher?.iri).toEqual(new URL('http://foo.org'));
      expect(firstResult?.publisher?.name).toEqual({ '': 'Foo Organization' });
      expect(firstResult?.creator[0]?.iri).toEqual(new URL('http://foo.org'));
      expect(firstResult?.creator[0]?.name).toEqual({ '': 'Foo Organization' });
    });

    it('queries datasets from SPARQL endpoint with a custom CONSTRUCT query', async () => {
      const query = `
        PREFIX dcat: <http://www.w3.org/ns/dcat#>
        PREFIX dct: <http://purl.org/dc/terms/>
        
        CONSTRUCT WHERE {
          ?dataset a dcat:Dataset ;
            dct:title ?title ;
            dcat:distribution ?distribution .

          ?distribution dcat:accessURL ?distribution_url ;
            dcat:mediaType ?distribution_mediaType .
        }    
      `;
      const results = await client.query(query);

      const expectedTotal = 2;
      expect(results.total).toEqual(expectedTotal);
      let count = 0;
      for await (const _ of results) {
        count++;
      }
      expect(count).toEqual(expectedTotal);
    });

    it('throws an error for non-CONSTRUCT queries', async () => {
      const query = `
        PREFIX dcat: <http://www.w3.org/ns/dcat#>
        SELECT ?dataset WHERE {
          ?dataset a dcat:Dataset .
        }
      `;

      await expect(client.query(query)).rejects.toThrow(
        'Must be CONSTRUCT query'
      );
    });
  });
});
