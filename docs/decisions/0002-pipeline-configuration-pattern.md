# ADR-0002: Pipeline configuration pattern

## Status

Accepted

## Context

The pipeline needs a TypeScript configuration API that serves two consumers:

1. **DKG (dataset-knowledge-graph)** — assembles pre-built `Stage` objects from `@lde/pipeline-void` factory functions.
2. **LD Workbench replacement** — configures stages inline with selectors, chaining, executors, and decorators.

A future YAML path for ops/non-developers must produce the same runtime objects.

**Pipeline configurations are read and written by both humans and AI agents.** Developers author configs by hand; AI coding assistants generate, modify, and review them. The configuration pattern must be equally accessible to both: a structure that humans can scan at a glance and that AI agents can parse, generate, and transform without needing to simulate stateful call sequences or resolve implicit ordering.

The API needs to handle:

- Simple aggregate stages (one CONSTRUCT query, no selector).
- Complex stages with item selectors, batching, concurrency, executor decorators.
- Chained stages where one stage's output feeds the next.
- Async stage construction (reading query files from disk).
- Cross-cutting decorators applied to all stages (e.g. provenance).
- **Extensibility**: users must be able to add their own stage types (e.g. SPARQL Anything) without modifying `@lde/pipeline`.
- **AI legibility**: an AI agent must be able to read, generate, and modify pipeline configs from a type signature alone — no implicit state, no required call ordering, no hidden side effects.

## Decision

**Constructor args for Pipeline, standalone factory functions with typed callback builders for stages.**

### Pipeline: options object

Pipeline accepts a plain options object. `Stage` is the extension point — anyone who can produce a `Stage` can participate in a pipeline. Pipeline doesn't know or care about stage types.

```typescript
interface PipelineOptions {
  selector: DatasetSelector;
  stages: Array<Stage | Promise<Stage>>;
  writers: Writer | Writer[];
  name?: string;
  reporter?: ProgressReporter;
  distributionResolver?: DistributionResolver;
  eachStage?: (stage: Stage) => Stage;
}

await new Pipeline(options).run();
```

`stages` accepts `Promise<Stage>` so factory functions like `createClassPartitionStage()` don't need `await` at the call site; promises are resolved in `.run()`.

`eachStage` applies a decorator to every stage (e.g. `withProvenance`). Applied after per-stage configuration.

### Stage factories: standalone functions, not static methods

Stage factory functions are standalone exports, not static methods on `Stage`. This makes built-in and third-party stage types symmetric — both are just functions that return `Stage`.

**Built-in** (from `@lde/pipeline`):

```typescript
import { construct, chain } from '@lde/pipeline';

construct('classes', (s) => s.query('queries/classes.rq'));

construct('per-class-properties', (s) =>
  s
    .select('SELECT DISTINCT ?class WHERE { ?s a ?class }')
    .query('queries/class-property-datatypes.rq')
    .batchSize(20)
    .wrap((executor) => new VocabularyExecutor(executor)),
);

chain('extract-and-enrich', (c) =>
  c
    .first('extract', (s) =>
      s
        .select('SELECT $this WHERE { $this a schema:Person }')
        .query('queries/extract.rq'),
    )
    .then('enrich', 'queries/enrich.rq'),
);
```

**Third-party** (e.g. from `@lde/sparql-anything`):

```typescript
import { sparqlAnything } from '@lde/sparql-anything';

sparqlAnything('csv-to-rdf', (s) =>
  s.source('data.csv').query('queries/csv-transform.rq'),
);
```

Both follow the same pattern: a function that takes a name and a callback, and returns `Stage`. No privileged position for built-in types. Plugin authors follow the exact same pattern.

Each callback receives a typed builder (`ConstructStageBuilder`, `SparqlAnythingStageBuilder`, etc.) scoped to that stage type's options. Autocomplete shows only what applies.

### Human and AI legibility

The pattern is designed so that both a human scanning the file and an AI agent operating on it can immediately understand the pipeline's structure:

- **Declarative tree.** A pipeline config is a single `new Pipeline({...})` expression containing an array of stage expressions. The entire pipeline is visible in one place — no state scattered across statements, no ordering dependencies between calls.
- **Self-describing.** Each stage factory names its type: `construct`, `chain`, `sparqlAnything`. The function name tells the reader (human or AI) what kind of stage it is, without resolving class hierarchies or constructor overloads.
- **Locally complete.** Each stage expression contains everything needed to understand it. An AI can insert, reorder, or remove stages without affecting the rest of the config.
- **Serialisable.** The config maps 1:1 to a YAML/JSON structure. Both humans and AI agents can translate between TypeScript and YAML without losing information.

### Extensibility

Third-party stage types are functions that return `Stage`:

```typescript
// Plugin author: factory function with typed callback builder
function sparqlAnything(
  name: string,
  configure: (s: SparqlAnythingStageBuilder) => SparqlAnythingStageBuilder,
): Stage {
  return configure(new SparqlAnythingStageBuilder(name)).build();
}

// User: all stages are the same shape in the array
await new Pipeline({
  stages: [
    construct('classes', (s) => s.query('queries/classes.rq')),
    sparqlAnything('csv-to-rdf', (s) =>
      s.source('data.csv').query('queries/transform.rq'),
    ),
    createPerClassDatatypeStage(), // pre-built from @lde/pipeline-void
  ],
}).run();
```

No module augmentation, no prototype patching, no plugin registration.

### YAML maps to constructors

```
TypeScript user  ->  construct() / sparqlAnything() / new Pipeline({...})  ->  runtime
YAML factory     ->  Zod parse -> new Pipeline({...}) / new Stage({...})   ->  same runtime
```

The YAML factory calls constructors directly. Callback builders are a TypeScript DX layer that doesn't affect the YAML path. Constructors are the stable internal API that both paths target.

## Alternatives considered

### Static methods on Stage (`Stage.construct()`, `Stage.chain()`)

```typescript
Stage.construct('classes', s => s.query('queries/classes.rq'))
Stage.chain('extract-and-enrich', c => c.first(...).then(...))
```

Creates an asymmetry between built-in and third-party stage types. Built-in types get `Stage.construct()` — a static method on `Stage`. Plugins get `sparqlAnything()` — a standalone function. Two different shapes for the same concept. A plugin can never add a static method to `Stage` without modifying `@lde/pipeline`, so the asymmetry is permanent. Standalone functions for everything avoids this.

### Full Pipeline builder

```typescript
Pipeline
  .from(selector)
  .construct('classes', s => s.query('queries/classes.rq'))
  .anything('csv-to-rdf', s => s.source('data.csv').query('...'))
  .writeTo(new SparqlUpdateWriter({...}))
  .run();
```

Advantages:

- Guided ordering (`.from()` then stages then `.writeTo()`).
- Single entry point: the user types `Pipeline.from()` and autocomplete guides them through everything, including stage types. No need to discover `construct()` separately.
- Accumulation (`.construct().construct()` instead of arrays).

Rejected because:

- **Extensibility requires module augmentation.** Adding a new stage type (e.g. `.anything()`) to the Pipeline builder requires `declare module` + prototype patching — fragile, import-order dependent, not tree-shakeable.
- **Pre-built stages are second-class.** DKG's primary pattern is factory-built stages. With a Pipeline builder these become `.stage(createPerClassDatatypeStage())` mixed with `.construct(...)` — two different verbs for adding stages.
- **Double maintenance.** YAML still maps to constructors, so both paths must be maintained.
- **Hard to parse for AI agents.** Fluent chains encode implicit ordering and mutable state. An AI must simulate the call sequence to understand the final configuration — or to insert a stage in the right position. A plain array of stages is trivially parseable and modifiable.
- Pipeline has few properties; the flat-list autocomplete problem doesn't apply at this level.

### Plain options objects for everything

```typescript
new Stage({
  name: 'per-class-properties',
  executors: new SparqlConstructExecutor({query: rawQuery}),
  itemSelector: new SparqlItemSelector({query: '...'}),
  batchSize: 20,
  stages: [new Stage({...}), new Stage({...})],
})
```

Rejected because:

- Flat alphabetical autocomplete for 6+ properties with no indication of what matters or what depends on what.
- Nested objects (child stages, selectors) lose autocomplete quality in most IDEs.
- Different stage types have different valid options — a single `StageOptions` bag shows properties that don't apply (e.g. `.batchSize` on a SPARQL Anything stage).
- The three-step boilerplate (`readQueryFile` / `new SparqlConstructExecutor` / `new Stage`) is repeated everywhere.

### Builder without callback (explicit .build())

```typescript
construct('per-class-props')
  .select('...')
  .query('queries/class-property-datatypes.rq')
  .batchSize(20)
  .build();
```

Same typed entry points as the callback approach, but the builder leaks into the `stages` array type (`Stage | StageBuilder | Promise<Stage>`) unless every stage ends with `.build()`. The callback pattern calls `.build()` internally, keeping the array typed as `Stage | Promise<Stage>` and catching half-configured builders at compile time.

## Consequences

- `construct()` and `chain()` are the primary built-in stage factories, exported as standalone functions from `@lde/pipeline`. The `Stage` constructor remains available for the YAML factory and for pre-built stages from library code.
- Built-in and third-party stage types follow the same pattern: standalone functions that accept a name and a typed callback builder, returning `Stage`. No asymmetry.
- `Promise<Stage>` in the stages array means factory functions don't need `await` at the call site.
- Each stage type has its own builder class (e.g. `ConstructStageBuilder`). These are additional types to maintain, but they're thin: accumulate arguments and call the `Stage` constructor.
