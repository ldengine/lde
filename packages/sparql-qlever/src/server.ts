import { SparqlServer } from '@lde/sparql-server';
import { TaskRunner } from '@lde/task-runner';

export class Server<Task> implements SparqlServer {
  private taskRunner: TaskRunner<Task>;
  private readonly indexName: string;
  private task?: Task;
  private readonly port: number;

  constructor({ taskRunner, indexName, port }: Arguments<Task>) {
    this.taskRunner = taskRunner;
    this.indexName = indexName;
    this.port = port ?? 7001;
  }

  public async start(): Promise<void> {
    // TODO prevent double starts.

    this.task = await this.taskRunner.run(
      `ServerMain --index-basename ${this.indexName} --memory-max-size 6G --port ${this.port}`
    );
  }

  public async stop(): Promise<void> {
    if (this.task) {
      await this.taskRunner.stop(this.task);
      this.task = undefined;
    }
  }
}

export interface Arguments<Task> {
  taskRunner: TaskRunner<Task>;
  indexName: string;
  port?: number;
}
