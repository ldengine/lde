import { TaskRunner } from '@lde/task-runner';
import { ChildProcess, spawn } from 'node:child_process';
import process from 'node:process';

export class NativeTaskRunner implements TaskRunner<ChildProcess> {
  private stdout: Map<number, string> = new Map();
  private stderr: Map<number, string> = new Map();
  private shell = true;

  async run(command: string): Promise<ChildProcess> {
    const task = spawn(command, {
      detached: true,
      shell: this.shell,
      cwd: 'imports', // TODO: don't hard-code
    });

    task.on('close', (code: number) => {
      /** code is null when the process was killed, which is expected when
       * {@link stop} is called. */
      if (code !== null && code !== 0) {
        // Throw to detect errors in the command arguments.
        throw new Error(this.taskOutput(task));
      }
    });
    task.on('error', (code: number) => {
      throw new Error(`Task errored with code ${code}`);
    });

    if (task.pid !== undefined) {
      task.stdout.on('data', (data) => {
        this.stdout.set(
          task.pid!,
          this.stdout.get(task.pid) ?? '' + data.toString()
        );
      });

      task.stderr.on('data', (data) => {
        this.stderr.set(
          task.pid!,
          this.stderr.get(task.pid) ?? '' + data.toString()
        );
      });
    }

    return task;
  }

  async wait(task: ChildProcess): Promise<string> {
    return new Promise((resolve, reject) => {
      // When waiting for a task, reject on error instead of crashing the
      // process, as we do on purpose in the close listener above.
      task.removeAllListeners('close');
      task.on('close', (code: number) => {
        const output = this.taskOutput(task);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Process failed with code ${code}: ${output}`));
        }
      });
    });
  }

  async stop(task: ChildProcess): Promise<string | null> {
    return new Promise((resolve) => {
      task.on('close', () => {
        resolve(this.taskOutput(task));
      });
      // Negative PID to kill whole process group: the {shell: true} argument
      // to spawn splits off a separate process.
      process.kill(-task.pid!, 'SIGTERM');
    });
  }

  private taskOutput(task: ChildProcess) {
    const output =
      (this.stdout.get(task.pid!) ?? '') + this.stderr.get(task.pid!);
    this.stdout.delete(task.pid!);
    this.stderr.delete(task.pid!);

    return output;
  }
}
