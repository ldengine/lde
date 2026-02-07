import { Dataset } from '@lde/dataset';
import type { DatasetCore, Quad } from '@rdfjs/types';
import { Writer as N3Writer } from 'n3';
import { Writer } from './writer.js';

export interface SparqlWriterOptions {
  /**
   * The SPARQL UPDATE endpoint URL.
   */
  endpoint: URL;
  /**
   * Optional fetch implementation for making HTTP requests.
   * @default globalThis.fetch
   */
  fetch?: typeof globalThis.fetch;
  /**
   * Maximum number of triples to include in a single INSERT DATA request.
   * Larger batches are more efficient but may hit endpoint size limits.
   * @default 10000
   */
  batchSize?: number;
}

/**
 * Writes RDF data to a SPARQL endpoint using SPARQL UPDATE INSERT DATA queries.
 *
 * Each dataset's data is written to a named graph based on the dataset IRI.
 */
export class SparqlUpdateWriter implements Writer {
  private readonly endpoint: URL;
  private readonly fetch: typeof globalThis.fetch;
  private readonly batchSize: number;

  constructor(options: SparqlWriterOptions) {
    this.endpoint = options.endpoint;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.batchSize = options.batchSize ?? 10000;
  }

  async write(dataset: Dataset, data: DatasetCore): Promise<void> {
    const graphUri = dataset.iri.toString();
    const quads = [...data];

    if (quads.length === 0) {
      return;
    }

    // Process in batches to avoid hitting endpoint size limits.
    for (let i = 0; i < quads.length; i += this.batchSize) {
      const batch = quads.slice(i, i + this.batchSize);
      await this.insertBatch(graphUri, batch);
    }
  }

  private async insertBatch(graphUri: string, quads: Quad[]): Promise<void> {
    const turtleData = await this.quadsToTurtle(quads);
    const query = `INSERT DATA { GRAPH <${graphUri}> { ${turtleData} } }`;

    const response = await this.fetch(this.endpoint.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-update',
      },
      body: query,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `SPARQL UPDATE failed with status ${response.status}: ${body}`
      );
    }
  }

  private quadsToTurtle(quads: Quad[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const writer = new N3Writer({ format: 'N-Triples' });

      for (const quad of quads) {
        writer.addQuad(quad);
      }

      writer.end((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }
}
