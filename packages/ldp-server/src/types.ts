import type {DatasetCore} from '@rdfjs/types';

/**
 * LDP namespace and type URIs.
 */
export const LDP = {
  namespace: 'http://www.w3.org/ns/ldp#',
  Resource: 'http://www.w3.org/ns/ldp#Resource',
  RDFSource: 'http://www.w3.org/ns/ldp#RDFSource',
  Container: 'http://www.w3.org/ns/ldp#Container',
  BasicContainer: 'http://www.w3.org/ns/ldp#BasicContainer',
  contains: 'http://www.w3.org/ns/ldp#contains',
} as const;

/**
 * DCTerms namespace for metadata.
 */
export const DCTerms = {
  namespace: 'http://purl.org/dc/terms/',
  modified: 'http://purl.org/dc/terms/modified',
} as const;

/**
 * Resource type: container or regular RDF resource.
 */
export type ResourceType = 'container' | 'resource';

/**
 * Metadata about a stored resource.
 */
export interface ResourceMetadata {
  uri: string;
  etag: string;
  type: ResourceType;
  modified: Date;
  container: string | null;
}

/**
 * A stored resource with its metadata and RDF data.
 */
export interface StoredResource {
  metadata: ResourceMetadata;
  data: DatasetCore;
}

/**
 * Options for creating a new resource.
 */
export interface CreateResourceOptions {
  slug?: string;
  data: DatasetCore;
  isContainer: boolean;
}

/**
 * Result type for store operations.
 */
export type StoreResult<T> =
  | {ok: true; value: T}
  | {ok: false; error: StoreError};

/**
 * Error types that can occur during store operations.
 */
export type StoreError =
  | {type: 'not-found'; uri: string}
  | {type: 'conflict'; message: string}
  | {type: 'precondition-failed'; message: string}
  | {type: 'not-empty'; uri: string}
  | {type: 'invalid-container'; uri: string};

/**
 * Plugin options for configuring the LDP server.
 */
export interface LdpServerOptions {
  /**
   * The store to use for persisting resources.
   * Defaults to an in-memory store.
   */
  store?: Store;
}

/**
 * Interface for resource storage backends.
 */
export interface Store {
  /**
   * Check if a resource exists at the given URI.
   */
  exists(uri: string): Promise<boolean>;

  /**
   * Get a resource by its URI.
   */
  get(uri: string): Promise<StoreResult<StoredResource>>;

  /**
   * Create a new resource in a container.
   */
  create(
    containerUri: string,
    options: CreateResourceOptions
  ): Promise<StoreResult<{uri: string; etag: string}>>;

  /**
   * Replace a resource's content.
   */
  replace(
    uri: string,
    data: DatasetCore,
    ifMatch?: string
  ): Promise<StoreResult<{etag: string}>>;

  /**
   * Delete a resource.
   */
  delete(uri: string, ifMatch?: string): Promise<StoreResult<void>>;

  /**
   * Get URIs of resources contained in a container.
   */
  getContained(containerUri: string): Promise<StoreResult<string[]>>;

  /**
   * Initialize the store with a root container.
   */
  initialize(rootUri: string): Promise<void>;
}
