import { SparqlServer } from '@lde/sparql-server';
import { TaskRunner } from '@lde/task-runner';
import { waitForSparqlEndpointAvailable } from '@lde/wait-for-sparql';

export interface ServerOptions {
  /**
   * Maximum memory size for the QLever server.
   * @default '6G'
   */
  memoryMaxSize?: string;
  /**
   * Number of retries when waiting for the endpoint to become available.
   * @default 30
   */
  waitRetries?: number;
  /**
   * Whether to wait for the endpoint to be available after starting.
   * @default true
   */
  waitForEndpoint?: boolean;
  /**
   * Query to use when checking if data is loaded.
   * Set to a query that returns no results if you only want to check availability.
   */
  waitQuery?: string;
}

export class Server<Task> implements SparqlServer {
  private taskRunner: TaskRunner<Task>;
  private readonly indexName: string;
  private task?: Task;
  private readonly port: number;
  private readonly options: ServerOptions;

  constructor({ taskRunner, indexName, port, ...options }: Arguments<Task>) {
    this.taskRunner = taskRunner;
    this.indexName = indexName;
    this.port = port ?? 7001;
    this.options = options;
  }

  public async start(): Promise<void> {
    // TODO prevent double starts.

    const memoryMaxSize = this.options.memoryMaxSize ?? '6G';
    this.task = await this.taskRunner.run(
      `qlever-server --index-basename ${this.indexName} --memory-max-size ${memoryMaxSize} --port ${this.port}`
    );

    // Wait for the endpoint to become available.
    if (this.options.waitForEndpoint !== false) {
      await waitForSparqlEndpointAvailable(this.queryEndpoint.toString(), {
        retries: this.options.waitRetries ?? 30,
        query: this.options.waitQuery,
      });
    }
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

export interface Arguments<Task> extends ServerOptions {
  taskRunner: TaskRunner<Task>;
  indexName: string;
  port?: number;
}
