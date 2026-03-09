# Pipeline

A framework for transforming large RDF datasets, primarily using [SPARQL](https://www.w3.org/TR/sparql11-query/) queries with TypeScript for the parts that are hard to express in SPARQL alone.

- **SPARQL-native.** Data transformations are plain SPARQL query files — portable, transparent, testable and version-controlled.
- **Composable.** Executors are an interface: wrap a SPARQL executor with custom TypeScript to handle edge cases like date parsing or string normalisation (see [Executor](#executor)).
- **Extensible.** A plugin system lets packages like [@lde/pipeline-void](../pipeline-void) (or your own plugins) hook into the pipeline lifecycle.

## Components

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

Generates RDF triples. The built-in `SparqlConstructExecutor` runs a SPARQL CONSTRUCT query with template substitution and variable bindings:

```typescript
const executor = new SparqlConstructExecutor({
  query: 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
});
```

`Executor` is an interface, so you can implement your own for logic that's hard to express in pure SPARQL — for example, cleaning up messy date notations or converting locale-specific dates to ISO 8601. The decorator pattern lets you wrap a SPARQL executor and post-process its quad stream in TypeScript:

```typescript
import { DataFactory } from 'n3';
import type { Quad, Literal } from '@rdfjs/types';
import type { Dataset, Distribution } from '@lde/dataset';
import {
  type Executor,
  type ExecuteOptions,
  NotSupported,
} from '@lde/pipeline';

class TransformExecutor implements Executor {
  constructor(
    private readonly inner: Executor,
    private readonly transform: (
      quads: AsyncIterable<Quad>,
      dataset: Dataset,
    ) => AsyncIterable<Quad>,
  ) {}

  async execute(
    dataset: Dataset,
    distribution: Distribution,
    options?: ExecuteOptions,
  ): Promise<AsyncIterable<Quad> | NotSupported> {
    const result = await this.inner.execute(dataset, distribution, options);
    if (result instanceof NotSupported) return result;
    return this.transform(result, dataset);
  }
}
```

Then use it to wrap any SPARQL executor:

```typescript
new Stage({
  name: 'dates',
  executors: new TransformExecutor(
    await SparqlConstructExecutor.fromFile('dates.rq'),
    async function* (quads) {
      for await (const quad of quads) {
        if (quad.object.termType === 'Literal' && isMessyDate(quad.object)) {
          const cleaned = DataFactory.literal(
            parseDutchDate(quad.object.value),
            DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#date'),
          );
          yield DataFactory.quad(quad.subject, quad.predicate, cleaned);
        } else {
          yield quad;
        }
      }
    },
  ),
});
```

This keeps SPARQL doing the heavy lifting while TypeScript handles the edge cases. See [@lde/pipeline-void](../pipeline-void)'s `VocabularyExecutor` for a real-world example of this pattern.

### Validation

Stages can optionally validate their output quads against a `Validator`. Validation is per executor batch — quads are buffered, validated, and then written or discarded based on the `onInvalid` policy. When no validator is configured, quads stream directly with zero overhead.

```typescript
import { ShaclPipelineValidator } from '@lde/pipeline-shacl-validator';

new Stage({
  name: 'transform',
  executors: await SparqlConstructExecutor.fromFile('transform.rq'),
  validation: {
    validator: new ShaclPipelineValidator({
      shapesFile: './shapes.ttl',
      reportDir: './validation',
    }),
    onInvalid: 'write', // 'write' (default) | 'skip' | 'halt'
  },
});
```

| `onInvalid` | Behaviour                                          |
| ----------- | -------------------------------------------------- |
| `'write'`   | Write quads even if validation fails **(default)** |
| `'skip'`    | Discard the batch silently                         |
| `'halt'`    | Throw an error, stopping the pipeline              |

`Validator` is an interface, so you can implement your own validation strategy. See [@lde/pipeline-shacl-validator](../pipeline-shacl-validator) for the SHACL implementation.

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
