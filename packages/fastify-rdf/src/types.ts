import type { DatasetCore, Stream } from '@rdfjs/types';

/**
 * Options for the fastify-rdf plugin.
 */
export interface FastifyRdfOptions {
  /**
   * Default content type when no Accept header is provided.
   * @default 'text/turtle'
   */
  defaultContentType?: string;

  /**
   * Override reply.send() to serialize all responses as RDF.
   * When enabled, all payloads returned from route handlers will be
   * serialized as RDF.
   * @default false
   */
  overrideSend?: boolean;
}

/**
 * RDF data that can be serialized: either a DatasetCore or an RDF.js Stream of quads.
 */
export type RdfData = DatasetCore | Stream;

declare module 'fastify' {
  interface FastifyReply {
    /**
     * Send RDF data with content negotiation based on Accept header.
     * @param data - RDF DatasetCore or Stream to serialize
     * @returns The data (when overrideSend is enabled) or Promise<FastifyReply>
     */
    sendRdf(data: RdfData): RdfData | Promise<FastifyReply>;
  }
}
