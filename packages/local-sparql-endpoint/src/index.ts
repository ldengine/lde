import { setup, teardown } from 'jest-dev-server';
import { waitForSparqlEndpointAvailable } from '@lde/wait-for-sparql';
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
  await waitForSparqlEndpointAvailable(`http://localhost:${port}/sparql`, {
    query:
      'construct { ?s ?p ?o } where { { ?s ?p ?o } union { graph ?g { ?s ?p ?o } } } limit 1',
  });
}

export const teardownSparqlEndpoint = async () => {
  await teardown(servers);
};
