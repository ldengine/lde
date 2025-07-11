import {
  Importer as ImporterInterface,
  ImportFailed,
  ImportSuccessful,
  NotSupported,
} from '@lde/sparql-importer';
import { Dataset, Distribution } from '@lde/dataset';
import { Downloader, LastModifiedDownloader } from '@lde/distribution-download';
import { basename, dirname } from 'path';
import { writeFile } from 'node:fs/promises';
import { TaskRunner } from '@lde/task-runner';

export interface Options {
  taskRunner: TaskRunner<unknown>;
  indexName?: string;
  downloader?: Downloader;
  qleverOptions?: {
    'ascii-prefixes-only': boolean;
    'num-triples-per-batch': number;
  };
  port?: number;
}

/**
 * Import RDF to a QLever SPARQL server.
 *
 * - Use the QLever CLI because the Graph Store Protocol is not parallelized.
 */
export class Importer implements ImporterInterface {
  private indexName;
  private taskRunner: TaskRunner<unknown>;
  private downloader;
  private qleverOptions;

  constructor({ taskRunner, downloader, indexName, qleverOptions }: Options) {
    this.taskRunner = taskRunner;
    this.downloader = downloader ?? new LastModifiedDownloader();
    this.indexName = indexName ?? 'data';
    this.qleverOptions = qleverOptions ?? {
      'ascii-prefixes-only': true,
      'num-triples-per-batch': 100000,
    };
  }

  public async import(
    dataset: Dataset
  ): Promise<NotSupported | ImportSuccessful | ImportFailed> {
    const downloadDistributions = dataset.getDownloadDistributions();
    if (downloadDistributions.length === 0) {
      return new NotSupported();
    }

    let result!: ImportSuccessful | ImportFailed;
    for (const downloadDistribution of downloadDistributions) {
      try {
        result = await this.doImport(downloadDistribution);
        if (result instanceof ImportSuccessful) {
          return result;
        }
      } catch (error) {
        let errorMessage;
        if (error instanceof AggregateError) {
          errorMessage = error.errors.join(' / ');
        } else {
          errorMessage = (error as Error).message;
        }
        result = new ImportFailed(downloadDistribution, errorMessage);
      }
    }

    return result;
  }

  private async doImport(
    distribution: Distribution
  ): Promise<ImportSuccessful | ImportFailed> {
    const localFile = await this.downloader.download(distribution);
    await this.index(
      localFile,
      this.fileFormatFromMimeType(distribution.mimeType)
    );

    return new ImportSuccessful(distribution);
  }

  private fileFormatFromMimeType(mimeType: string): fileFormat {
    switch (mimeType) {
      case 'application/n-triples':
      case 'application/n-triples+gzip':
        return 'nt';
      case 'application/n-quads':
      case 'application/n-quads+gzip':
        return 'nq';
      case 'text/turtle':
      case 'text/turtle+gzip':
        return 'ttl';
      default:
        throw new Error(`Unsupported media type: ${mimeType}`);
    }
  }

  private async index(file: string, format: fileFormat): Promise<void> {
    const workingDir = dirname(file);
    const settingsFile = 'index.settings.json';
    await writeFile(
      `${workingDir}/${settingsFile}`,
      JSON.stringify(this.qleverOptions)
    );

    // TODO: write index to named volume instead of bind mount for better performance.

    const indexTask = await this.taskRunner.run(
      `(zcat '${basename(file)}' 2>/dev/null || cat '${basename(
        file
      )}') | IndexBuilderMain -i ${
        this.indexName
      } -s ${settingsFile} -F ${format} -f -`
    );
    await this.taskRunner.wait(indexTask);
  }
}

type fileFormat = 'nt' | 'nq' | 'ttl';
