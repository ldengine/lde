import { Client } from '../src';
import { rdfMediaTypes, sparqlMediaTypes } from '@lde/dataset';
import { startSparqlEndpoint, teardownSparqlEndpoint } from '@lde/test';
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
      const results = client.query({
        where: {
          distribution: {
            mediaType: {
              $in: [...sparqlMediaTypes, ...rdfMediaTypes],
            },
          },
        },
      });

      let count = 0;
      for await (const _ of results) {
        count++;
      }
      expect(count).toEqual(1);
    });

    it('queries datasets from SPARQL endpoint with a custom CONSTRUCT query', async () => {
      const query = `
        PREFIX dcat: <http://www.w3.org/ns/dcat#>
        PREFIX dct: <http://purl.org/dc/terms/>
        
        CONSTRUCT WHERE {
          ?dataset a dcat:Dataset ;
            dcat:distribution ?distribution .

          ?distribution dcat:accessURL ?distribution_url ;
            dcat:mediaType ?distribution_mediaType .
        }    
      `;
      const results = client.query(query);

      let count = 0;
      for await (const _ of results) {
        count++;
      }
      expect(count).toEqual(1);
    });

    it('throws an error for non-CONSTRUCT queries', async () => {
      const query = `
        PREFIX dcat: <http://www.w3.org/ns/dcat#>
        SELECT ?dataset WHERE {
          ?dataset a dcat:Dataset .
        }
      `;

      await expect(async () => {
        for await (const _ of client.query(query)) {
          // Intentionally empty
        }
      }).rejects.toThrow('Must be CONSTRUCT query');
    });
  });
});
