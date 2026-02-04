import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import Fastify, {type FastifyInstance} from 'fastify';
import {ldpServer, LDP} from '../src/index.js';

describe('ldpServer plugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(ldpServer);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET', () => {
    it('returns the root container', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: {
          Accept: 'text/turtle',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
      expect(response.headers['etag']).toBeTruthy();
      expect(response.headers['link']).toBeDefined();
    });

    it('returns 404 for non-existing resource', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nonexistent',
        headers: {
          Accept: 'text/turtle',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('includes LDP type headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: {
          Accept: 'text/turtle',
        },
      });

      const linkHeaders = Array.isArray(response.headers['link'])
        ? response.headers['link']
        : [response.headers['link']];
      const linkStr = linkHeaders.join(', ');

      expect(linkStr).toContain(LDP.Resource);
      expect(linkStr).toContain(LDP.BasicContainer);
    });
  });

  describe('HEAD', () => {
    it('returns headers without body', async () => {
      const response = await app.inject({
        method: 'HEAD',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['etag']).toBeTruthy();
      expect(response.body).toBe('');
    });

    it('returns 404 for non-existing resource', async () => {
      const response = await app.inject({
        method: 'HEAD',
        url: '/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('OPTIONS', () => {
    it('returns allowed methods for containers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/',
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['allow']).toContain('GET');
      expect(response.headers['allow']).toContain('POST');
      expect(response.headers['allow']).toContain('PUT');
      expect(response.headers['allow']).toContain('DELETE');
    });

    it('returns allowed methods for resources', async () => {
      // First create a resource
      await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'myresource',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      const response = await app.inject({
        method: 'OPTIONS',
        url: '/myresource',
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['allow']).toContain('GET');
      expect(response.headers['allow']).not.toContain('POST');
    });
  });

  describe('POST', () => {
    it('creates a resource in a container', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'myresource',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      expect(response.statusCode).toBe(201);
      expect(response.headers['location']).toContain('myresource');
      expect(response.headers['etag']).toBeTruthy();
    });

    it('creates a container with Link header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'subcontainer',
          Link: `<${LDP.BasicContainer}>; rel="type"`,
        },
        payload: '',
      });

      expect(response.statusCode).toBe(201);
      expect(response.headers['location']).toContain('subcontainer/');

      // Verify it's a container
      const getResponse = await app.inject({
        method: 'GET',
        url: '/subcontainer/',
        headers: {
          Accept: 'text/turtle',
        },
      });

      const linkHeaders = Array.isArray(getResponse.headers['link'])
        ? getResponse.headers['link']
        : [getResponse.headers['link']];
      const linkStr = linkHeaders.join(', ');

      expect(linkStr).toContain(LDP.BasicContainer);
    });

    it('returns 415 for missing Content-Type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: '<> a <http://example.org/Resource> .',
      });

      // Fastify returns 415 Unsupported Media Type when no content type parser matches
      expect(response.statusCode).toBe(415);
    });

    it('returns 400 for invalid RDF', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
        },
        payload: 'this is not valid turtle <<<',
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 405 when POSTing to a non-container', async () => {
      // First create a resource
      await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'resource',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      // Try to POST to the resource
      const response = await app.inject({
        method: 'POST',
        url: '/resource',
        headers: {
          'Content-Type': 'text/turtle',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      expect(response.statusCode).toBe(405);
    });
  });

  describe('PUT', () => {
    it('replaces resource content', async () => {
      // First create a resource
      const createResponse = await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'myresource',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      const location = createResponse.headers['location'] as string;
      const url = new URL(location);

      // Replace it
      const response = await app.inject({
        method: 'PUT',
        url: url.pathname,
        headers: {
          'Content-Type': 'text/turtle',
        },
        payload: '<> a <http://example.org/UpdatedResource> .',
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['etag']).toBeTruthy();
    });

    it('respects If-Match header', async () => {
      // First create a resource
      const createResponse = await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'myresource',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      const location = createResponse.headers['location'] as string;
      const url = new URL(location);

      // Try to replace with wrong ETag
      const response = await app.inject({
        method: 'PUT',
        url: url.pathname,
        headers: {
          'Content-Type': 'text/turtle',
          'If-Match': '"wrong-etag"',
        },
        payload: '<> a <http://example.org/UpdatedResource> .',
      });

      expect(response.statusCode).toBe(412);
    });

    it('returns 404 for non-existing resource', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/nonexistent',
        headers: {
          'Content-Type': 'text/turtle',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE', () => {
    it('deletes a resource', async () => {
      // First create a resource
      const createResponse = await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'myresource',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      const location = createResponse.headers['location'] as string;
      const url = new URL(location);

      // Delete it
      const response = await app.inject({
        method: 'DELETE',
        url: url.pathname,
      });

      expect(response.statusCode).toBe(204);

      // Verify it's gone
      const getResponse = await app.inject({
        method: 'GET',
        url: url.pathname,
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('respects If-Match header', async () => {
      // First create a resource
      const createResponse = await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'myresource',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      const location = createResponse.headers['location'] as string;
      const url = new URL(location);

      // Try to delete with wrong ETag
      const response = await app.inject({
        method: 'DELETE',
        url: url.pathname,
        headers: {
          'If-Match': '"wrong-etag"',
        },
      });

      expect(response.statusCode).toBe(412);
    });

    it('returns 409 when deleting non-empty container', async () => {
      // Create a sub-container
      await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'container',
          Link: `<${LDP.BasicContainer}>; rel="type"`,
        },
        payload: '',
      });

      // Create a resource in the container
      await app.inject({
        method: 'POST',
        url: '/container/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'resource',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      // Try to delete the container
      const response = await app.inject({
        method: 'DELETE',
        url: '/container/',
      });

      expect(response.statusCode).toBe(409);
    });

    it('returns 404 for non-existing resource', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Content negotiation', () => {
    it('returns Turtle for text/turtle Accept', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: {
          Accept: 'text/turtle',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
    });

    it('returns JSON-LD for application/ld+json Accept', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: {
          Accept: 'application/ld+json',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/ld+json');
    });
  });

  describe('Container membership', () => {
    it('includes ldp:contains for container contents', async () => {
      // Create resources in the root container
      await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'resource1',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          'Content-Type': 'text/turtle',
          Slug: 'resource2',
        },
        payload: '<> a <http://example.org/Resource> .',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: {
          Accept: 'text/turtle',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain(LDP.contains);
      expect(response.body).toContain('resource1');
      expect(response.body).toContain('resource2');
    });
  });
});
