export interface RunOptions {
  /** Override the working directory for this command. */
  cwd?: string;
}

export interface TaskRunner<Task> {
  run(command: string, options?: RunOptions): Promise<Task>;
  wait(task: Task): Promise<string>;
  stop(task: Task): Promise<string | null>;
}
