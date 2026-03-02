import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import type { DatasetCore } from '@rdfjs/types';
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
      literal('object'),
    ),
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
        'application/n-triples',
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
        'application/n-triples',
      );
      expect(response.body).toContain('<http://example.org/subject>');
    });
  });

  describe('parseRdf option', () => {
    it('should parse Turtle body into DatasetCore', async () => {
      await app.register(fastifyRdf, { parseRdf: true });
      app.post('/data', { config: { parseRdf: true } }, async (request) => {
        const dataset = request.body as DatasetCore;
        return { size: dataset.size };
      });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/data',
        headers: { 'content-type': 'text/turtle' },
        body: '<http://example.org/s> <http://example.org/p> "o" .',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ size: 1 });
    });

    it('should parse JSON-LD body into DatasetCore', async () => {
      await app.register(fastifyRdf, { parseRdf: true });
      app.post('/data', { config: { parseRdf: true } }, async (request) => {
        const dataset = request.body as DatasetCore;
        return { size: dataset.size };
      });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/data',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify({
          '@id': 'http://example.org/s',
          'http://example.org/p': 'o',
        }),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ size: 1 });
    });

    it('should parse N-Triples body into DatasetCore', async () => {
      await app.register(fastifyRdf, { parseRdf: true });
      app.post('/data', { config: { parseRdf: true } }, async (request) => {
        const dataset = request.body as DatasetCore;
        return { size: dataset.size };
      });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/data',
        headers: { 'content-type': 'application/n-triples' },
        body: '<http://example.org/s> <http://example.org/p> "o" .\n',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ size: 1 });
    });

    it('should fall back to plain JSON for application/ld+json without parseRdf config', async () => {
      await app.register(fastifyRdf, { parseRdf: true });
      app.post('/data', async (request) => {
        return { body: request.body };
      });
      await app.ready();

      const jsonLd = {
        '@id': 'http://example.org/s',
        'http://example.org/p': 'o',
      };
      const response = await app.inject({
        method: 'POST',
        url: '/data',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify(jsonLd),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ body: jsonLd });
    });

    it('should return 415 for text/turtle without parseRdf config', async () => {
      await app.register(fastifyRdf, { parseRdf: true });
      app.post('/data', async (request) => {
        return { body: request.body };
      });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/data',
        headers: { 'content-type': 'text/turtle' },
        body: '<http://example.org/s> <http://example.org/p> "o" .',
      });

      expect(response.statusCode).toBe(415);
    });

    it('should not register parsers when parseRdf option is not set', async () => {
      await app.register(fastifyRdf);
      app.post('/data', async (request) => {
        return { body: request.body };
      });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/data',
        headers: { 'content-type': 'text/turtle' },
        body: '<http://example.org/s> <http://example.org/p> "o" .',
      });

      // Fastify returns 415 by default for unrecognised content types when
      // the route has no matching parser.
      expect(response.statusCode).toBe(415);
    });

    it('should return 400 for malformed RDF body', async () => {
      await app.register(fastifyRdf, { parseRdf: true });
      app.post('/data', { config: { parseRdf: true } }, async (request) => {
        const dataset = request.body as DatasetCore;
        return { size: dataset.size };
      });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/data',
        headers: { 'content-type': 'text/turtle' },
        body: 'this is not valid turtle {{{',
      });

      expect(response.statusCode).toBe(400);
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
        'application/n-triples',
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
