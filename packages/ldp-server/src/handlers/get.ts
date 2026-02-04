import type {FastifyRequest, FastifyReply} from 'fastify';
import type {Store} from '../store/index.js';
import {setLdpHeaders} from './shared.js';

export async function handleGet(
  request: FastifyRequest,
  reply: FastifyReply,
  store: Store,
  baseUri: string
): Promise<void> {
  const resourceUri = `${baseUri}${request.url}`;
  const result = await store.get(resourceUri);

  if (!result.ok) {
    if (result.error.type === 'not-found') {
      reply.status(404).send({error: 'Not Found', uri: result.error.uri});
      return;
    }
    reply.status(500).send({error: 'Internal Server Error'});
    return;
  }

  const resource = result.value;
  setLdpHeaders(reply, resource.metadata);

  // For HEAD requests, Fastify automatically omits the body
  await reply.sendRdf(resource.data);
}
