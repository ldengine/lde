import { DockerTaskRunner } from '@lde/task-runner-docker';
import { NativeTaskRunner } from '@lde/task-runner-native';
import { TaskRunner } from '@lde/task-runner';
import { Importer } from './importer.js';
import { Server } from './server.js';

export type QleverOptions = {
  indexName?: string;
  port?: number;
} & (
  | {
      mode: 'docker';
      image: string;
      containerName?: string;
      mountDir?: string;
    }
  | { mode: 'native'; cwd?: string }
);

export function createQlever(options: QleverOptions) {
  const taskRunner: TaskRunner<unknown> =
    options.mode === 'docker'
      ? new DockerTaskRunner({
          image: options.image,
          containerName: options.containerName,
          mountDir: options.mountDir,
          port: options.port,
        })
      : new NativeTaskRunner({ cwd: options.cwd });

  return {
    importer: new Importer({ taskRunner, indexName: options.indexName }),
    server: new Server({
      taskRunner,
      indexName: options.indexName ?? 'data',
      port: options.port,
    }),
  };
}
