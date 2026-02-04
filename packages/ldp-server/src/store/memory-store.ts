import type {DatasetCore} from '@rdfjs/types';
import {Store as N3Store, DataFactory} from 'n3';
import type {
  Store,
  StoreResult,
  StoredResource,
  ResourceMetadata,
  CreateResourceOptions,
} from './store.js';
import {LDP, DCTerms} from '../types.js';

const {namedNode, literal, quad} = DataFactory;

/**
 * In-memory implementation of the Store interface.
 */
export class MemoryStore implements Store {
  private resources = new Map<string, StoredResource>();

  async exists(uri: string): Promise<boolean> {
    return this.resources.has(normalizeUri(uri));
  }

  async get(uri: string): Promise<StoreResult<StoredResource>> {
    const normalized = normalizeUri(uri);
    const resource = this.resources.get(normalized);
    if (!resource) {
      return {ok: false, error: {type: 'not-found', uri: normalized}};
    }

    // For containers, include ldp:contains triples
    if (resource.metadata.type === 'container') {
      const data = new N3Store([...resource.data]);
      const containerUri = normalizeUri(resource.metadata.uri);

      for (const [, stored] of this.resources) {
        if (stored.metadata.container === containerUri) {
          data.add(
            quad(
              namedNode(containerUri),
              namedNode(LDP.contains),
              namedNode(stored.metadata.uri)
            )
          );
        }
      }

      return {
        ok: true,
        value: {
          metadata: resource.metadata,
          data,
        },
      };
    }

    return {ok: true, value: resource};
  }

  async create(
    containerUri: string,
    options: CreateResourceOptions
  ): Promise<StoreResult<{uri: string; etag: string}>> {
    const normalizedContainer = normalizeUri(containerUri);
    const container = this.resources.get(normalizedContainer);

    if (!container) {
      return {
        ok: false,
        error: {type: 'not-found', uri: normalizedContainer},
      };
    }

    if (container.metadata.type !== 'container') {
      return {
        ok: false,
        error: {type: 'invalid-container', uri: normalizedContainer},
      };
    }

    const resourceName = options.slug ?? generateId();
    let resourceUri = `${normalizedContainer}${resourceName}`;
    if (options.isContainer) {
      resourceUri = ensureTrailingSlash(resourceUri);
    }

    // Check for conflicts
    if (this.resources.has(resourceUri)) {
      // Try with a suffix
      const uniqueName = `${resourceName}-${generateId()}`;
      resourceUri = `${normalizedContainer}${uniqueName}`;
      if (options.isContainer) {
        resourceUri = ensureTrailingSlash(resourceUri);
      }
    }

    const etag = generateEtag();
    const now = new Date();

    // Build resource data with type triples
    const data = new N3Store([...options.data]);
    const subject = namedNode(resourceUri);

    data.add(quad(subject, namedNode(LDP.Resource), subject));

    if (options.isContainer) {
      data.add(
        quad(
          subject,
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode(LDP.BasicContainer)
        )
      );
    } else {
      data.add(
        quad(
          subject,
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode(LDP.RDFSource)
        )
      );
    }

    data.add(
      quad(
        subject,
        namedNode(DCTerms.modified),
        literal(now.toISOString(), namedNode('http://www.w3.org/2001/XMLSchema#dateTime'))
      )
    );

    const metadata: ResourceMetadata = {
      uri: resourceUri,
      etag,
      type: options.isContainer ? 'container' : 'resource',
      modified: now,
      container: normalizedContainer,
    };

    this.resources.set(resourceUri, {metadata, data});

    return {ok: true, value: {uri: resourceUri, etag}};
  }

  async replace(
    uri: string,
    data: DatasetCore,
    ifMatch?: string
  ): Promise<StoreResult<{etag: string}>> {
    const normalized = normalizeUri(uri);
    const existing = this.resources.get(normalized);

    if (!existing) {
      return {ok: false, error: {type: 'not-found', uri: normalized}};
    }

    if (ifMatch && existing.metadata.etag !== ifMatch) {
      return {
        ok: false,
        error: {
          type: 'precondition-failed',
          message: `ETag mismatch: expected ${existing.metadata.etag}, got ${ifMatch}`,
        },
      };
    }

    const etag = generateEtag();
    const now = new Date();

    // Build new data with type triples preserved
    const newData = new N3Store([...data]);
    const subject = namedNode(normalized);

    newData.add(quad(subject, namedNode(LDP.Resource), subject));

    if (existing.metadata.type === 'container') {
      newData.add(
        quad(
          subject,
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode(LDP.BasicContainer)
        )
      );
    } else {
      newData.add(
        quad(
          subject,
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode(LDP.RDFSource)
        )
      );
    }

    newData.add(
      quad(
        subject,
        namedNode(DCTerms.modified),
        literal(now.toISOString(), namedNode('http://www.w3.org/2001/XMLSchema#dateTime'))
      )
    );

    this.resources.set(normalized, {
      metadata: {
        ...existing.metadata,
        etag,
        modified: now,
      },
      data: newData,
    });

    return {ok: true, value: {etag}};
  }

  async delete(uri: string, ifMatch?: string): Promise<StoreResult<void>> {
    const normalized = normalizeUri(uri);
    const existing = this.resources.get(normalized);

    if (!existing) {
      return {ok: false, error: {type: 'not-found', uri: normalized}};
    }

    if (ifMatch && existing.metadata.etag !== ifMatch) {
      return {
        ok: false,
        error: {
          type: 'precondition-failed',
          message: `ETag mismatch: expected ${existing.metadata.etag}, got ${ifMatch}`,
        },
      };
    }

    // Check if container is non-empty
    if (existing.metadata.type === 'container') {
      for (const [, stored] of this.resources) {
        if (stored.metadata.container === normalized) {
          return {ok: false, error: {type: 'not-empty', uri: normalized}};
        }
      }
    }

    this.resources.delete(normalized);
    return {ok: true, value: undefined};
  }

  async getContained(containerUri: string): Promise<StoreResult<string[]>> {
    const normalized = normalizeUri(containerUri);
    const container = this.resources.get(normalized);

    if (!container) {
      return {ok: false, error: {type: 'not-found', uri: normalized}};
    }

    if (container.metadata.type !== 'container') {
      return {ok: false, error: {type: 'invalid-container', uri: normalized}};
    }

    const contained: string[] = [];
    for (const [, stored] of this.resources) {
      if (stored.metadata.container === normalized) {
        contained.push(stored.metadata.uri);
      }
    }

    return {ok: true, value: contained};
  }

  async initialize(rootUri: string): Promise<void> {
    const normalized = ensureTrailingSlash(normalizeUri(rootUri));

    if (this.resources.has(normalized)) {
      return;
    }

    const etag = generateEtag();
    const now = new Date();

    const data = new N3Store();
    const subject = namedNode(normalized);

    data.add(
      quad(
        subject,
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode(LDP.BasicContainer)
      )
    );
    data.add(
      quad(
        subject,
        namedNode(DCTerms.modified),
        literal(now.toISOString(), namedNode('http://www.w3.org/2001/XMLSchema#dateTime'))
      )
    );

    this.resources.set(normalized, {
      metadata: {
        uri: normalized,
        etag,
        type: 'container',
        modified: now,
        container: null,
      },
      data,
    });
  }
}

function normalizeUri(uri: string): string {
  // Remove query strings and fragments
  const url = new URL(uri, 'http://localhost');
  return `${url.origin}${url.pathname}`;
}

function ensureTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function generateEtag(): string {
  return `"${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}"`;
}
