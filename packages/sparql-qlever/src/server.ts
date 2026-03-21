import { SparqlServer } from '@lde/sparql-server';
import { TaskRunner } from '@lde/task-runner';
import { waitForSparqlEndpointAvailable } from '@lde/wait-for-sparql';

export class Server<Task> implements SparqlServer {
  private readonly taskRunner: TaskRunner<Task>;
  private readonly indexName: string;
  private task?: Task;
  private readonly port: number;
  private readonly queryTimeout: string;

  constructor({ taskRunner, indexName, port, queryTimeout }: Arguments<Task>) {
    this.taskRunner = taskRunner;
    this.indexName = indexName;
    this.port = port ?? 7001;
    this.queryTimeout = queryTimeout ?? '30s';
  }

  public async start(): Promise<void> {
    // TODO prevent double starts.

    this.task = await this.taskRunner.run(
      `qlever-server --index-basename ${this.indexName} --memory-max-size 6G --default-query-timeout ${this.queryTimeout} --port ${this.port}`,
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
  port?: number;
  /** QLever `--default-query-timeout` value (e.g. '30s', '5min'). @default '30s' */
  queryTimeout?: string;
}
