import { Dataset } from '@lde/dataset';
import type { Quad } from '@rdfjs/types';
import { batch } from '../batch.js';
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
 * Clears the named graph before writing, then streams quads in batches
 * to avoid accumulating the entire dataset in memory.
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
    await this.clearGraph(graphUri);

    for await (const chunk of batch(quads, this.batchSize)) {
      await this.insertBatch(graphUri, chunk);
    }
  }

  private async clearGraph(graphUri: string): Promise<void> {
    await this.executeUpdate(`CLEAR GRAPH <${graphUri}>`);
  }

  private async insertBatch(graphUri: string, quads: Quad[]): Promise<void> {
    const turtleData = await serializeQuads(quads, 'N-Triples');
    await this.executeUpdate(
      `INSERT DATA { GRAPH <${graphUri}> { ${turtleData} } }`
    );
  }

  private async executeUpdate(query: string): Promise<void> {
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
