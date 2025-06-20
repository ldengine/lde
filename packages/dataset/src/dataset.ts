export class Dataset {
  constructor(public readonly iri: URL, public distributions: Distribution[]) {}

  public getSparqlDistribution(): Distribution | null {
    return (
      this.distributions.filter(
        (distribution) => distribution.isSparql() && distribution.isValid
      )[0] ?? null
    );
  }

  public getDownloadDistributions(): Distribution[] {
    const validDistributions = this.distributions.filter(
      (distribution) => distribution.isValid
    );

    return [
      ...validDistributions.filter((distribution) =>
        distribution.mimeType?.endsWith('+gzip')
      ),
      ...validDistributions.filter((distribution) =>
        distribution.accessUrl?.endsWith('.nt.gz')
      ),
      ...validDistributions.filter(
        (distribution) =>
          undefined !== distribution.mimeType &&
          ['application/n-triples', 'text/turtle'].includes(
            distribution.mimeType
          )
      ),
    ];
  }
}

export class Distribution {
  public byteSize?: number;
  public lastModified?: Date;
  public isValid?: boolean;
  public namedGraph?: string;

  constructor(
    public readonly accessUrl: string,
    public readonly mimeType: string
  ) {}

  public isSparql() {
    return (
      (this.mimeType === 'application/sparql-query' ||
        this.mimeType === 'application/sparql-results+json') &&
      this.accessUrl !== null
    );
  }

  public static sparql(endpoint: string, namedGraph?: string) {
    const distribution = new this('application/sparql-query', endpoint);
    distribution.isValid = true;
    distribution.namedGraph = namedGraph;

    return distribution;
  }
}
