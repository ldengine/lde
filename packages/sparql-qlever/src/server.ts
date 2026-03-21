import { SparqlServer } from '@lde/sparql-server';
import { TaskRunner } from '@lde/task-runner';
import { waitForSparqlEndpointAvailable } from '@lde/wait-for-sparql';

export interface QleverServerOptions {
  /** Maximum memory for query processing and caching. @default '4G' */
  'memory-max-size'?: string;
  /** Default query timeout. @default '30s' */
  'default-query-timeout'?: string;
}

const defaultQleverServerOptions = {
  'memory-max-size': '4G',
  'default-query-timeout': '30s',
} satisfies Required<QleverServerOptions>;

export class Server<Task> implements SparqlServer {
  private readonly taskRunner: TaskRunner<Task>;
  private readonly indexName: string;
  private task?: Task;
  private readonly port: number;
  private readonly qleverOptions: Required<QleverServerOptions>;

  constructor({ taskRunner, indexName, port, qleverOptions }: Arguments<Task>) {
    this.taskRunner = taskRunner;
    this.indexName = indexName;
    this.port = port ?? 7001;
    this.qleverOptions = { ...defaultQleverServerOptions, ...qleverOptions };
  }

  public async start(): Promise<void> {
    // TODO prevent double starts.

    this.task = await this.taskRunner.run(
      `qlever-server --index-basename ${this.indexName} --memory-max-size ${this.qleverOptions['memory-max-size']} --default-query-timeout ${this.qleverOptions['default-query-timeout']} --port ${this.port}`,
    );
    await waitForSparqlEndpointAvailable(this.queryEndpoint.toString());
  }

  public async stop(): Promise<void> {
    if (this.task) {
      await this.taskRunner.stop(this.task);
      this.task = undefined;
    }
  }

  public get queryEndpoint(): URL {
    return new URL(`http://localhost:${this.port}/sparql`);
  }
}

export interface Arguments<Task> {
  taskRunner: TaskRunner<Task>;
  indexName: string;
  /** @default 7001 */
  port?: number;
  qleverOptions?: QleverServerOptions;
}
