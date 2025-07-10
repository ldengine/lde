import { Distribution } from './distribution.js';

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
        distribution.accessUrl?.toString().endsWith('.nt.gz')
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
