import { Distribution } from '@lde/dataset';
import jsonld from 'jsonld';
import { createGunzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { appendFile, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
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
 * For each supported inner mediaType inside a zip, the file extensions we will
 * accept and the conversion kind. Turtle is deliberately absent: concatenating
 * Turtle files mid-stream is unsafe because of prefix declarations.
 */
const ZIP_INNER_FORMATS: Record<
  string,
  { extensions: string[]; kind: 'jsonld' | 'nquads-compatible' }
> = {
  'application/ld+json': {
    extensions: ['.jsonld', '.json'],
    kind: 'jsonld',
  },
  'application/n-triples': {
    extensions: ['.nt'],
    kind: 'nquads-compatible',
  },
  'application/n-quads': {
    extensions: ['.nq'],
    kind: 'nquads-compatible',
  },
};

export interface PreprocessResult {
  /** Path to the file ready for `qlever-index`. Always N-Quads. */
  path: string;
  format: PreprocessedFormat;
  warnings: string[];
}

/**
 * Whether a distribution needs preprocessing before `qlever-index` can read it.
 *
 * Preprocessing applies when:
 * - the data is JSON-LD (which `qlever-index` does not read directly), or
 * - it is wrapped in a zip archive (which `gunzip -c` cannot unpack).
 *
 * Gzipped native RDF formats do not need preprocessing — they go straight
 * through the existing `gunzip -c | qlever-index` pipeline.
 *
 * A standalone `mediaType=application/zip` is intentionally not handled here:
 * the inner RDF format must be declared (via `mediaType` with `compressFormat`
 * set to `application/zip`) so we know what to expect inside the archive.
 */
export function needsPreprocessing(distribution: Distribution): boolean {
  return (
    distribution.mimeType === JSONLD_MIME ||
    distribution.compressMimeType === ZIP_MIME
  );
}

/**
 * Preprocess a downloaded distribution into a single N-Quads file alongside
 * the original. Caches the result: if the output is newer than the input the
 * existing file is reused.
 */
export async function preprocess(
  localFile: string,
  distribution: Distribution,
): Promise<PreprocessResult> {
  const outputFile = `${localFile}.preprocessed.nq`;
  if (await outputIsUpToDate(localFile, outputFile)) {
    return { path: outputFile, format: PREPROCESSED_FORMAT, warnings: [] };
  }

  await rm(outputFile, { force: true });
  const warnings: string[] = [];

  if (distribution.compressMimeType === ZIP_MIME) {
    await processZip(localFile, outputFile, distribution, warnings);
  } else if (distribution.mimeType === JSONLD_MIME) {
    const content = await readPossiblyGzipped(localFile, distribution);
    await writeFile(outputFile, await jsonldToNquads(content));
  } else {
    throw new Error(
      `preprocess called for distribution that does not need preprocessing: mediaType=${distribution.mimeType}`,
    );
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

async function readPossiblyGzipped(
  localFile: string,
  distribution: Distribution,
): Promise<string> {
  const isGzipped =
    distribution.compressMimeType === GZIP_MIME ||
    distribution.compressMimeType === GZIP_MIME_LEGACY ||
    localFile.toLowerCase().endsWith('.gz');
  if (!isGzipped) {
    return readFile(localFile, 'utf-8');
  }
  return text(createReadStream(localFile).pipe(createGunzip()));
}

async function jsonldToNquads(content: string): Promise<string> {
  const parsed: unknown = JSON.parse(content);
  return (await jsonld.toRDF(parsed as object, {
    format: 'application/n-quads',
  })) as unknown as string;
}

const openZip = promisify(yauzl.open) as (
  path: string,
  options: yauzl.Options,
) => Promise<yauzl.ZipFile>;

async function processZip(
  zipFile: string,
  outputFile: string,
  distribution: Distribution,
  warnings: string[],
): Promise<void> {
  const innerMimeType = distribution.mimeType;
  const expected = innerMimeType ? ZIP_INNER_FORMATS[innerMimeType] : undefined;
  if (expected === undefined) {
    throw new Error(
      `Unsupported zip inner mediaType: ${innerMimeType ?? 'undeclared'}. ` +
        `Supported inner formats: ${Object.keys(ZIP_INNER_FORMATS).join(', ')}.`,
    );
  }

  const zip = await openZip(zipFile, { lazyEntries: true });

  let rdfEntriesProcessed = 0;
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
          if (!expected.extensions.includes(extension)) {
            warnings.push(
              `Skipping zip entry ${entry.fileName}: extension ${extension || '(none)'} does not match declared inner mediaType ${innerMimeType}`,
            );
            zip.readEntry();
            return;
          }
          const stream = await openZipEntry(zip, entry);
          const content = await text(stream);
          const nquads =
            expected.kind === 'jsonld'
              ? await jsonldToNquads(content)
              : content;
          await appendFile(outputFile, nquads);
          rdfEntriesProcessed++;
          zip.readEntry();
        } catch (error) {
          reject(error);
        }
      })();
    });
    zip.readEntry();
  });

  if (rdfEntriesProcessed === 0) {
    throw new Error(
      `Zip ${zipFile} contains no entries matching declared inner mediaType ${innerMimeType}`,
    );
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
