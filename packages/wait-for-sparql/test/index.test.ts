import { waitForSparqlEndpointAvailable } from '../src';

describe('waitForSparqlEndpointAvailable', () => {
  it('rejects when SPARQL endpoint is unavailable', async () => {
    const endpoint = 'http://invalid-endpoint/sparql';
    await expect(
      waitForSparqlEndpointAvailable(endpoint, { retries: 0 })
    ).rejects.toThrow(
      'SPARQL endpoint at http://invalid-endpoint/sparql not available'
    );
  });
});
