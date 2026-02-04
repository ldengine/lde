import type {FastifyRequest, FastifyReply} from 'fastify';
import type {DatasetCore, Quad} from '@rdfjs/types';
import {rdfParser} from 'rdf-parse';
import {Store as N3Store} from 'n3';
import {Readable} from 'stream';
import type {Store} from '../store/index.js';
import {LDP} from '../types.js';

interface PostRequest extends FastifyRequest {
  headers: FastifyRequest['headers'] & {
    slug?: string;
    link?: string | string[];
  };
}

export async function handlePost(
  request: PostRequest,
  reply: FastifyReply,
  store: Store,
  baseUri: string
): Promise<void> {
  const containerUri = `${baseUri}${request.url}`;

  // Check if container exists
  const containerResult = await store.get(containerUri);
  if (!containerResult.ok) {
    if (containerResult.error.type === 'not-found') {
      reply.status(404).send({error: 'Not Found', uri: containerResult.error.uri});
      return;
    }
    reply.status(500).send({error: 'Internal Server Error'});
    return;
  }

  if (containerResult.value.metadata.type !== 'container') {
    reply.status(405).send({error: 'Method Not Allowed', message: 'POST is only allowed on containers'});
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
    data = await parseRdf(request.body as string, contentType, containerUri);
  } catch (error) {
    reply.status(400).send({
      error: 'Bad Request',
      message: `Failed to parse RDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    return;
  }

  // Check if creating a container
  const isContainer = isContainerCreation(request.headers.link);

  // Get slug for URI hint
  const slug = request.headers.slug;

  const result = await store.create(containerUri, {
    slug,
    data,
    isContainer,
  });

  if (!result.ok) {
    if (result.error.type === 'not-found') {
      reply.status(404).send({error: 'Not Found', uri: result.error.uri});
      return;
    }
    if (result.error.type === 'invalid-container') {
      reply.status(405).send({error: 'Method Not Allowed', message: 'POST is only allowed on containers'});
      return;
    }
    reply.status(500).send({error: 'Internal Server Error'});
    return;
  }

  reply.header('Location', result.value.uri);
  reply.header('ETag', result.value.etag);

  // Set Link headers
  const linkHeaders = [`<${LDP.Resource}>; rel="type"`];
  if (isContainer) {
    linkHeaders.push(`<${LDP.BasicContainer}>; rel="type"`);
  } else {
    linkHeaders.push(`<${LDP.RDFSource}>; rel="type"`);
  }
  reply.header('Link', linkHeaders);

  reply.status(201).send();
}

function isContainerCreation(linkHeader: string | string[] | undefined): boolean {
  if (!linkHeader) {
    return false;
  }

  const links = Array.isArray(linkHeader) ? linkHeader : [linkHeader];

  for (const link of links) {
    // Parse Link header format: <uri>; rel="type"
    if (link.includes(LDP.BasicContainer) && link.includes('rel="type"')) {
      return true;
    }
    if (link.includes(LDP.Container) && link.includes('rel="type"')) {
      return true;
    }
  }

  return false;
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
