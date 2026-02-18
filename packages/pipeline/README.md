# Pipeline

@lde/pipeline is a framework for building pipelines that transform (large) RDF datasets with pure [SPARQL](https://www.w3.org/TR/sparql11-query/).

## Features

- Full pipeline framework and toolkit out of the box.
- Transparent, portable data transformations with pure SPARQL queries.
- Where needed, the plain SPARQL queries can be decorated with TypeScript code to add logic that cannot be expressed (well) in SPARQL.
- Plugin architecture and focus on composition enable clean extension points.
- Configure pipelines in YAML or TypeScript.

## Approach

### Design principles

- Focus on composition: objects are decorated to add functionality. The inheritance tree is kept simple on purpose.
  Examples are importing distributions (ImportResolver wrapping DistributionResolver) and
- Plugin architecture: hooks that can be extended by shareable plugins. @lde/pipeline wants to have an ecosystem function.

### Components

A **Pipeline** consists of:

- a **Dataset Selector** that selects which datasets to process
- a **Distribution Resolver** that resolves each dataset to a usable SPARQL endpoint
- one or more **Stages**, each consisting of:
  - an optional **Item Selector** that selects resources (as variable bindings) for fan-out
  - one or more **Executors** that generate triples

### Dataset Selector

Selects datasets, either manually or by querying a DCAT Dataset Registry:

```typescript
// From a registry
const selector = new RegistrySelector({
  registry: new Client(new URL('https://example.com/sparql')),
});

// Manual
const selector = new ManualDatasetSelection([dataset]);
```

### Item Selector

Selects resources from the distribution and fans out executor calls per batch of results. Implements the `ItemSelector` interface:

```typescript
interface ItemSelector {
  select(distribution: Distribution): AsyncIterable<VariableBindings>;
}
```

The distribution is received at run time, so selectors don't need the endpoint URL at construction time. Use `SparqlItemSelector` for SPARQL-based selection with automatic pagination:

```typescript
new SparqlItemSelector({
  query: 'SELECT DISTINCT ?class WHERE { ?s a ?class }',
});
```

For dynamic queries that depend on the distribution, implement `ItemSelector` directly:

```typescript
const itemSelector: ItemSelector = {
  select: (distribution) => {
    const query = buildQuery(distribution);
    return new SparqlItemSelector({ query }).select(distribution);
  },
};
```

### Executor

Generates RDF triples. `SparqlConstructExecutor` runs a SPARQL CONSTRUCT query with template substitution and variable bindings:

```typescript
const executor = new SparqlConstructExecutor({
  query: 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
});
```

### Writer

Writes generated quads to a destination:

- `SparqlUpdateWriter` — writes to a SPARQL endpoint via UPDATE queries
- `FileWriter` — writes to local files

## Usage

```typescript
import {
  Pipeline,
  Stage,
  SparqlConstructExecutor,
  SparqlItemSelector,
  SparqlUpdateWriter,
  ManualDatasetSelection,
  SparqlDistributionResolver,
} from '@lde/pipeline';

const pipeline = new Pipeline({
  datasetSelector: new ManualDatasetSelection([dataset]),
  stages: [
    new Stage({
      name: 'per-class',
      itemSelector: new SparqlItemSelector({
        query: 'SELECT DISTINCT ?class WHERE { ?s a ?class }',
      }),
      executors: new SparqlConstructExecutor({
        query:
          'CONSTRUCT { ?class a <http://example.org/Class> } WHERE { ?s a ?class }',
      }),
    }),
  ],
  writers: new SparqlUpdateWriter({
    endpoint: new URL('http://localhost:7200/repositories/lde/statements'),
  }),
});

await pipeline.run();
```
