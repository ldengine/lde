const SPARQL_URI = 'https://www.w3.org/TR/sparql11-protocol/';

export const IANA_MEDIA_TYPE_PREFIX =
  'https://www.iana.org/assignments/media-types/';

export class Distribution {
  public byteSize?: number;
  public compressFormat?: string;
  public lastModified?: Date;
  public namedGraph?: string;
  public subjectFilter?: string;

  /**
   * Plain content type derived from {@link mediaType}, e.g. `application/n-triples`.
   * Use this for HTTP headers, format matching, etc.
   */
  public readonly mimeType?: string;

  /**
   * @param accessUrl  Distribution access URL.
   * @param mediaType  IANA media type URI per DCAT-AP 3.0
   *   (e.g. `https://www.iana.org/assignments/media-types/application/n-triples`),
   *   or a plain content type for convenience.
   * @param conformsTo Specification the distribution conforms to.
   */
  constructor(
    public readonly accessUrl: URL,
    public readonly mediaType?: string,
    public readonly conformsTo?: URL,
  ) {
    this.mimeType = mediaType?.startsWith(IANA_MEDIA_TYPE_PREFIX)
      ? mediaType.slice(IANA_MEDIA_TYPE_PREFIX.length)
      : mediaType;
  }

  public isSparql() {
    return (
      (this.conformsTo?.toString() == SPARQL_URI ||
        this.mimeType === 'application/sparql-query' ||
        this.mimeType === 'application/sparql-results+json') &&
      this.accessUrl !== null
    );
  }

  public static sparql(endpoint: URL, namedGraph?: string) {
    const distribution = new this(
      endpoint,
      IANA_MEDIA_TYPE_PREFIX + 'application/sparql-query',
      new URL(SPARQL_URI),
    );
    distribution.namedGraph = namedGraph;

    return distribution;
  }
}

export enum RdfFormat {
  'N-Triples' = 'application/n-triples',
  'N-Quads' = 'application/n-quads',
  Turtle = 'text/turtle',
}

export function rdfFormatToFileExtension(rdfFormat: RdfFormat): string {
  switch (rdfFormat) {
    case RdfFormat['N-Triples']:
      return 'nt';
    case RdfFormat['N-Quads']:
      return 'nq';
    case RdfFormat.Turtle:
      return 'ttl';
    default:
      throw new Error(`Unknown mime type: ${rdfFormat}`);
  }
}
