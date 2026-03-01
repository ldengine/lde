import type { Dataset, Distribution } from '@lde/dataset';
import type {
  DistributionAnalysisResult,
  ProgressReporter,
} from '@lde/pipeline';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import prettyMilliseconds from 'pretty-ms';

export class ConsoleReporter implements ProgressReporter {
  private stageSpinner?: Ora;
  private datasetStartTime = 0;
  private datasetTotal = 0;
  private datasetIndex = 0;
  private analysisResults: DistributionAnalysisResult[] = [];

  pipelineStart(_name: string): void {
    this.stageSpinner = ora({
      discardStdin: false,
      text: 'Selecting datasets',
    }).start();
  }

  datasetsSelected(count: number): void {
    this.datasetTotal = count;
    if (this.stageSpinner) {
      this.stageSpinner.text = `Selected datasets: found ${chalk.bold(count)} datasets`;
    }
  }

  datasetStart(dataset: Dataset): void {
    this.stageSpinner?.succeed();
    this.stageSpinner = undefined;
    this.datasetStartTime = Date.now();
    this.datasetIndex++;
    const counter = this.datasetTotal
      ? ` ${chalk.dim(`[${this.datasetIndex}/${this.datasetTotal}]`)}`
      : '';
    console.info();
    console.info(
      `Dataset ${chalk.bold.underline(dataset.iri.toString())}${counter}`,
    );
  }

  distributionsAnalyzed(
    _dataset: Dataset,
    results: DistributionAnalysisResult[],
  ): void {
    this.analysisResults = results;
  }

  distributionSelected(
    _dataset: Dataset,
    distribution: Distribution,
    importedFrom?: Distribution,
    importDuration?: number,
  ): void {
    this.printAnalysisResults(distribution, importedFrom, importDuration);
  }

  stageStart(stage: string): void {
    this.stageSpinner = ora({ discardStdin: false }).start();
    this.stageSpinner.text = `Stage ${chalk.bold(stage)}`;
  }

  stageProgress(update: {
    elementsProcessed: number;
    quadsGenerated: number;
  }): void {
    if (this.stageSpinner) {
      this.stageSpinner.suffixText = `${update.elementsProcessed} elements, ${update.quadsGenerated} quads`;
    }
  }

  stageComplete(
    _stage: string,
    result: {
      elementsProcessed: number;
      quadsGenerated: number;
      duration: number;
    },
  ): void {
    if (this.stageSpinner) {
      this.stageSpinner.suffixText = `took ${chalk.bold(prettyMilliseconds(result.duration))}`;
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
      text: `Completed in ${chalk.bold(prettyMilliseconds(Date.now() - this.datasetStartTime))}`,
    }).start();
    s.succeed();
  }

  datasetSkipped(_dataset: Dataset, reason: string): void {
    this.printAnalysisResults();
    const s = ora({
      discardStdin: false,
      text: `Skipped: ${chalk.red(reason)}`,
    }).start();
    s.fail();
  }

  private printAnalysisResults(
    selected?: Distribution,
    importedFrom?: Distribution,
    importDuration?: number,
  ): void {
    // Match by selected distribution URL, or by importedFrom URL (when a data
    // dump was imported to a local SPARQL endpoint, the selected distribution
    // is the local endpoint which doesn't appear in probe results).
    const selectedUrl = selected?.accessUrl.toString();
    const importedFromUrl = importedFrom?.accessUrl.toString();

    for (const result of this.analysisResults) {
      const resultUrl = result.distribution.accessUrl.toString();
      const isSelected =
        selected &&
        (resultUrl === selectedUrl || resultUrl === importedFromUrl);
      const typeLabel =
        result.type === 'sparql'
          ? 'SPARQL endpoint'
          : result.type === 'data-dump'
            ? 'Data dump'
            : 'Network error';
      const url = chalk.underline(resultUrl);

      const s = ora({ discardStdin: false });
      if (isSelected) {
        if (importedFrom) {
          const duration =
            importDuration !== undefined
              ? ` in ${chalk.bold(prettyMilliseconds(importDuration))}`
              : '';
          s.start(
            `Imported ${url} (to ${chalk.underline(selectedUrl!)})${duration}`,
          );
        } else {
          s.start(`${typeLabel} ${url}`);
        }
        s.succeed();
      } else if (result.available) {
        const detail =
          result.statusCode !== undefined ? ` (HTTP ${result.statusCode})` : '';
        s.start(`${typeLabel} ${url}${detail}`);
        s.succeed();
      } else {
        const detail = result.error
          ? ` (${result.error})`
          : result.statusCode !== undefined
            ? ` (HTTP ${result.statusCode})`
            : '';
        s.start(`${typeLabel} ${url}${detail}`);
        s.fail();
      }
    }
    this.analysisResults = [];
  }

  pipelineComplete(result: { duration: number }): void {
    console.info(
      `\nPipeline completed in ${chalk.bold(prettyMilliseconds(result.duration))}`,
    );
  }
}
