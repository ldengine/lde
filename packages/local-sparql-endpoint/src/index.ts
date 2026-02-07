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
}

export const teardownSparqlEndpoint = async () => {
  await teardown(servers);
};
