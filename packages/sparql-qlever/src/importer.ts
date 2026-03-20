import {
  Importer as ImporterInterface,
  ImporterOptions,
  ImportFailed,
  ImportSuccessful,
  NotSupported,
} from '@lde/sparql-importer';
import { Distribution } from '@lde/dataset';
import { LastModifiedDownloader } from '@lde/distribution-downloader';
import { basename, dirname, join } from 'path';
import { readFile, stat, writeFile } from 'node:fs/promises';

export interface QleverIndexOptions {
  /** @default true */
  'ascii-prefixes-only'?: boolean;
  /** @default 3_000_000 */
  'num-triples-per-batch'?: number;
  /** Memory budget for sorting during the index build. @default '10G' */
  'stxxl-memory'?: string;
  /** @default true */
  'parse-parallel'?: boolean;
  /** Build only PSO and POS permutations. Faster, but queries with predicate variables won't work. Also disables pattern precomputation. @default false */
  'only-pso-and-pos-permutations'?: boolean;
}

export interface QleverImporterOptions extends ImporterOptions {
  /** @default 'data' */
  indexName?: string;
  qleverOptions?: QleverIndexOptions;
}

/**
 * Import RDF to a QLever SPARQL server.
 *
 * - Use the QLever CLI because the Graph Store Protocol is not parallelized.
 */
type ResolvedOptions = Required<QleverImporterOptions> & {
  qleverOptions: Required<QleverIndexOptions>;
};

export class Importer implements ImporterInterface {
  private readonly options: ResolvedOptions;

  constructor(options: QleverImporterOptions) {
    this.options = {
      ...options,
      indexName: options.indexName ?? 'data',
      downloader: options.downloader ?? new LastModifiedDownloader(),
      cacheIndex: options.cacheIndex ?? true,
      qleverOptions: {
        ...defaultQleverIndexOptions,
        ...options.qleverOptions,
      },
    };
  }

  public async import(
    distributions: Distribution[],
  ): Promise<NotSupported | ImportSuccessful | ImportFailed> {
    const downloadDistributions = distributions.filter(
      (distribution): distribution is Distribution & { mimeType: string } =>
        distribution.mimeType !== undefined &&
        supportedFormats.has(distribution.mimeType),
    );
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
    distribution: Distribution & { mimeType: string },
  ): Promise<ImportSuccessful | ImportFailed> {
    const localFile = await this.options.downloader.download(distribution);

    if (await this.isIndexUpToDate(localFile)) {
      const tripleCount = await this.readTripleCount(localFile);
      if (tripleCount === 0) {
        return new ImportFailed(
          distribution,
          'Index is cached but contains 0 triples',
        );
      }
      return new ImportSuccessful(distribution, undefined, tripleCount);
    }

    const format = fileFormatFromMimeType(distribution.mimeType);
    let logs: string;
    try {
      logs = await this.index(localFile, format);
    } catch (error) {
      if (
        format === 'ttl' &&
        (error as Error).message?.includes('multiline string literal')
      ) {
        logs = await this.index(localFile, format, false);
      } else {
        throw error;
      }
    }
    const tripleCount = this.parseTripleCount(logs);

    if (tripleCount === 0) {
      return new ImportFailed(
        distribution,
        'Indexed 0 triples from distribution',
      );
    }

    await this.writeCacheInfo(localFile);

    return new ImportSuccessful(distribution, undefined, tripleCount);
  }

  private parseTripleCount(logs: string): number | undefined {
    // Extract num-triples.normal from the metadata JSON that the index
    // command cats to stdout. Use a regex rather than JSON.parse because
    // Docker log multiplexing prepends binary frame headers to each chunk.
    const match = logs.match(/"num-triples":\{[^}]*"normal":(\d+)/);
    return match ? Number(match[1]) : undefined;
  }

  private cacheInfoPath(dataFile: string): string {
    return join(dirname(dataFile), `${this.options.indexName}.cache-info.json`);
  }

  /**
   * Check whether the cached index is still up to date.
   */
  private async isIndexUpToDate(dataFile: string): Promise<boolean> {
    if (!this.options.cacheIndex) return false;

    let cacheInfo: CacheInfo;
    try {
      const raw = await readFile(this.cacheInfoPath(dataFile), 'utf-8');
      cacheInfo = JSON.parse(raw) as CacheInfo;
    } catch {
      return false; // No cache marker — first run.
    }

    if (cacheInfo.sourceFile !== basename(dataFile)) {
      return false; // Different dataset was last indexed.
    }

    const [cacheInfoStat, dataFileStat] = await Promise.all([
      stat(this.cacheInfoPath(dataFile)),
      stat(dataFile),
    ]);
    if (dataFileStat.mtimeMs > cacheInfoStat.mtimeMs) {
      return false; // Data was re-downloaded.
    }

    return true;
  }

  /** Read the triple count from QLever's metadata file. */
  private async readTripleCount(dataFile: string): Promise<number | undefined> {
    try {
      const metadataPath = join(
        dirname(dataFile),
        `${this.options.indexName}.meta-data.json`,
      );
      const raw = await readFile(metadataPath, 'utf-8');
      return this.parseTripleCount(raw);
    } catch {
      return undefined;
    }
  }

  private async writeCacheInfo(dataFile: string): Promise<void> {
    const info: CacheInfo = { sourceFile: basename(dataFile) };
    await writeFile(this.cacheInfoPath(dataFile), JSON.stringify(info));
  }

  private async index(
    file: string,
    format: fileFormat,
    parseParallel?: boolean,
  ): Promise<string> {
    const settingsFile = 'index.settings.json';
    const settings = {
      'ascii-prefixes-only': this.options.qleverOptions['ascii-prefixes-only'],
      'num-triples-per-batch':
        this.options.qleverOptions['num-triples-per-batch'],
    };
    await writeFile(
      `${dirname(file)}/${settingsFile}`,
      JSON.stringify(settings),
    );

    // TODO: write index to named volume instead of bind mount for better performance.

    const parallel =
      parseParallel ?? this.options.qleverOptions['parse-parallel'];
    const flags = [
      `-i ${this.options.indexName}`,
      `-s ${settingsFile}`,
      `-F ${format}`,
      `-p true`,
      `-m ${this.options.qleverOptions['stxxl-memory']}`,
      parallel ? '' : '--parse-parallel false',
      this.options.qleverOptions['only-pso-and-pos-permutations']
        ? '-o --no-patterns'
        : '',
      '-f -',
    ]
      .filter(Boolean)
      .join(' ');

    const metadataFile = `${this.options.indexName}.meta-data.json`;
    const indexTask = await this.options.taskRunner.run(
      `(gunzip -c '${basename(file)}' 2>/dev/null || cat '${basename(
        file,
      )}') | qlever-index ${flags} && cat ${metadataFile}`,
    );
    return await this.options.taskRunner.wait(indexTask);
  }
}

type fileFormat = 'nt' | 'nq' | 'ttl';

const supportedFormats = new Map<string, fileFormat>([
  ['application/n-triples', 'nt'],
  ['application/n-quads', 'nq'],
  ['text/turtle', 'ttl'],
]);

const defaultQleverIndexOptions = {
  'ascii-prefixes-only': true,
  'num-triples-per-batch': 3_000_000,
  'stxxl-memory': '10G',
  'parse-parallel': true,
  'only-pso-and-pos-permutations': false,
} satisfies Required<QleverIndexOptions>;

interface CacheInfo {
  sourceFile: string;
}

function fileFormatFromMimeType(mimeType: string): fileFormat {
  const format = supportedFormats.get(mimeType);
  if (format === undefined) {
    throw new Error(`Unsupported media type: ${mimeType}`);
  }
  return format;
}
