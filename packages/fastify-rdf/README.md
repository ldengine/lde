# Fastify RDF

Fastify plugin for serving RDF data with automatic content negotiation.

## Installation

```bash
npm install @lde/fastify-rdf
```

## Features

- Content negotiation for all RDF serialisation formats supported by [rdf-serialize](https://github.com/rubensworks/rdf-serialize.js)
- Handles `Accept` headers to serve data in the requested RDF format (Turtle, N-Triples, JSON-LD, etc.)
- Defaults to Turtle when no `Accept` header is provided
- Provides a `reply.sendRdf()` decorator for explicit RDF responses
- Optional `overrideSend` mode to automatically serialise all responses as RDF

## Usage

### Basic Setup

```typescript
import fastify from 'fastify';
import fastifyRdf from '@lde/fastify-rdf';

const app = fastify();
await app.register(fastifyRdf);
```

### Explicit RDF Responses with `reply.sendRdf()`

Use `reply.sendRdf()` to send RDF data with content negotiation:

```typescript
import { Store, DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

app.get('/resource', async (request, reply) => {
  const store = new Store();
  store.add(
    quad(
      namedNode('http://example.org/subject'),
      namedNode('http://example.org/predicate'),
      literal('object')
    )
  );
  return reply.sendRdf(store);
});
```

### Automatic Serialisation with `overrideSend`

Enable `overrideSend` to automatically serialise all responses as RDF. This is useful for APIs that exclusively serve RDF data:

```typescript
await app.register(fastifyRdf, {
  overrideSend: true,
});

// Simply return DatasetCore or Stream - they will be serialised automatically
app.get('/resource', async () => {
  const store = new Store();
  store.add(
    quad(
      namedNode('http://example.org/subject'),
      namedNode('http://example.org/predicate'),
      literal('object')
    )
  );
  return store;
});
```

### Custom Default Content Type

By default, the plugin uses `text/turtle` when no `Accept` header is provided. You can change this:

```typescript
await app.register(fastifyRdf, {
  defaultContentType: 'application/n-triples',
});
```

## Content Negotiation

The plugin supports all content types provided by [rdf-serialize](https://github.com/rubensworks/rdf-serialize.js), including:

- `text/turtle` (Turtle)
- `application/n-triples` (N-Triples)
- `application/n-quads` (N-Quads)
- `application/ld+json` (JSON-LD)
- `application/rdf+xml` (RDF/XML)
- And more...

Clients can request their preferred format via the `Accept` header:

```bash
# Request Turtle
curl -H "Accept: text/turtle" http://localhost:3000/resource

# Request N-Triples
curl -H "Accept: application/n-triples" http://localhost:3000/resource

# No Accept header - defaults to Turtle
curl http://localhost:3000/resource
```

## API

### Plugin Options

```typescript
interface FastifyRdfOptions {
  /**
   * Default content type when no Accept header is provided.
   * @default 'text/turtle'
   */
  defaultContentType?: string;

  /**
   * Override reply.send() to serialise all responses as RDF.
   * When enabled, all payloads returned from route handlers will be
   * serialised as RDF without type checking.
   * @default false
   */
  overrideSend?: boolean;
}
```

### Supported Data Types

The plugin accepts the following RDF data types:

- **DatasetCore**: RDF.js dataset (e.g., from n3 `Store`)
- **Stream**: RDF.js quad stream (e.g., from parsers)

```typescript
import type { RdfData, FastifyRdfOptions } from '@lde/fastify-rdf';
```

## TypeScript

The plugin includes full TypeScript support with type augmentation for Fastify's reply object:

```typescript
// reply.sendRdf() is automatically typed
app.get('/data', async (request, reply) => {
  return reply.sendRdf(dataset);
});
```
