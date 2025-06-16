import { Client } from '../src';
import { sparqlMediaTypes, rdfMediaTypes } from '@lde/dataset';

describe('Client', () => {
  describe('query', () => {
    it('should query datasets from SPARQL endpoint', async () => {
      const sparqlEndpoint = new URL(
        'https://triplestore.netwerkdigitaalerfgoed.nl/repositories/registry'
      );
      const client = new Client(sparqlEndpoint);

      const results = await client.query({
        where: {
          distribution: {
            mediaType: {
              $in: [...sparqlMediaTypes, ...rdfMediaTypes],
            },
          },
        },
      });
      console.log(results);
      console.log(results.length);
    });
  });
});
