import { describe, it, expect } from 'vitest';
import { Server } from '../src/server.js';
import { DockerTaskRunner } from '@lde/task-runner-docker';
import { resolve } from 'node:path';

describe('Server', () => {
  describe('start', () => {
    it('starts and stops QLever', async () => {
      const port = 7001;
      const taskRunner = new DockerTaskRunner({
        image: process.env.QLEVER_IMAGE!,
        containerName: 'qlever-server-test',
        mountDir: resolve('test/fixtures/server'),
        port,
      });

      const server = new Server({
        taskRunner,
        indexName: 'test-index',
        port,
        // Server now waits for endpoint availability internally.
      });

      await server.start();
      const endpoint = server.queryEndpoint.toString();
      expect(endpoint).toEqual(`http://localhost:${port}/sparql`);
      await server.stop();
    }, 30_000);
  });
});
