import { DockerTaskRunner } from '@lde/task-runner-docker';
import { NativeTaskRunner } from '@lde/task-runner-native';
import { TaskRunner } from '@lde/task-runner';
import {
  Downloader,
  LastModifiedDownloader,
} from '@lde/distribution-downloader';
import { Importer } from './importer.js';
import { Server } from './server.js';

export type QleverOptions = {
  /** Directory where downloaded data files are stored. */
  dataDir?: string;
  indexName?: string;
  /** @default 7001 */
  port?: number;
  downloader?: Downloader;
  /** Cache QLever indices and skip re-indexing when source data is unchanged. Defaults to `true`. */
  cacheIndex?: boolean;
} & (
  | {
      mode: 'docker';
      image: string;
      containerName?: string;
    }
  | { mode: 'native' }
);

export function createQlever(options: QleverOptions) {
  const port = options.port ?? 7001;
  const taskRunner: TaskRunner<unknown> =
    options.mode === 'docker'
      ? new DockerTaskRunner({
          image: options.image,
          containerName: options.containerName,
          mountDir: options.dataDir,
          port,
        })
      : new NativeTaskRunner({ cwd: options.dataDir });

  return {
    importer: new Importer({
      taskRunner,
      indexName: options.indexName,
      downloader:
        options.downloader ?? new LastModifiedDownloader(options.dataDir),
      cacheIndex: options.cacheIndex,
    }),
    server: new Server({
      taskRunner,
      indexName: options.indexName ?? 'data',
      port,
    }),
  };
}
