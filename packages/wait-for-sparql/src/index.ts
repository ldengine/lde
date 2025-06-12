import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import pRetry from 'p-retry';

export interface Options {
  retries?: number;
  query?: string;
  fetcher?: SparqlEndpointFetcher;
}

export async function waitForSparqlEndpointAvailable(
  url: string,
  options?: Options
) {
  const query = options?.query ?? 'select * where { ?s ?p ?o } limit 1';
  const fetcher =
    options?.fetcher ?? new SparqlEndpointFetcher({ timeout: 300_000 });
  await pRetry(
    async () => {
      let results;
      try {
        results = await (await fetcher.fetchTriples(url, query)).toArray();
      } catch (e) {
        throw new Error(
          `SPARQL endpoint at ${url} not available: ${(e as Error).message}`
        );
      }

      if (results.length === 0) {
        throw new Error(`No data loaded (based on query ${query})`);
      }
    },
    { retries: options?.retries ?? 5 }
  );
}
