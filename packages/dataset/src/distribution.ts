export class Distribution {
  public byteSize?: number;
  public lastModified?: Date;
  public isValid?: boolean;
  public namedGraph?: string;
  public subjectFilter?: string;

  constructor(
    public readonly accessUrl: URL,
    public readonly mimeType: string
  ) {}

  public isSparql() {
    return (
      (this.mimeType === 'application/sparql-query' ||
        this.mimeType === 'application/sparql-results+json') &&
      this.accessUrl !== null
    );
  }

  public static sparql(endpoint: URL, namedGraph?: string) {
    const distribution = new this(endpoint, 'application/sparql-query');
    distribution.isValid = true;
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
