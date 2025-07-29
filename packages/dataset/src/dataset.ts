import { Distribution } from './distribution.js';

export interface Publisher {
  readonly iri: URL;
  readonly name: Record<string, string>;
}

export interface Creator {
  readonly iri: URL;
  readonly name: Record<string, string>;
}

export interface DatasetArguments {
  iri: URL;
  title: Record<string, string>;
  description?: Record<string, string>;
  language?: string[];
  license?: URL;
  distributions: Distribution[];
  creator?: Creator[];
  publisher?: Publisher;
}

export class Dataset {
  readonly iri: URL;
  readonly title?: Record<string, string>;
  readonly description?: Record<string, string>;
  readonly language: string[];
  readonly license?: URL;
  readonly distributions: Distribution[];
  readonly creator: Creator[];
  readonly publisher?: Publisher;

  constructor(options: DatasetArguments) {
    this.iri = options.iri;
    this.title = options.title ?? { '': '' };
    this.description = options.description;
    this.language = options.language ?? [];
    this.license = options.license;
    this.distributions = options.distributions;
    this.creator = options.creator ?? [];
    this.publisher = options.publisher;
  }

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
