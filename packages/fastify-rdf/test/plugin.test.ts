import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { DataFactory, Store, StreamParser } from 'n3';
import { Readable } from 'node:stream';
import { fastifyRdf } from '../src/index.js';

const { namedNode, literal, quad } = DataFactory;

const TEST_TURTLE = `
  <http://example.org/subject> <http://example.org/predicate> "object" .
`;

function createTestDataset(): Store {
  const store = new Store();
  store.add(
    quad(
      namedNode('http://example.org/subject'),
      namedNode('http://example.org/predicate'),
      literal('object')
    )
  );
  return store;
}

/**
 * Create a proper RDF.js Stream by parsing Turtle data.
 */
function createRdfStream() {
  const parser = new StreamParser();
  const textStream = Readable.from([TEST_TURTLE]);
  return textStream.pipe(parser);
}

describe('fastifyRdf plugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('content negotiation', () => {
    it('should default to Turtle when no Accept header is provided', async () => {
      await app.register(fastifyRdf);
      app.get('/data', async (_request, reply) => {
        return reply.sendRdf(createTestDataset());
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
    });

    it('should default to Turtle when Accept is */*', async () => {
      await app.register(fastifyRdf);
      app.get('/data', async (_request, reply) => {
        return reply.sendRdf(createTestDataset());
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
        headers: { accept: '*/*' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
    });

    it('should serialize as Turtle when requested', async () => {
      await app.register(fastifyRdf);
      app.get('/data', async (_request, reply) => {
        return reply.sendRdf(createTestDataset());
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
      expect(response.body).toContain('http://example.org/subject');
    });

    it('should serialize as N-Triples when requested', async () => {
      await app.register(fastifyRdf);
      app.get('/data', async (_request, reply) => {
        return reply.sendRdf(createTestDataset());
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
        headers: { accept: 'application/n-triples' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/n-triples'
      );
      expect(response.body).toContain('<http://example.org/subject>');
    });

    it('should serialize as N-Quads when requested', async () => {
      await app.register(fastifyRdf);
      app.get('/data', async (_request, reply) => {
        return reply.sendRdf(createTestDataset());
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
        headers: { accept: 'application/n-quads' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/n-quads');
      expect(response.body).toContain('<http://example.org/subject>');
    });

    it('should fall back to default when Accept type is not supported', async () => {
      await app.register(fastifyRdf);
      app.get('/data', async (_request, reply) => {
        return reply.sendRdf(createTestDataset());
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
        headers: { accept: 'application/unsupported-format' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
    });
  });

  describe('custom default content type', () => {
    it('should use custom default content type when configured', async () => {
      await app.register(fastifyRdf, {
        defaultContentType: 'text/turtle',
      });
      app.get('/data', async (_request, reply) => {
        return reply.sendRdf(createTestDataset());
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
    });
  });

  describe('reply.sendRdf', () => {
    it('should serialize DatasetCore', async () => {
      await app.register(fastifyRdf);
      app.get('/data', async (_request, reply) => {
        return reply.sendRdf(createTestDataset());
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
      expect(response.body).toContain('http://example.org/subject');
    });

    it('should serialize RDF.js Stream', async () => {
      await app.register(fastifyRdf);
      app.get('/data', async (_request, reply) => {
        return reply.sendRdf(createRdfStream());
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
        headers: { accept: 'application/n-triples' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/n-triples'
      );
      expect(response.body).toContain('<http://example.org/subject>');
    });
  });

  describe('overrideSend option', () => {
    it('should serialize DatasetCore returned from handler', async () => {
      await app.register(fastifyRdf, { overrideSend: true });
      app.get('/data', async () => {
        return createTestDataset();
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
      expect(response.body).toContain('http://example.org/subject');
    });

    it('should serialize RDF.js Stream returned from handler', async () => {
      await app.register(fastifyRdf, { overrideSend: true });
      app.get('/data', async () => {
        return createRdfStream();
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
        headers: { accept: 'application/n-triples' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/n-triples'
      );
      expect(response.body).toContain('<http://example.org/subject>');
    });

    it('should use default content type when no Accept header', async () => {
      await app.register(fastifyRdf, { overrideSend: true });
      app.get('/data', async () => {
        return createTestDataset();
      });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/data',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
    });
  });
});
