import type {FastifyRequest, FastifyReply} from 'fastify';
import type {Store} from '../store/index.js';

interface DeleteRequest extends FastifyRequest {
  headers: FastifyRequest['headers'] & {
    'if-match'?: string;
  };
}

export async function handleDelete(
  request: DeleteRequest,
  reply: FastifyReply,
  store: Store,
  baseUri: string
): Promise<void> {
  const resourceUri = `${baseUri}${request.url}`;

  // Get If-Match header for conditional delete
  const ifMatch = request.headers['if-match'];

  const result = await store.delete(resourceUri, ifMatch);

  if (!result.ok) {
    if (result.error.type === 'not-found') {
      reply.status(404).send({error: 'Not Found', uri: result.error.uri});
      return;
    }
    if (result.error.type === 'precondition-failed') {
      reply.status(412).send({error: 'Precondition Failed', message: result.error.message});
      return;
    }
    if (result.error.type === 'not-empty') {
      reply.status(409).send({
        error: 'Conflict',
        message: 'Cannot delete non-empty container',
        uri: result.error.uri,
      });
      return;
    }
    reply.status(500).send({error: 'Internal Server Error'});
    return;
  }

  reply.status(204).send();
}
