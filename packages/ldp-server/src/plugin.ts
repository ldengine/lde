import type {FastifyInstance, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';
import {fastifyRdf} from '@lde/fastify-rdf';
import type {LdpServerOptions} from './types.js';
import {MemoryStore} from './store/index.js';
import {
  handleGet,
  handleOptions,
  handlePost,
  handlePut,
  handleDelete,
} from './handlers/index.js';

function getBaseUri(request: FastifyRequest): string {
  return `${request.protocol}://${request.hostname}`;
}

async function ldpServerPlugin(
  fastify: FastifyInstance,
  options: LdpServerOptions
): Promise<void> {
  const store = options.store ?? new MemoryStore();

  // Register fastify-rdf for content negotiation
  await fastify.register(fastifyRdf);

  // Add content type parser for RDF types
  const rdfContentTypes = [
    'text/turtle',
    'application/ld+json',
    'application/n-triples',
    'application/n-quads',
    'application/rdf+xml',
  ];

  for (const contentType of rdfContentTypes) {
    fastify.addContentTypeParser(
      contentType,
      {parseAs: 'string'},
      (_request, payload, done) => {
        done(null, payload);
      }
    );
  }

  // Add hook to ensure root container exists
  let rootInitialized = false;
  fastify.addHook('preHandler', async (request, _reply) => {
    if (!rootInitialized) {
      await store.initialize(`${getBaseUri(request)}/`);
      rootInitialized = true;
    }
  });

  // Register routes
  // Note: Fastify 5 auto-generates HEAD handlers for GET routes
  fastify.get('/*', async (request, reply) => {
    await handleGet(request, reply, store, getBaseUri(request));
  });

  fastify.options('/*', async (request, reply) => {
    await handleOptions(request, reply, store, getBaseUri(request));
  });

  fastify.post('/*', async (request, reply) => {
    await handlePost(request, reply, store, getBaseUri(request));
  });

  fastify.put('/*', async (request, reply) => {
    await handlePut(request, reply, store, getBaseUri(request));
  });

  fastify.delete('/*', async (request, reply) => {
    await handleDelete(request, reply, store, getBaseUri(request));
  });
}

export const ldpServer = fp(ldpServerPlugin, {
  name: '@lde/ldp-server',
  fastify: '5.x',
});
