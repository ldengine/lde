# @lde/ldp-server

A Fastify plugin implementing the [W3C Linked Data Platform (LDP) 1.0](https://www.w3.org/TR/ldp/) specification for storing RDF resources within containers.

## Features

- **LDP Basic Containers (LDP-BC)** for organizing resources
- **RDF sources (LDP-RS)** with full content negotiation via [@lde/fastify-rdf](../fastify-rdf)
- **In-memory storage** with a `Store` interface for custom backends
- **Conditional requests** with ETag support (`If-Match` headers)
- **Standard LDP headers** (`Link`, `Accept-Post`, `Allow`)

## Installation

```bash
npm install @lde/ldp-server
```

## Usage

```typescript
import Fastify from 'fastify';
import {ldpServer} from '@lde/ldp-server';

const app = Fastify();
await app.register(ldpServer);
await app.listen({port: 3000});
```

### With custom store

```typescript
import {ldpServer, MemoryStore} from '@lde/ldp-server';

const store = new MemoryStore();
await app.register(ldpServer, {store});
```

## HTTP Methods

| Method  | Description                      | Notes                           |
| ------- | -------------------------------- | ------------------------------- |
| GET     | Retrieve resource                | Content negotiation via Accept  |
| HEAD    | Retrieve headers only            | Same as GET without body        |
| OPTIONS | List allowed methods             | Returns `Allow`, `Accept-Post`  |
| POST    | Create resource in container     | Uses `Slug` header for URI hint |
| PUT     | Replace resource                 | Conditional via `If-Match`      |
| DELETE  | Remove resource                  | Fails if container is non-empty |

## Examples

### Create a container

```bash
curl -X POST http://localhost:3000/ \
  -H "Slug: my-dataset" \
  -H 'Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"' \
  -H "Content-Type: text/turtle" \
  -d ""
```

### Create an RDF resource

```bash
curl -X POST http://localhost:3000/my-dataset/ \
  -H "Slug: resource1" \
  -H "Content-Type: text/turtle" \
  -d "<> a <http://example.org/Resource> ."
```

### Retrieve a resource

```bash
curl http://localhost:3000/my-dataset/resource1 \
  -H "Accept: text/turtle"
```

### Update a resource

```bash
curl -X PUT http://localhost:3000/my-dataset/resource1 \
  -H "Content-Type: text/turtle" \
  -H 'If-Match: "abc123"' \
  -d "<> a <http://example.org/UpdatedResource> ."
```

### Delete a resource

```bash
curl -X DELETE http://localhost:3000/my-dataset/resource1
```

## Custom Store Implementation

Implement the `Store` interface to use a different backend:

```typescript
import type {Store, StoreResult, StoredResource, CreateResourceOptions} from '@lde/ldp-server';
import type {DatasetCore} from '@rdfjs/types';

class MyStore implements Store {
  async exists(uri: string): Promise<boolean> { /* ... */ }
  async get(uri: string): Promise<StoreResult<StoredResource>> { /* ... */ }
  async create(containerUri: string, options: CreateResourceOptions): Promise<StoreResult<{uri: string; etag: string}>> { /* ... */ }
  async replace(uri: string, data: DatasetCore, ifMatch?: string): Promise<StoreResult<{etag: string}>> { /* ... */ }
  async delete(uri: string, ifMatch?: string): Promise<StoreResult<void>> { /* ... */ }
  async getContained(containerUri: string): Promise<StoreResult<string[]>> { /* ... */ }
  async initialize(rootUri: string): Promise<void> { /* ... */ }
}
```

## LDP Compliance

This package implements a subset of LDP 1.0:

- ✅ LDP-RS (RDF Source)
- ✅ LDP-BC (Basic Container)
- ✅ `ldp:contains` membership triples
- ✅ `Slug` header for resource naming
- ✅ Conditional requests (`If-Match`)
- ❌ LDP-NR (Non-RDF Source / binary resources)
- ❌ LDP-DC (Direct Container)
- ❌ LDP-IC (Indirect Container)

## Validation

```bash
npx nx build ldp-server
npx nx test ldp-server
npx nx lint ldp-server
npx nx typecheck ldp-server
```

## License

MIT
