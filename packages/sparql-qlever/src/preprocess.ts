import { Distribution } from '@lde/dataset';
import { JsonLdParser } from 'jsonld-streaming-parser';
import { StreamWriter } from 'n3';
import { createGunzip } from 'node:zlib';
import { createReadStream, createWriteStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import yauzl from 'yauzl';

const JSONLD_MIME = 'application/ld+json';
const ZIP_MIME = 'application/zip';
const GZIP_MIME = 'application/gzip';
const GZIP_MIME_LEGACY = 'application/x-gzip';

/** N-Quads sub-format we always target after preprocessing. */
const PREPROCESSED_FORMAT = 'nq' as const;
export type PreprocessedFormat = typeof PREPROCESSED_FORMAT;

/**
 * File extensions inside a JSON-LD zip that we will convert. Other entries
 * are skipped with a warning.
 */
const JSONLD_ZIP_EXTENSIONS = ['.jsonld', '.json'];

export interface PreprocessResult {
  /** Path to the file ready for `qlever-index`. Always N-Quads. */
  path: string;
  format: PreprocessedFormat;
  warnings: string[];
}

/**
 * Whether a distribution needs Node-side preprocessing before `qlever-index`
 * can read it.
 *
 * Only JSON-LD distributions return `true`: `qlever-index` cannot parse
 * JSON-LD, so we stream it through a JSON-LD parser into N-Quads first.
 *
 * Native RDF formats (`nt`, `nq`, `ttl`) — including when wrapped in
 * `application/gzip` or `application/zip` — go straight through the shell
 * pipeline in `index()`, which uses `gunzip -c` or `unzip -p` as appropriate.
 * Standalone `mediaType=application/zip` is rejected upstream: the inner
 * format must be declared.
 */
export function needsPreprocessing(distribution: Distribution): boolean {
  return distribution.mimeType === JSONLD_MIME;
}

/**
 * Convert a JSON-LD distribution to N-Quads alongside the source file.
 *
 * Streams the source through `JsonLdParser` and `n3.StreamWriter` so memory
 * use stays bounded regardless of input size. Handles gzip transparently
 * (declared compressFormat or `.gz` filename) and zip containers (extracts
 * JSON-LD entries one by one, appending to the output).
 *
 * Cached: if the output is newer than the input, it is reused as-is.
 */
export async function preprocess(
  localFile: string,
  distribution: Distribution,
): Promise<PreprocessResult> {
  if (!needsPreprocessing(distribution)) {
    throw new Error(
      `preprocess called for distribution that does not need preprocessing: mediaType=${distribution.mimeType}`,
    );
  }

  const outputFile = `${localFile}.preprocessed.nq`;
  if (await outputIsUpToDate(localFile, outputFile)) {
    return { path: outputFile, format: PREPROCESSED_FORMAT, warnings: [] };
  }

  await rm(outputFile, { force: true });
  const warnings: string[] = [];

  if (distribution.compressMimeType === ZIP_MIME) {
    await streamJsonldZip(localFile, outputFile, warnings);
  } else {
    await streamJsonldFile(localFile, outputFile, distribution);
  }

  return { path: outputFile, format: PREPROCESSED_FORMAT, warnings };
}

async function outputIsUpToDate(
  inputFile: string,
  outputFile: string,
): Promise<boolean> {
  try {
    const [inputStat, outputStat] = await Promise.all([
      stat(inputFile),
      stat(outputFile),
    ]);
    return outputStat.mtimeMs >= inputStat.mtimeMs && outputStat.size > 0;
  } catch {
    return false;
  }
}

/**
 * Pipe a JSON-LD byte stream through parse → serialize → write.
 *
 * `append=true` opens the output for appending so multiple zip entries can be
 * folded into a single N-Quads file.
 */
async function streamJsonldToNquads(
  input: Readable,
  outputFile: string,
  append: boolean,
): Promise<void> {
  await pipeline(
    input,
    new JsonLdParser(),
    new StreamWriter({ format: 'application/n-quads' }),
    createWriteStream(outputFile, { flags: append ? 'a' : 'w' }),
  );
}

async function streamJsonldFile(
  localFile: string,
  outputFile: string,
  distribution: Distribution,
): Promise<void> {
  const isGzipped =
    distribution.compressMimeType === GZIP_MIME ||
    distribution.compressMimeType === GZIP_MIME_LEGACY ||
    localFile.toLowerCase().endsWith('.gz');
  const source = createReadStream(localFile);
  const input = isGzipped ? source.pipe(createGunzip()) : source;
  await streamJsonldToNquads(input, outputFile, false);
}

const openZip = promisify(yauzl.open) as (
  path: string,
  options: yauzl.Options,
) => Promise<yauzl.ZipFile>;

async function streamJsonldZip(
  zipFile: string,
  outputFile: string,
  warnings: string[],
): Promise<void> {
  const zip = await openZip(zipFile, { lazyEntries: true });

  let entriesProcessed = 0;
  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject);
    zip.on('end', resolve);
    zip.on('entry', (entry: yauzl.Entry) => {
      void (async () => {
        try {
          if (entry.fileName.endsWith('/')) {
            zip.readEntry();
            return;
          }
          const extension = extname(entry.fileName).toLowerCase();
          if (!JSONLD_ZIP_EXTENSIONS.includes(extension)) {
            warnings.push(
              `Skipping zip entry ${entry.fileName}: extension ${extension || '(none)'} is not JSON-LD`,
            );
            zip.readEntry();
            return;
          }
          const stream = await openZipEntry(zip, entry);
          await streamJsonldToNquads(stream, outputFile, entriesProcessed > 0);
          entriesProcessed++;
          zip.readEntry();
        } catch (error) {
          reject(error);
        }
      })();
    });
    zip.readEntry();
  });

  if (entriesProcessed === 0) {
    throw new Error(`Zip ${zipFile} contains no JSON-LD entries`);
  }
}

function openZipEntry(
  zip: yauzl.ZipFile,
  entry: yauzl.Entry,
): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || stream === undefined) {
        reject(error ?? new Error('Failed to open zip entry'));
        return;
      }
      resolve(stream);
    });
  });
}
