import { Selector } from './selector.js';
import { Finishable, Step } from './step.js';
import { NotSupported } from './step.js';
import { Readable } from 'node:stream';

export class Pipeline {
  constructor(private readonly config: { selector: Selector; steps: Step[] }) {}

  public async run() {
    const datasets = await this.config.selector.select();
    for await (const dataset of datasets) {
      for (const step of this.config.steps) {
        const result = await step.execute(dataset);
        if (result instanceof NotSupported) {
          console.error(result);
        } else if (result instanceof Readable) {
          const promise = new Promise((resolve, reject) => {
            result.on('data', (data) => {
              // TODO: pipe to writers.
              console.log('Data:', data);
            });

            result.on('error', (error) => {
              console.error('rejecting');
              reject(error);
            });
            result.on('end', resolve);
          });

          await promise;
        }
      }

      for (const step of this.config.steps) {
        if (isFinishable(step)) {
          await step.finish();
        }
      }
    }
  }
}

const isFinishable = (step: unknown): step is Finishable => {
  return typeof (step as Finishable).finish === 'function';
};
