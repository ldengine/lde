import type {FastifyReply} from 'fastify';
import type {ResourceMetadata} from '../types.js';
import {LDP} from '../types.js';

/**
 * Set standard LDP headers on a response.
 */
export function setLdpHeaders(
  reply: FastifyReply,
  metadata: ResourceMetadata
): void {
  // ETag header
  reply.header('ETag', metadata.etag);

  // Link headers for LDP types
  const linkHeaders: string[] = [`<${LDP.Resource}>; rel="type"`];

  if (metadata.type === 'container') {
    linkHeaders.push(`<${LDP.BasicContainer}>; rel="type"`);
    // Containers accept POST with RDF content types
    reply.header('Accept-Post', 'text/turtle, application/ld+json, application/n-triples, application/n-quads');
  } else {
    linkHeaders.push(`<${LDP.RDFSource}>; rel="type"`);
  }

  reply.header('Link', linkHeaders);

  // Last-Modified header
  reply.header('Last-Modified', metadata.modified.toUTCString());
}
