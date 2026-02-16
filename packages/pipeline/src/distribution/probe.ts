import { Distribution } from '@lde/dataset';
import { Parser } from 'n3';

/**
 * Result of a network error during probing.
 */
export class NetworkError {
  constructor(
    public readonly url: string,
    public readonly message: string,
  ) {}
}

/**
 * Base class for successful probe results.
 */
abstract class ProbeResult {
  public readonly statusCode: number;
  public readonly statusText: string;
  public readonly lastModified: Date | null = null;
  public readonly contentType: string | null;

  constructor(
    public readonly url: string,
    response: Response,
  ) {
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
  public readonly failureReason: string | null;

  constructor(
    url: string,
    response: Response,
    failureReason: string | null = null,
  ) {
    super(url, response);
    this.failureReason = failureReason;
    const contentLengthHeader = response.headers.get('Content-Length');
    if (contentLengthHeader) {
      this.contentSize = parseInt(contentLengthHeader);
    }
  }

  override isSuccess(): boolean {
    return super.isSuccess() && this.failureReason === null;
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
 * Returns pure probe results without mutating the distribution.
 */
export async function probe(
  distribution: Distribution,
  timeout = 5000,
): Promise<ProbeResultType> {
  try {
    if (distribution.isSparql()) {
      return await probeSparqlEndpoint(distribution, timeout);
    }
    return await probeDataDump(distribution, timeout);
  } catch (e) {
    return new NetworkError(
      distribution.accessUrl?.toString() ?? 'unknown',
      e instanceof Error ? e.message : String(e),
    );
  }
}

async function probeSparqlEndpoint(
  distribution: Distribution,
  timeout: number,
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

  return new SparqlProbeResult(url, response);
}

async function probeDataDump(
  distribution: Distribution,
  timeout: number,
): Promise<DataDumpProbeResult | NetworkError> {
  const url = distribution.accessUrl!.toString();
  const requestOptions = {
    signal: AbortSignal.timeout(timeout),
    headers: {
      Accept: distribution.mimeType ?? '*/*',
      'Accept-Encoding': 'identity', // Return uncompressed responses.
    },
  };

  const headResponse = await fetch(url, {
    method: 'HEAD',
    ...requestOptions,
  });

  const contentLength = headResponse.headers.get('Content-Length');
  const contentLengthBytes = contentLength ? parseInt(contentLength) : 0;

  // For small or unknown-size files, do a GET to validate body content.
  // This also handles servers that incorrectly return 0 Content-Length for HEAD.
  if (contentLengthBytes <= 10_240) {
    const getResponse = await fetch(url, {
      method: 'GET',
      ...requestOptions,
    });
    const body = await getResponse.text();
    const isHttpSuccess = getResponse.status >= 200 && getResponse.status < 400;
    const failureReason = isHttpSuccess
      ? validateBody(body, getResponse.headers.get('Content-Type'))
      : null;
    return new DataDumpProbeResult(url, getResponse, failureReason);
  }

  return new DataDumpProbeResult(url, headResponse);
}

const rdfContentTypes = [
  'text/turtle',
  'application/n-triples',
  'application/n-quads',
];

function validateBody(body: string, contentType: string | null): string | null {
  if (body.length === 0) {
    return 'Distribution is empty';
  }

  if (contentType && rdfContentTypes.some((t) => contentType.startsWith(t))) {
    try {
      const parser = new Parser();
      const quads = parser.parse(body);
      if (quads.length === 0) {
        return 'Distribution contains no RDF triples';
      }
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }

  return null;
}
