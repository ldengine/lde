import { Dataset } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import { Writer } from './writer.js';
import { serializeQuads } from './serialize.js';

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

  async write(dataset: Dataset, quads: AsyncIterable<Quad>): Promise<void> {
    const graphUri = dataset.iri.toString();
    const collected: Quad[] = [];
    for await (const quad of quads) {
      collected.push(quad);
    }

    if (collected.length === 0) {
      return;
    }

    // Process in batches to avoid hitting endpoint size limits.
    for (let i = 0; i < collected.length; i += this.batchSize) {
      const batch = collected.slice(i, i + this.batchSize);
      await this.insertBatch(graphUri, batch);
    }
  }

  private async insertBatch(graphUri: string, quads: Quad[]): Promise<void> {
    const turtleData = await serializeQuads(quads, 'N-Triples');
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
}
