import type {FastifyRequest, FastifyReply} from 'fastify';
import type {Store} from '../store/index.js';
import {setLdpHeaders} from './shared.js';

const RESOURCE_METHODS = 'GET, HEAD, PUT, DELETE, OPTIONS';
const CONTAINER_METHODS = 'GET, HEAD, POST, PUT, DELETE, OPTIONS';

export async function handleOptions(
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
  const isContainer = resource.metadata.type === 'container';

  setLdpHeaders(reply, resource.metadata);
  reply.header('Allow', isContainer ? CONTAINER_METHODS : RESOURCE_METHODS);

  reply.status(204).send();
}
