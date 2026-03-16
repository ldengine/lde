import type { Dataset, Distribution } from '@lde/dataset';
import type {
  DistributionAnalysisResult,
  ProgressReporter,
  ValidationReport,
} from '@lde/pipeline';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import prettyMilliseconds from 'pretty-ms';

const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export class ConsoleReporter implements ProgressReporter {
  private stageSpinner?: Ora;
  private stageStartTime = 0;
  private datasetStartTime = 0;
  private datasetTotal = 0;
  private datasetIndex = 0;
  private importSpinner?: Ora;
  private importTimer?: ReturnType<typeof setInterval>;
  private probeLines: { url: string; text: string }[] = [];

  pipelineStart(_name: string): void {
    this.stageSpinner = ora({
      discardStdin: false,
      text: 'Selecting datasets',
    }).start();
  }

  datasetsSelected(count: number, duration: number): void {
    this.datasetTotal = count;
    if (this.stageSpinner) {
      this.stageSpinner.text = `Selected datasets: found ${chalk.bold(count)} ${
        count === 1 ? 'dataset' : 'datasets'
      } in ${chalk.bold(prettyMilliseconds(duration))}`;
    }
  }

  datasetStart(dataset: Dataset): void {
    this.stageSpinner?.succeed();
    this.stageSpinner = undefined;
    this.datasetStartTime = Date.now();
    this.probeLines = [];
    this.datasetIndex++;
    const counter =
      this.datasetTotal > 1
        ? ` ${chalk.dim(`[${this.datasetIndex}/${this.datasetTotal}]`)}`
        : '';
    console.info();
    console.info(`Dataset ${chalk.bold(dataset.iri.toString())}${counter}`);
  }

  distributionProbed(result: DistributionAnalysisResult): void {
    const url = result.distribution.accessUrl.toString();
    const typeLabel =
      result.type === 'sparql'
        ? 'SPARQL endpoint'
        : result.type === 'data-dump'
          ? 'Data dump'
          : 'Network error';

    const s = ora({ discardStdin: false });
    if (result.available) {
      const detail =
        result.statusCode !== undefined ? ` (HTTP ${result.statusCode})` : '';
      const text = `${typeLabel} ${url}${detail}`;
      s.succeed(text);
      this.probeLines.push({ url, text });
    } else {
      const detail = result.error
        ? ` (${result.error})`
        : result.statusCode !== undefined
          ? ` (HTTP ${result.statusCode})`
          : '';
      s.fail(`${typeLabel} ${url}${detail}`);
      this.probeLines.push({ url, text: '' });
    }
  }

  importStarted(): void {
    const importStart = Date.now();
    this.importSpinner = ora({ discardStdin: false }).start('Importing\u2026');
    this.importTimer = setInterval(() => {
      if (this.importSpinner) {
        this.importSpinner.suffixText = prettyMilliseconds(
          Date.now() - importStart,
        );
      }
    }, 1_000);
  }

  importFailed(_distribution: Distribution, error: string): void {
    const spinner = this.importSpinner ?? ora({ discardStdin: false });
    if (!this.importSpinner) spinner.start();
    spinner.text = `Import failed: ${error}`;
    spinner.suffixText = '';
    spinner.fail();
    this.clearImportSpinner();
  }

  distributionSelected(
    _dataset: Dataset,
    distribution: Distribution,
    importedFrom?: Distribution,
    importDuration?: number,
    tripleCount?: number,
  ): void {
    if (importedFrom) {
      const spinner =
        this.importSpinner ?? ora({ discardStdin: false }).start();
      const count =
        tripleCount !== undefined
          ? `${compactNumber.format(tripleCount)} triples, `
          : '';
      const duration =
        importDuration !== undefined
          ? ` in ${chalk.bold(prettyMilliseconds(importDuration))}`
          : '';
      spinner.text = `Imported ${importedFrom.accessUrl.toString()} (${count}to ${distribution.accessUrl.toString()})${duration}`;
      spinner.suffixText = '';
      spinner.succeed();
      this.clearImportSpinner();
    } else {
      const url = distribution.accessUrl.toString();
      const probe = this.probeLines.find((line) => line.url === url);
      const text = probe?.text || url;

      if (probe?.text && process.stderr.isTTY) {
        const linesUp = this.probeLines.length - this.probeLines.indexOf(probe);
        // Move cursor up to the probe line and clear it.
        process.stderr.write(`\x1B[${linesUp}A\x1B[2K\r`);
        ora({ discardStdin: false }).succeed(
          `${text} ${chalk.green('(selected)')}`,
        );
        // Move cursor back down to original position.
        if (linesUp > 1) {
          process.stderr.write(`\x1B[${linesUp - 1}B`);
        }
      } else {
        ora({ discardStdin: false }).succeed(
          `${text} ${chalk.green('(selected)')}`,
        );
      }
    }
  }

  private clearImportSpinner(): void {
    if (this.importTimer) {
      clearInterval(this.importTimer);
      this.importTimer = undefined;
    }
    this.importSpinner = undefined;
  }

  stageStart(stage: string): void {
    this.stageStartTime = Date.now();
    this.stageSpinner = ora({ discardStdin: false }).start();
    this.stageSpinner.text = `Stage ${chalk.bold(stage)}`;
  }

  stageProgress(update: {
    itemsProcessed: number;
    quadsGenerated: number;
  }): void {
    if (this.stageSpinner) {
      const elapsed = prettyMilliseconds(Date.now() - this.stageStartTime);
      this.stageSpinner.suffixText = `${compactNumber.format(
        update.itemsProcessed,
      )} items, ${compactNumber.format(
        update.quadsGenerated,
      )} quads, ${elapsed}`;
    }
  }

  stageComplete(
    _stage: string,
    result: {
      itemsProcessed: number;
      quadsGenerated: number;
      duration: number;
    },
  ): void {
    if (this.stageSpinner) {
      this.stageSpinner.suffixText = `took ${chalk.bold(
        prettyMilliseconds(result.duration),
      )}`;
      this.stageSpinner.succeed();
      this.stageSpinner = undefined;
    }
  }

  stageFailed(_stage: string, error: Error): void {
    if (this.stageSpinner) {
      this.stageSpinner.suffixText = chalk.red(error.message);
      this.stageSpinner.fail();
      this.stageSpinner = undefined;
    }
  }

  stageValidated(_stage: string, report: ValidationReport): void {
    const s = ora({ discardStdin: false });
    if (report.conforms) {
      s.succeed(
        `Validated ${compactNumber.format(report.quadsValidated)} quads`,
      );
    } else {
      s.fail(
        `Validated ${compactNumber.format(report.quadsValidated)} quads: ${chalk.red(`${compactNumber.format(report.violations)} violation(s)`)}`,
      );
    }
  }

  stageSkipped(_stage: string, reason: string): void {
    if (this.stageSpinner) {
      this.stageSpinner.suffixText = `skipped: ${chalk.red(reason)}`;
      this.stageSpinner.fail();
      this.stageSpinner = undefined;
    }
  }

  datasetComplete(_dataset: Dataset): void {
    const s = ora({
      discardStdin: false,
      text: `Completed in ${chalk.bold(
        prettyMilliseconds(Date.now() - this.datasetStartTime),
      )}`,
    });
    s.succeed();
  }

  datasetSkipped(_dataset: Dataset, reason: string): void {
    const s = ora({
      discardStdin: false,
      text: `Skipped: ${chalk.red(reason)}`,
    });
    s.fail();
  }

  pipelineComplete(result: { duration: number }): void {
    console.info(
      `\nPipeline completed in ${chalk.bold(
        prettyMilliseconds(result.duration),
      )}`,
    );
  }
}
