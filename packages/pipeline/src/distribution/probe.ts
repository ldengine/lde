import { Distribution } from '@lde/dataset';

/**
 * Result of a network error during probing.
 */
export class NetworkError {
  constructor(public readonly url: string, public readonly message: string) {}
}

/**
 * Base class for successful probe results.
 */
abstract class ProbeResult {
  public readonly statusCode: number;
  public readonly statusText: string;
  public readonly lastModified: Date | null = null;
  public readonly contentType: string | null;

  constructor(public readonly url: string, response: Response) {
    this.statusCode = response.status;
    this.statusText = response.statusText;
    this.contentType = response.headers.get('Content-Type');
    const lastModifiedHeader = response.headers.get('Last-Modified');
    if (lastModifiedHeader) {
      this.lastModified = new Date(lastModifiedHeader);
    }
  }

  public isSuccess(): boolean {
    return this.statusCode >= 200 && this.statusCode < 400;
  }
}

/**
 * Result of probing a SPARQL endpoint.
 */
export class SparqlProbeResult extends ProbeResult {
  public readonly acceptedContentType = 'application/sparql-results+json';

  override isSuccess(): boolean {
    return (
      super.isSuccess() &&
      (this.contentType?.startsWith(this.acceptedContentType) ?? false)
    );
  }
}

/**
 * Result of probing a data dump distribution.
 */
export class DataDumpProbeResult extends ProbeResult {
  public readonly contentSize: number | null = null;

  constructor(url: string, response: Response) {
    super(url, response);
    const contentLengthHeader = response.headers.get('Content-Length');
    if (contentLengthHeader) {
      this.contentSize = parseInt(contentLengthHeader);
    }
  }
}

export type ProbeResultType =
  | SparqlProbeResult
  | DataDumpProbeResult
  | NetworkError;

/**
 * Probe a distribution to check availability and gather metadata.
 *
 * For SPARQL endpoints, sends a simple SELECT query.
 * For data dumps, sends HEAD (or GET if HEAD returns no Content-Length).
 *
 * Updates the distribution's isValid, lastModified, and byteSize properties.
 */
export async function probe(
  distribution: Distribution,
  timeout = 5000
): Promise<ProbeResultType> {
  try {
    if (distribution.isSparql()) {
      return await probeSparqlEndpoint(distribution, timeout);
    }
    return await probeDataDump(distribution, timeout);
  } catch (e) {
    return new NetworkError(
      distribution.accessUrl?.toString() ?? 'unknown',
      e instanceof Error ? e.message : String(e)
    );
  }
}

async function probeSparqlEndpoint(
  distribution: Distribution,
  timeout: number
): Promise<SparqlProbeResult | NetworkError> {
  const url = distribution.accessUrl!.toString();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Accept: 'application/sparql-results+json',
    },
    body: `query=${encodeURIComponent('SELECT * { ?s ?p ?o } LIMIT 1')}`,
  });

  const result = new SparqlProbeResult(url, response);
  distribution.isValid = result.isSuccess();
  return result;
}

async function probeDataDump(
  distribution: Distribution,
  timeout: number
): Promise<DataDumpProbeResult | NetworkError> {
  const url = distribution.accessUrl!.toString();
  const requestOptions = {
    signal: AbortSignal.timeout(timeout),
    headers: {
      Accept: distribution.mimeType ?? '*/*',
      'Accept-Encoding': 'identity', // Return uncompressed responses.
    },
  };

  let response = await fetch(url, {
    method: 'HEAD',
    ...requestOptions,
  });

  const contentLength = response.headers.get('Content-Length');
  if (contentLength === null || contentLength === '0') {
    // Retry as GET request for servers incorrectly returning HEAD request Content-Length,
    // which *should* be the size of the response body when issuing a GET, not that of
    // the response to a HEAD request, which is intentionally 0.
    response = await fetch(url, {
      method: 'GET',
      ...requestOptions,
    });
  }

  const result = new DataDumpProbeResult(url, response);
  distribution.isValid = result.isSuccess();
  distribution.lastModified ??= result.lastModified ?? undefined;
  distribution.byteSize ??= result.contentSize ?? undefined;
  return result;
}
