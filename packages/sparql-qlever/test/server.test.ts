import { Server } from '../src/server.js';
import { DockerTaskRunner } from '@lde/task-runner-docker';
import { waitForSparqlEndpointAvailable } from '@lde/wait-for-sparql';
import { resolve } from 'node:path';

describe('Server', () => {
  describe('start', () => {
    it('start QLever', async () => {
      const port = 7001;
      const taskRunner = new DockerTaskRunner({
        image: process.env.QLEVER_IMAGE!,
        containerName: 'qlever-server-test',
        mountDir: resolve('test/fixtures/index'),
        port,
      });

      const server = new Server({
        taskRunner,
        indexName: 'test-index',
        port,
      });
      await server.start();
      await waitForSparqlEndpointAvailable(`http://localhost:${port}`);
      console.log('ok');
    }, 20_000);
  });
});
