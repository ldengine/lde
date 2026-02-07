import { setup, teardown } from 'jest-dev-server';
import { SpawndChildProcess } from 'spawnd';

let servers: SpawndChildProcess[];
export async function startSparqlEndpoint(
  port: number,
  fixture: string
): Promise<void> {
  servers = await setup({
    command: `npx comunica-sparql-file-http --distinctConstruct ${fixture} -p ${port}`,
    port,
    launchTimeout: 60000,
  });
  await waitForData(port);
}

/**
 * Poll the endpoint until the fixture data is loaded and queryable.
 * jest-dev-server only waits for the TCP port; the comunica worker may
 * still be loading the data file.
 */
async function waitForData(port: number, timeout = 30_000): Promise<void> {
  const query = 'SELECT * WHERE { GRAPH ?g { ?s ?p ?o } } LIMIT 1';
  const url = `http://localhost:${port}/sparql?query=${encodeURIComponent(
    query
  )}`;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/sparql-results+json' },
      });
      if (res.ok) {
        const body = (await res.json()) as {
          results: { bindings: unknown[] };
        };
        if (body.results.bindings.length > 0) return;
      }
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `SPARQL endpoint on port ${port} did not become ready within ${timeout}ms`
  );
}

export const teardownSparqlEndpoint = async () => {
  await teardown(servers);
};
