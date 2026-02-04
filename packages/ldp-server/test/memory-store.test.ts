import {describe, it, expect, beforeEach} from 'vitest';
import {Store as N3Store, DataFactory} from 'n3';
import {MemoryStore} from '../src/store/memory-store.js';
import {LDP} from '../src/types.js';

const {namedNode, quad} = DataFactory;

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = new MemoryStore();
    await store.initialize('http://localhost:3000/');
  });

  describe('initialize', () => {
    it('creates a root container', async () => {
      const result = await store.get('http://localhost:3000/');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.type).toBe('container');
        expect(result.value.metadata.container).toBeNull();
      }
    });

    it('is idempotent', async () => {
      await store.initialize('http://localhost:3000/');
      await store.initialize('http://localhost:3000/');

      const result = await store.get('http://localhost:3000/');
      expect(result.ok).toBe(true);
    });
  });

  describe('exists', () => {
    it('returns true for existing resources', async () => {
      const exists = await store.exists('http://localhost:3000/');
      expect(exists).toBe(true);
    });

    it('returns false for non-existing resources', async () => {
      const exists = await store.exists('http://localhost:3000/nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('get', () => {
    it('returns not-found for non-existing resources', async () => {
      const result = await store.get('http://localhost:3000/nonexistent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not-found');
      }
    });

    it('includes ldp:contains for containers', async () => {
      // Create a resource in the root container
      const data = new N3Store();
      await store.create('http://localhost:3000/', {
        slug: 'resource1',
        data,
        isContainer: false,
      });

      const result = await store.get('http://localhost:3000/');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const containsQuads = [...result.value.data].filter(
          q =>
            q.predicate.value === LDP.contains &&
            q.subject.value === 'http://localhost:3000/'
        );
        expect(containsQuads.length).toBe(1);
      }
    });
  });

  describe('create', () => {
    it('creates a resource in a container', async () => {
      const data = new N3Store();
      data.add(
        quad(
          namedNode(''),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://example.org/Resource')
        )
      );

      const result = await store.create('http://localhost:3000/', {
        slug: 'myresource',
        data,
        isContainer: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.uri).toBe('http://localhost:3000/myresource');
        expect(result.value.etag).toBeTruthy();
      }
    });

    it('creates a container', async () => {
      const data = new N3Store();

      const result = await store.create('http://localhost:3000/', {
        slug: 'subcontainer',
        data,
        isContainer: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.uri).toBe('http://localhost:3000/subcontainer/');
      }

      // Verify it's actually a container
      const getResult = await store.get('http://localhost:3000/subcontainer/');
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.metadata.type).toBe('container');
      }
    });

    it('generates unique ID when no slug provided', async () => {
      const data = new N3Store();

      const result = await store.create('http://localhost:3000/', {
        data,
        isContainer: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.uri).toMatch(/^http:\/\/localhost:3000\/[a-z0-9]+$/);
      }
    });

    it('generates unique ID on conflict', async () => {
      const data = new N3Store();

      // Create first resource
      await store.create('http://localhost:3000/', {
        slug: 'duplicate',
        data,
        isContainer: false,
      });

      // Create second with same slug
      const result = await store.create('http://localhost:3000/', {
        slug: 'duplicate',
        data,
        isContainer: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.uri).not.toBe('http://localhost:3000/duplicate');
        expect(result.value.uri).toContain('duplicate-');
      }
    });

    it('fails when container does not exist', async () => {
      const data = new N3Store();

      const result = await store.create('http://localhost:3000/nonexistent/', {
        slug: 'resource',
        data,
        isContainer: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not-found');
      }
    });

    it('fails when target is not a container', async () => {
      const data = new N3Store();

      // Create a regular resource
      await store.create('http://localhost:3000/', {
        slug: 'resource',
        data,
        isContainer: false,
      });

      // Try to create inside the regular resource
      const result = await store.create('http://localhost:3000/resource', {
        slug: 'child',
        data,
        isContainer: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid-container');
      }
    });
  });

  describe('replace', () => {
    it('replaces resource content', async () => {
      const data = new N3Store();
      const createResult = await store.create('http://localhost:3000/', {
        slug: 'resource',
        data,
        isContainer: false,
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const newData = new N3Store();
      newData.add(
        quad(
          namedNode(createResult.value.uri),
          namedNode('http://example.org/title'),
          namedNode('http://example.org/NewTitle')
        )
      );

      const result = await store.replace(createResult.value.uri, newData);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.etag).not.toBe(createResult.value.etag);
      }
    });

    it('respects If-Match header', async () => {
      const data = new N3Store();
      const createResult = await store.create('http://localhost:3000/', {
        slug: 'resource',
        data,
        isContainer: false,
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const newData = new N3Store();
      const result = await store.replace(
        createResult.value.uri,
        newData,
        'wrong-etag'
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('precondition-failed');
      }
    });

    it('allows update with correct If-Match', async () => {
      const data = new N3Store();
      const createResult = await store.create('http://localhost:3000/', {
        slug: 'resource',
        data,
        isContainer: false,
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const newData = new N3Store();
      const result = await store.replace(
        createResult.value.uri,
        newData,
        createResult.value.etag
      );

      expect(result.ok).toBe(true);
    });

    it('fails for non-existing resource', async () => {
      const data = new N3Store();
      const result = await store.replace('http://localhost:3000/nonexistent', data);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not-found');
      }
    });
  });

  describe('delete', () => {
    it('deletes a resource', async () => {
      const data = new N3Store();
      const createResult = await store.create('http://localhost:3000/', {
        slug: 'resource',
        data,
        isContainer: false,
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await store.delete(createResult.value.uri);
      expect(result.ok).toBe(true);

      // Verify it's gone
      const exists = await store.exists(createResult.value.uri);
      expect(exists).toBe(false);
    });

    it('respects If-Match header', async () => {
      const data = new N3Store();
      const createResult = await store.create('http://localhost:3000/', {
        slug: 'resource',
        data,
        isContainer: false,
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await store.delete(createResult.value.uri, 'wrong-etag');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('precondition-failed');
      }
    });

    it('fails for non-empty container', async () => {
      const data = new N3Store();

      // Create a sub-container
      const containerResult = await store.create('http://localhost:3000/', {
        slug: 'container',
        data,
        isContainer: true,
      });

      expect(containerResult.ok).toBe(true);
      if (!containerResult.ok) return;

      // Create a resource in the container
      await store.create(containerResult.value.uri, {
        slug: 'resource',
        data,
        isContainer: false,
      });

      // Try to delete the container
      const result = await store.delete(containerResult.value.uri);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not-empty');
      }
    });

    it('allows deleting empty container', async () => {
      const data = new N3Store();

      const containerResult = await store.create('http://localhost:3000/', {
        slug: 'emptycontainer',
        data,
        isContainer: true,
      });

      expect(containerResult.ok).toBe(true);
      if (!containerResult.ok) return;

      const result = await store.delete(containerResult.value.uri);
      expect(result.ok).toBe(true);
    });

    it('fails for non-existing resource', async () => {
      const result = await store.delete('http://localhost:3000/nonexistent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not-found');
      }
    });
  });

  describe('getContained', () => {
    it('returns contained resources', async () => {
      const data = new N3Store();

      await store.create('http://localhost:3000/', {
        slug: 'resource1',
        data,
        isContainer: false,
      });

      await store.create('http://localhost:3000/', {
        slug: 'resource2',
        data,
        isContainer: false,
      });

      const result = await store.getContained('http://localhost:3000/');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value).toContain('http://localhost:3000/resource1');
        expect(result.value).toContain('http://localhost:3000/resource2');
      }
    });

    it('fails for non-existing container', async () => {
      const result = await store.getContained('http://localhost:3000/nonexistent/');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not-found');
      }
    });

    it('fails for non-container resource', async () => {
      const data = new N3Store();
      await store.create('http://localhost:3000/', {
        slug: 'resource',
        data,
        isContainer: false,
      });

      const result = await store.getContained('http://localhost:3000/resource');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid-container');
      }
    });
  });
});
