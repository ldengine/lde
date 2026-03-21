import { DockerTaskRunner } from '@lde/task-runner-docker';
import { NativeTaskRunner } from '@lde/task-runner-native';
import { TaskRunner } from '@lde/task-runner';
import {
  Downloader,
  LastModifiedDownloader,
} from '@lde/distribution-downloader';
import { Importer, QleverIndexOptions } from './importer.js';
import { Server } from './server.js';

export type QleverOptions = {
  /** Directory where downloaded data files are stored. */
  dataDir?: string;
  indexName?: string;
  /** @default 7001 */
  port?: number;
  downloader?: Downloader;
  /** Cache QLever indices and skip re-indexing when source data is unchanged. @default true */
  cacheIndex?: boolean;
  /** QLever `--default-query-timeout` value (e.g. '30s', '5min'). @default '30s' */
  queryTimeout?: string;
  qleverOptions?: QleverIndexOptions;
} & (
  | {
      mode: 'docker';
      image: string;
      containerName?: string;
    }
  | { mode: 'native' }
);

/**
 * Create a paired QLever {@link Importer} and {@link Server} that share a
 * single {@link TaskRunner}. In pipeline setups the importer and server must
 * use the same runner (and therefore the same Docker container or working
 * directory) so that the server can serve the index the importer built.
 */
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
      qleverOptions: options.qleverOptions,
    }),
    server: new Server({
      taskRunner,
      indexName: options.indexName ?? 'data',
      port,
      queryTimeout: options.queryTimeout,
    }),
  };
}
