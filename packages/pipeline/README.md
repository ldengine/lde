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

### Stage

A stage groups an item selector, one or more executors, and configuration:

```typescript
new Stage({
  name: 'per-class',
  itemSelector: new SparqlItemSelector({
    query: 'SELECT DISTINCT ?class WHERE { ?s a ?class }',
  }),
  executors: executor,
  batchSize: 100,
  maxConcurrency: 5,
});
```

#### Batch size

`batchSize` (default: 10) controls how many variable bindings are passed to each executor call as a `VALUES` clause. It also sets the page size for the item selector's SPARQL requests, so that each paginated request fills exactly one executor batch.

Some SPARQL endpoints enforce different result limits for SELECT and CONSTRUCT queries. Since the selector uses SELECT and the executor uses CONSTRUCT, a `LIMIT` clause in the selector query overrides `batchSize` as the page size. Use this when the endpoint caps SELECT results below your desired batch size:

```typescript
// Endpoint caps SELECT results at 500, but each CONSTRUCT can handle 1000 bindings.
new Stage({
  name: 'per-class',
  itemSelector: new SparqlItemSelector({
    query: 'SELECT DISTINCT ?class WHERE { ?s a ?class } LIMIT 500',
  }),
  executors: executor,
  batchSize: 1000, // Two SELECT pages fill one CONSTRUCT batch.
});
```

#### Concurrency

`maxConcurrency` (default: 10) controls how many batches run in parallel. Within each batch, all executors run in parallel too, so the peak number of concurrent SPARQL queries is `maxConcurrency × executorCount`. For example, with `maxConcurrency: 5` and two executors per stage, up to 10 SPARQL queries may be in flight at the same time. Lower `maxConcurrency` if the endpoint can't handle the load.

### Item Selector

Selects resources from the distribution and fans out executor calls per batch of results. Implements the `ItemSelector` interface:

```typescript
interface ItemSelector {
  select(distribution: Distribution, batchSize?: number): AsyncIterable<VariableBindings>;
}
```

The distribution is received at run time, so selectors don't need the endpoint URL at construction time. The `batchSize` parameter is set by the stage. Use `SparqlItemSelector` for SPARQL-based selection with automatic pagination:

```typescript
new SparqlItemSelector({
  query: 'SELECT DISTINCT ?class WHERE { ?s a ?class }',
});
```

For dynamic queries that depend on the distribution, implement `ItemSelector` directly:

```typescript
const itemSelector: ItemSelector = {
  select: (distribution, batchSize) => {
    const query = buildQuery(distribution);
    return new SparqlItemSelector({ query }).select(distribution, batchSize);
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

When querying endpoints that return line-oriented formats like N-Triples (e.g. QLever), enable `lineBuffer` to work around an [N3.js chunk-splitting bug](https://github.com/rdfjs/N3.js/issues/578) that causes intermittent parse errors on large responses:

```typescript
const executor = new SparqlConstructExecutor({
  query: 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
  lineBuffer: true,
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

Stages can optionally validate their output quads against a `Validator`. Validation operates on the **combined output of all executors per batch**, not on individual quads or per-executor output. A batch produces a complete result set — a self-contained cluster of linked resources — that can be meaningfully matched against SHACL shapes. Even with a single executor, each batch is a complete unit; with multiple executors, shapes that reference triples from different executors are validated correctly.

Validating individual quads would be meaningless, since a single quad carries no structural context for shape matching. Validating the full pipeline output would also be problematic: because the pipeline streams results in batches, it doesn’t know where resource cluster boundaries fall. Batching the output could split a valid cluster across two batches, causing partial resources to fail validation even though the complete cluster is valid.

Quads are buffered, validated, and then written or discarded based on the `onInvalid` policy. When no validator is configured, quads stream directly with zero overhead.

```typescript
import { ShaclValidator } from '@lde/pipeline-shacl-validator';

new Stage({
  name: 'transform',
  executors: await SparqlConstructExecutor.fromFile('transform.rq'),
  validation: {
    validator: new ShaclValidator({
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
