import type {FastifyRequest, FastifyReply} from 'fastify';
import type {DatasetCore, Quad} from '@rdfjs/types';
import {rdfParser} from 'rdf-parse';
import {Store as N3Store} from 'n3';
import {Readable} from 'stream';
import type {Store} from '../store/index.js';
import {setLdpHeaders} from './shared.js';

interface PutRequest extends FastifyRequest {
  headers: FastifyRequest['headers'] & {
    'if-match'?: string;
  };
}

export async function handlePut(
  request: PutRequest,
  reply: FastifyReply,
  store: Store,
  baseUri: string
): Promise<void> {
  const resourceUri = `${baseUri}${request.url}`;

  // Check if resource exists
  const existsResult = await store.get(resourceUri);
  if (!existsResult.ok) {
    if (existsResult.error.type === 'not-found') {
      reply.status(404).send({error: 'Not Found', uri: existsResult.error.uri});
      return;
    }
    reply.status(500).send({error: 'Internal Server Error'});
    return;
  }

  // Parse request body
  const contentType = request.headers['content-type'];
  if (!contentType) {
    reply.status(400).send({error: 'Bad Request', message: 'Content-Type header is required'});
    return;
  }

  let data: DatasetCore;
  try {
    data = await parseRdf(request.body as string, contentType, resourceUri);
  } catch (error) {
    reply.status(400).send({
      error: 'Bad Request',
      message: `Failed to parse RDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    return;
  }

  // Get If-Match header for conditional update
  const ifMatch = request.headers['if-match'];

  const result = await store.replace(resourceUri, data, ifMatch);

  if (!result.ok) {
    if (result.error.type === 'not-found') {
      reply.status(404).send({error: 'Not Found', uri: result.error.uri});
      return;
    }
    if (result.error.type === 'precondition-failed') {
      reply.status(412).send({error: 'Precondition Failed', message: result.error.message});
      return;
    }
    reply.status(500).send({error: 'Internal Server Error'});
    return;
  }

  // Get updated resource for headers
  const updatedResult = await store.get(resourceUri);
  if (updatedResult.ok) {
    setLdpHeaders(reply, updatedResult.value.metadata);
  } else {
    reply.header('ETag', result.value.etag);
  }

  reply.status(204).send();
}

async function parseRdf(
  body: string,
  contentType: string,
  baseIri: string
): Promise<DatasetCore> {
  const store = new N3Store();

  return new Promise((resolve, reject) => {
    const textStream = Readable.from([body]);
    const quadStream = rdfParser.parse(textStream, {
      contentType,
      baseIRI: baseIri,
    });

    quadStream.on('data', (quad: Quad) => store.add(quad));
    quadStream.on('error', reject);
    quadStream.on('end', () => resolve(store));
  });
}
