# SPARQL Construct Executor Design

## Context

Two existing implementations with duplicated logic:

| Package              | Class                 | Returns                              | Use Case      |
| -------------------- | --------------------- | ------------------------------------ | ------------- |
| `@lde/pipeline`      | `SparqlQuery`         | Stream of quads                      | Pipeline step |
| `@lde/pipeline-void` | `SparqlQueryAnalyzer` | `Success \| Failure \| NotSupported` | VOiD analysis |

Both implement similar template substitution logic (`?dataset`, `FROM <graph>`, and caller-side `#subjectFilter#`).

## Design Principles

### 1. Streaming by Default

The base component always streams quads.

**Rationale**:

- Streaming is memory-efficient for large results
- `Success | Failure | NotSupported` semantics require full consumption anyway

### 2. Composition over Inheritance

Components are composed via wrappers, not inheritance hierarchies.

```
┌───────────────────────────────────────┐
│  SparqlConstructExecutor              │
│  - CONSTRUCT query with templates     │
│  - Returns QuadStream                 │
└─────────────────┬─────────────────────┘
                  │
    ┌─────────────┼─────────────────────┐
    ▼             ▼                     ▼
┌────────┐  ┌──────────────┐  ┌──────────────────┐
│SparqlQu│  │ createQuery  │  │ createPerClass   │
│ery step│  │ Stage()      │  │ Stage()          │
│        │  │              │  │                  │
│ Stream │  │ → Stage      │  │ → Stage          │
└────────┘  └──────────────┘  └──────────────────┘
```

### 3. Future-Proof for LD Workbench

The design accommodates LD Workbench's iterator pattern. The `bindings` option in `execute()` enables iteration over resources via VALUES clause injection — used by `Stage` with a `SparqlSelector` to bind variables per batch.

## Phase 1 Components (Implemented)

### SparqlConstructExecutor

**File:** `packages/pipeline/src/sparql/executor.ts`

Standalone component that executes a SPARQL CONSTRUCT query and streams quads. Can be used independently or wrapped for pipeline/analyzer contexts.

```typescript
interface Executor {
  execute(
    dataset: Dataset,
    distribution: Distribution,
    options?: ExecuteOptions,
  ): Promise<AsyncIterable<Quad> | NotSupported>;
}

interface ExecuteOptions {
  bindings?: VariableBindings[]; // VALUES clause injection
}

type VariableBindings = Record<string, NamedNode>;

class SparqlConstructExecutor implements Executor {
  constructor(options: {
    query: string;
    timeout?: number; // Default: 300_000 (5 minutes)
    fetcher?: SparqlEndpointFetcher;
  });

  execute(
    dataset: Dataset,
    distribution: Distribution,
    options?: ExecuteOptions,
  ): Promise<QuadStream>;

  static fromFile(
    filename: string,
    options?: Omit<SparqlConstructExecutorOptions, 'query'>,
  ): Promise<SparqlConstructExecutor>;
}
```

**Query transformations** (applied in order):

1. `FROM <graph>` — injected via AST manipulation (`withDefaultGraph`) if the distribution has a named graph
2. `VALUES` — injected via AST manipulation (`injectValues`) if `bindings` are provided
3. `?dataset` — string replacement with the dataset IRI

**Note:** `#subjectFilter#` is NOT handled by the executor — it's pre-processed by callers (e.g. `createQueryStage()`, `createPerClassStage()` in `pipeline-void`).

**Consumers:**

- `SparqlQuery` step (wraps executor for pipeline `DataEmittingStep` interface)
- `createQueryStage()` in `pipeline-void` (wraps executor in a `Stage`)
- `createDatatypeStage()`, `createLanguageStage()`, `createObjectClassStage()` in `pipeline-void` (compose with selector + executor in a `Stage`)

### withDefaultGraph()

**File:** `packages/pipeline/src/sparql/graph.ts`

Utility function to inject a `FROM <graph>` clause into a parsed CONSTRUCT query via AST manipulation. Used by the executor when a distribution has a named graph.

```typescript
function withDefaultGraph(query: ConstructQuery, graphIri: string): void;
```

### SparqlQuery Step

**File:** `packages/pipeline/src/step/sparqlQuery.ts`

Wraps `SparqlConstructExecutor` to provide the `DataEmittingStep` interface for use in pipelines.

### createQueryStage()

**File:** `packages/pipeline-void/src/sparqlQueryAnalyzer.ts`

Factory function that creates a `Stage` wrapping a `SparqlConstructExecutor` for a given query file and distribution. Returns a `Stage` that can be run against a dataset.

```typescript
async function createQueryStage(
  filename: string,
  distribution: Distribution,
): Promise<Stage>;
```

### Per-Class Stage Factories

**File:** `packages/pipeline-void/src/perClassAnalyzer.ts`

Factory functions that create `Stage` instances with a `SparqlSelector` (for class iteration) and a `SparqlConstructExecutor` (for the CONSTRUCT phase). Each function binds to a specific query file:

```typescript
function createDatatypeStage(distribution: Distribution): Promise<Stage>;
function createLanguageStage(distribution: Distribution): Promise<Stage>;
function createObjectClassStage(distribution: Distribution): Promise<Stage>;
```

These replace the former `PerClassAnalyzer` class and its subclasses (`DatatypeAnalyzer`, `LanguageAnalyzer`, `ObjectClassAnalyzer`).

## Phase 2 Components (LD Workbench Migration)

### Conceptual Model

The pipeline is built from five concepts:

| Concept             | What it does                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Selector**        | Produces items to iterate over (datasets, resources, classes, ...). Required at the outer level; optional at the stage level. |
| **Query**           | SPARQL CONSTRUCT. Produces quads. Uses bindings from outer selectors via VALUES.                                              |
| **Transformer**     | `AsyncIterable<Quad> → AsyncIterable<Quad>`. Decorates a query's output.                                                      |
| **Writer**          | Consumes quads (file, SPARQL store).                                                                                          |
| **Source Resolver** | Prerequisite: prepares the data source for the query engine. Outside the select/query model.                                  |

A **Stage** has an optional Selector and one or more Queries:

```
Stage = Selector? → Query[]
```

The core pattern is **select things, process each** — the same at every level. Dataset selection (outer loop) and binding selection (inner loop) are both Selectors. The difference is configuration, not type.

**Note on Selector shape:** dataset selection and binding selection share the pattern but differ in structure. The dataset selector returns rich objects (`Dataset` with IRI, distributions, metadata) that establish context for all stages — which endpoint to query, which IRI to bind `?dataset` to, which source to resolve. The binding selector returns `NamedNode` URIs that go directly into a CONSTRUCT query via VALUES. The conceptual unity ("iterate over selected items") is an analogy, not an identity — the implementation will have different Selector interfaces for each level. The value is in the shared mental model, not in a single generic `Selector<T>` abstraction.

| Configuration   | Selector             | Query                            | Example                   |
| --------------- | -------------------- | -------------------------------- | ------------------------- |
| Aggregate       | None                 | Single CONSTRUCT over full graph | DKG VOiD statistics       |
| Per-class       | Classes via SELECT   | CONSTRUCT per class              | DKG `PerClassAnalyzer`    |
| Per-resource    | Resources via SELECT | CONSTRUCT per batch              | LD Workbench stages       |
| SPARQL Anything | Optional             | CONSTRUCT over virtual RDF graph | Non-RDF to RDF conversion |

The **outer selector** (dataset level) is always required. A `RegistrySelector` takes a SPARQL CONSTRUCT query (required) and a registry endpoint (optional, defaults to the NDE registry). The query returns the full dataset+distribution graph — not just dataset URIs — so the pipeline has all the metadata it needs for distribution resolution (which distributions to probe, which media types are available, etc.).

DKG's current selection query (`queries/selection/dataset-with-rdf-distribution.rq`) is a CONSTRUCT that returns `dcat:Dataset` and `dcat:Distribution` triples, filtered for RDF-compatible media types, with exclusions for invalid registrations and unreliable endpoints. The `RegistrySelector` parses the CONSTRUCT result into `Dataset` objects with their distributions.

```typescript
// DKG: all RDF datasets with distribution metadata
new RegistrySelector(
  await readQueryFile('queries/selection/dataset-with-rdf-distribution.rq'),
);

// Single dataset (filter in the WHERE clause)
new RegistrySelector(`
  CONSTRUCT { ?dataset a dcat:Dataset ; dcat:distribution ?dist . ?dist ... }
  WHERE { VALUES ?dataset { <https://example.org/dataset/1> } ... }
`);

// Custom registry endpoint
new RegistrySelector(query, 'https://other-registry.example/sparql');
```

This keeps the pipeline structure uniform — `Selector → Stage[]` — with no special code paths. Source resolution (probing distributions, finding the SPARQL endpoint or importing a dump) is the same regardless of how many datasets are selected.

At the **stage level**, the selector is optional. A stage without a Selector runs its query once against the full graph (aggregate). A stage with a Selector iterates: the Selector produces `$this` bindings, the Query uses them via VALUES. The `$this` variable can represent anything — resources, classes, named graphs — the Query defines the semantics.

#### Distribution Resolution

Source resolution prepares a queryable SPARQL endpoint for stages to execute against. It's kept outside the select/query model because it depends on infrastructure (what endpoints exist, whether an import is needed), not on the processing pattern.

Resolution happens at two levels:

| Context           | When                   | Input                                      | Output                                                       |
| ----------------- | ---------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| **Dataset-level** | Before stages run      | `Dataset` with distributions from registry | `ResolvedDistribution` with SPARQL endpoint URL              |
| **Stage-level**   | Between chained stages | Previous stage's output file               | `ResolvedDistribution` with file path or SPARQL endpoint URL |

##### Dataset-Level Resolution

The outer selector (`RegistrySelector`) returns `Dataset` objects with their `Distribution`s — access URLs, media types, named graphs, subject filters. The source resolver probes these distributions and determines how to make the data queryable:

```
┌──────────────────────────────────────────────────────────┐
│  DistributionResolver.resolve(dataset)                          │
│                                                           │
│  1. Probe all distributions in parallel                   │
│     - SPARQL endpoints: SELECT * { ?s ?p ?o } LIMIT 1    │
│     - Data dumps: HEAD request for metadata               │
│                                                           │
│  2. If valid SPARQL endpoint found → use it               │
│     Return { endpoint, namedGraph?, subjectFilter? }      │
│                                                           │
│  3. If no endpoint but downloadable dump available:       │
│     a. Download via cached downloader                     │
│     b. Import into local SPARQL store (e.g. Qlever)      │
│     c. Return { endpoint: localStoreUrl }                 │
│                                                           │
│  4. If nothing works → NotAvailable                       │
│     Pipeline skips this dataset                           │
└──────────────────────────────────────────────────────────┘
```

```typescript
interface DistributionResolver {
  resolve(dataset: Dataset): Promise<ResolvedDistribution | NotAvailable>;
}

interface ResolvedDistribution {
  endpoint: URL;
  namedGraph?: string;
  subjectFilter?: string;
}
```

The `Importer` interface (`@lde/sparql-importer`) handles step 3 — it takes a `Dataset`, selects a downloadable distribution, imports it, and returns an endpoint URL. Existing implementation: `@lde/sparql-qlever` (indexes via Qlever). The resolver composes with any importer:

```typescript
class SparqlDistributionResolver implements DistributionResolver {
  constructor(private importer?: Importer);

  async resolve(dataset: Dataset): Promise<ResolvedDistribution | NotAvailable> {
    const probeResults = await probeAll(dataset.distributions);

    const sparql = probeResults.find((r) => r.type === 'sparql' && r.isValid);
    if (sparql) {
      return {
        endpoint: sparql.accessUrl,
        namedGraph: sparql.namedGraph,
        subjectFilter: sparql.subjectFilter,
      };
    }

    if (this.importer) {
      const result = await this.importer.import(dataset);
      if (result instanceof ImportSuccessful) {
        return { endpoint: result.endpoint };
      }
    }

    return new NotAvailable(dataset);
  }
}
```

**Splitting `DistributionAnalyzer`'s dual role.** The current DKG `DistributionAnalyzer` conflates two concerns: resolution (finding/creating an endpoint) and reporting (emitting `schema:Action` quads about what was probed). In Phase 2, these split:

- **`DistributionResolver`** — pure resolution: returns a `ResolvedDistribution` or `NoDistributionAvailable`. No quads.
- **Probe reporting** — an [executor decorator](#executor-decorators) that emits `schema:Action` triples about probe results (which distributions were tested, HTTP status codes, errors). Applied by the pipeline orchestrator as a cross-cutting concern, similar to `provenancePlugin()`.

##### Stage-Level Resolution (Chained Pipelines)

In LD Workbench-style chained pipelines, each stage's output becomes the next stage's input. LD Workbench handles this by materialising to N-Triples files on disk — if a stage's iterator has no explicit endpoint, it queries the previous stage's output file. Small files are queried directly with Comunica's file engine; large files are uploaded to a SPARQL store via Graph Store Protocol (`importTo`).

LDE follows the same pattern. The pipeline orchestrator resolves inter-stage sources automatically:

```typescript
// Pipeline orchestration pseudocode
const datasetSource = await sourceResolver.resolve(dataset);

for (const [i, stage] of stages.entries()) {
  const source =
    i === 0
      ? datasetSource
      : await stageDistributionResolver.resolve(stages[i - 1].outputPath);

  dataset.addDistribution(
    Distribution.sparql(source.endpoint, source.namedGraph),
  );
  await stage.run(dataset, distribution, writer);
}
```

For the first stage, the source comes from the dataset-level resolver. For subsequent stages:

1. **Small output** (default): query the file directly with Comunica's file engine
2. **Large output** (configured via `importTo`): upload to a SPARQL store, query that

The resolved source is added to the `Dataset` as a distribution, so `Stage.run(dataset, distribution, writer)` keeps its three-argument signature. The `SparqlConstructExecutor` reads the endpoint from the distribution — it doesn't know or care whether the endpoint is remote, locally imported, or a previous stage's output.

##### Query Engine Variants

Different query engines need different resolution strategies:

| Query engine                                   | Source                        | Resolution                                 |
| ---------------------------------------------- | ----------------------------- | ------------------------------------------ |
| SPARQL endpoint                                | Remote endpoint URL           | Probe distributions, import dump if needed |
| Comunica file                                  | Local RDF file                | Previous stage output, or downloaded file  |
| [SPARQL Anything](https://sparql-anything.cc/) | Non-RDF file (CSV, JSON, XML) | Locate/download the file                   |

For now, only the SPARQL endpoint resolver is needed (DKG and LD Workbench both query SPARQL endpoints). Comunica file and SPARQL Anything resolvers can be added later as implementations of the same `DistributionResolver` interface.

#### SPARQL Anything as Executor

[SPARQL Anything](https://sparql-anything.cc/) converts non-RDF data (CSV, JSON, XML) to RDF using SPARQL CONSTRUCT queries. It fits the unified model without new concepts — it's just a different executor implementation that uses the SPARQL Anything engine instead of a SPARQL endpoint:

```typescript
// SPARQL Anything: convert CSV to RDF
new Stage({
  name: 'csv-to-rdf',
  executors: new SparqlAnythingExecutor('queries/csv-transform.rq'),
});

// Can also have a selector for iterating
new Stage({
  name: 'per-file-conversion',
  selector: new SparqlSelector('SELECT $this WHERE { ... }'),
  executors: new SparqlAnythingExecutor('queries/transform.rq'),
});
```

`SparqlAnythingExecutor` implements the same interface as `SparqlConstructExecutor` (returns `AsyncIterable<Quad>`). The `Stage` doesn't care which engine produces the quads — the same composition (selector, transformers, writer, `Promise.race` concurrency) works for all executor types. No new stage type needed.

##### Implementation: CLI over Server

SPARQL Anything is a Java/Jena project. There are no Node.js bindings — the available language bindings are Java (native) and Python ([PySPARQL-Anything](https://github.com/SPARQL-Anything/PySPARQL-Anything)). It can run as an embedded Fuseki HTTP server or as a CLI.

**`SparqlAnythingExecutor` uses the CLI** (spawning `java -jar sparql-anything.jar` per query) rather than a long-running server:

- **No lifecycle management** — each invocation is isolated, no startup/shutdown orchestration or readiness checks
- **Trivial parallelism** — spawn N processes, no port allocation or conflicts
- **Observable** — stderr gives errors directly, exit code signals success/failure
- **Fits the pipeline model** — it's a pure transform: query in, quads out on stdout

The server mode would require managing a JVM process lifecycle, allocating ports, and health-checking — complexity that buys nothing when each query is independent.

```typescript
class SparqlAnythingExecutor implements Executor {
  constructor(private query: string) {}

  async *execute(): AsyncIterable<Quad> {
    const proc = execFile('java', [
      '-jar',
      'sparql-anything.jar',
      '-q',
      this.query,
      '-f',
      'ntriples',
    ]);
    // Parse N-Triples from stdout with N3.js StreamParser
    yield* parseStream(proc.stdout);
  }
}
```

The main trade-off is JVM cold-start time (~1–2s per invocation), but this is negligible in practice: queries overlap when running in parallel via `Stage`'s `Promise.race` concurrency, and the query execution time dominates anyway.

#### Nesting and Chaining

The model supports two composition axes:

**Nesting** — selectors within selectors, bindings propagate inward. Used when processing requires grouping at multiple levels:

```
-- DKG: outer selector (datasets) + inner selector (bindings)
Selector (datasets from registry)
  → Selector ($this: classes)
    → Query (CONSTRUCT per class per dataset)

-- Future: per-class per-graph
Selector ($graph: named graphs)
  → Selector ($this: classes within $graph)
    → Query (CONSTRUCT using both $graph and $this)
```

**Chaining** — stage output becomes next stage's input, sequentially. Used when one stage's output needs further processing by a different query:

```
Stage 1: Selector ($this from endpoint A) → Query → write to file
Stage 2: Selector ($this from stage 1 output) → Query → write to file
```

Chaining materialises intermediate results between stages (to file or SPARQL store). This is good for transparency (each stage's output is inspectable) and resumability, but large outputs need to be loaded into a SPARQL store for the next stage to query efficiently (see [Stage materialisation](#stage-materialisation)).

#### How DKG and LD Workbench Fit

Both DKG and LD Workbench map to the same model — the difference is which features each uses:

```
-- DKG: nesting (outer dataset selector, inner binding selector)
RegistrySelector (datasets from registry)     ← outer selector
  → Source Resolver (probe, import if needed)
  → Stage (no selector) → Query              ← aggregate (VOiD statistics)
  → Stage (select $this: classes) → Query    ← iterating (per-class analysis)

-- LD Workbench: chaining (sequential stages, single dataset from registry)
RegistrySelector (single dataset by URI)      ← outer selector
  → Source Resolver (probe distributions)
  → Stage 1: Selector ($this from endpoint) → Query → write to file
  → Stage 2: Selector ($this from stage 1 output) → Query → write to file
    └─ final output: merge all stage files
```

DKG uses **nesting** (datasets → bindings) but no chaining (stages are independent per dataset). LD Workbench uses **chaining** (stage output → next stage input) with the registry selector narrowed to a single dataset. Both follow the same `Selector → Stage[]` structure.

**Implementation scope:** limit nesting to two levels for now (dataset selector → binding selector). Deeper nesting (per-class-per-graph) can be added later without architectural changes — the model supports it, but the implementation doesn't need to handle it yet.

#### Implementation Components

The conceptual model maps to three concrete components:

- **`DistributionResolver`** — prerequisite: probes distributions and prepares a queryable SPARQL endpoint. See [Distribution Resolution](#distribution-resolution) for the interface and algorithm.
- **`SparqlConstructExecutor`** — low-level CONSTRUCT query engine. Can be used standalone (aggregate) or composed inside a Stage (iterating). Handles template substitution, streaming, timeout.
- **`Stage`** — composes an optional `SparqlSelector` with one or more executors and a `Writer`. Without a selector, runs each executor once (aggregate). With a selector, iterates: paginated SELECT → CONSTRUCT per batch via VALUES. See [Stage](#stage) for the full class definition.

Stage is not an Executor — it orchestrates executors. Executor is the unit of query execution; Stage is the unit of pipeline composition.

Note: aggregate and iterating CONSTRUCT queries have different semantics at the implementation level. Aggregate queries use dataset-level template substitutions (`#subjectFilter#`, `#namedGraph#`, `?dataset`). Iterating queries inject `$this` bindings via a VALUES clause. An aggregate CONSTRUCT query has no `$this` variable and would break if a VALUES clause were injected. The conceptual model treats these as configurations of the same concept; the `Stage` implementation branches on whether a selector is present.

### Executor Decorators

`SparqlConstructExecutor` returns `AsyncIterable<Quad>`. Rather than collecting results into a Store and passing them through decorator classes (the Phase 1 `Analyzer` pattern), output is enriched by **executor decorators**: classes that implement the `Executor` interface and wrap an inner executor, observing its quads and appending additional triples.

Executor decorators receive the `Dataset` at execute time, so they naturally work in multi-dataset pipelines without needing a separate `datasetIri` parameter.

Decorators compose at two levels:

**Per-executor decorators** wrap a specific executor, returning a new executor with the same interface. The decorator only sees that executor's quads:

```typescript
// DKG: vocabulary detection wraps the entity-properties executor
new Stage({
  name: 'entity-properties',
  executors: new VocabularyExecutor(
    await SparqlConstructExecutor.fromFile('queries/entity-properties.rq'),
  ),
});

// No decorator needed: quads stream through directly to writer
new Stage({
  name: 'classes',
  executors: await SparqlConstructExecutor.fromFile('queries/classes.rq'),
});
```

A decorator wraps an inner executor by implementing the `Executor` interface:

```typescript
class VocabularyExecutor implements Executor {
  constructor(private readonly inner: Executor) {}

  async execute(dataset, distribution, options) {
    const result = await this.inner.execute(dataset, distribution, options);
    if (result instanceof NotSupported) return result;
    return withVocabularies(result, dataset.iri.toString());
  }
}
```

The `Stage` just sees executors — some plain, some decorated. No `transformers` array needed on `Stage`.

**Cross-cutting concerns** are applied by the pipeline via plugins. The stage doesn't know about them:

```typescript
import { provenancePlugin } from '@lde/pipeline';

new Pipeline({
  plugins: [provenancePlugin()],
  // ...
});
```

No Store materialisation on the main path — plugins observe specific values as quads stream through and append additional triples at the end.

This replaces the former `Analyzer` interface and decorator classes. `collect()` is removed — there is no reason to materialise into a Store when everything streams.

#### Dropping the Analyzer Terminology (Done)

The distinction between "analyzers" (collect into Store, return `Success | Failure | NotSupported`) and "pipeline steps" (stream quads to a writer) is gone. Analysis is just another transformation — CONSTRUCT query in, quads out. The executor doesn't know whether its output will be used for VOiD statistics or data reshaping. What happens to the quads is the consumer's concern.

Former classes and their replacements:

- `SparqlQueryAnalyzer` → `createQueryStage()` function
- `PerClassAnalyzer`, `DatatypeAnalyzer`, `ObjectClassAnalyzer`, `LanguageAnalyzer` → `createDatatypeStage()`, `createLanguageStage()`, `createObjectClassStage()` functions
- `VocabularyAnalyzer` → `VocabularyExecutor` executor decorator
- `withProvenance()` → `provenancePlugin()` pipeline plugin (in `@lde/pipeline`)
- The `Analyzer` interface is replaced by: `NotSupported` comes from the executor, `Failure` vs `Success` is just "did the stream produce any quads?"

#### DKG Can Drop the Store

Analysis of the [dataset-knowledge-graph](https://github.com/netwerk-digitaal-erfgoed/dataset-knowledge-graph) pipeline shows that the N3 Store can be removed from the main path. Almost all operations are streaming-compatible:

- ~~`VocabularyAnalyzer`: iterates with `for...of`, observes property URIs~~ (done: `VocabularyExecutor` executor decorator)
- `UriSpaceAnalyzer`: iterates with `for...of`, builds a Map → executor decorator
- ~~`withProvenance`: appends 5 fixed triples, doesn't read input~~ → `provenancePlugin()` pipeline plugin (done)
- `pipeline.ts` `store.size > 0` check → replace with a boolean flag
- `FileWriter` `[...summary]` spread → iterate instead

**One blocker**: `DistributionAnalyzer` uses `store.match()` to find a previously-created blank node by predicate/object and attach an error message to it. This is refactorable: track `Map<downloadUrl, BlankNode>` internally instead of querying the Store. The [Distribution Resolution](#distribution-resolution) design addresses this by splitting `DistributionAnalyzer` into a pure `DistributionResolver` and a probe-reporting stream transformer.

#### LD Workbench Streaming Model

LD Workbench streams **within each stage** (quads flow from CONSTRUCT query result → N3 Writer → WriteStream on disk) but **materialises between stages** (each stage writes to an N-Triples file, the next stage queries that file). Stages run sequentially — stage N must complete before stage N+1 starts, because Comunica needs to index/query the output file. See [Stage materialisation](#stage-materialisation) for how LDE handles large inter-stage outputs.

#### Orchestration

Pipeline orchestration (running stages, managing the dataset loop, error handling, retries) stays in-process. External orchestrators like Apache Airflow could replace the inter-stage orchestration but not the intra-stage streaming (per-quad backpressure, bounded channels). Airflow also adds disproportionate infrastructure (Python runtime, scheduler, web server, metadata database) for what is currently a sequential loop. If orchestration grows to need scheduling, monitoring, and retry infrastructure at scale, a Node.js-native solution like BullMQ is a better fit given the TypeScript ecosystem.

#### Configuration

> **Superseded:** The configuration design has moved to a dedicated document. See **[Pipeline Configuration Design](pipeline-configuration-design.md)** for the full design.
>
> Key changes from the c12-based approach originally described here:
>
> - **c12 is replaced** — TypeScript configs are loaded via direct `import()`, YAML configs via a simple loader. c12's config discovery, `extends`, and environment overrides added complexity without matching our two-audience model.
> - **Two first-class paths** — CDK-style TypeScript for developers (real objects, static factories) and YAML for ops/Docker (pure data, no `node_modules`). Previously both paths used the same raw `defineConfig()` shape.
> - **Zod as source of truth** — a Zod schema drives runtime validation, TypeScript types (`z.infer<>`), and JSON Schema generation for YAML autocompletion. Replaces the hand-written `RawPipelineConfig` interface and manual validation in `normalizeConfig()`.
> - **`defineConfig()` removed** — TypeScript users construct objects directly; YAML users get autocompletion via JSON Schema.

**YAML support:** YAML config files work out of the box for pipelines using built-in executors (all stages reference `.rq` query files resolved to `SparqlConstructExecutor`s). This covers most LD Workbench replacement use cases. Custom executors (like DKG's `withUriSpace`) require TypeScript config since YAML can only contain plain data. See [Pipeline Configuration Design](pipeline-configuration-design.md) for the full two-path design.

### Stage

Composes an optional `SparqlSelector` with one or more executors and a `Writer`. Without a selector, runs each executor once against the full graph (aggregate). With a selector, iterates over bindings.

```typescript
interface StageOptions {
  name: string;

  // CONSTRUCT query/queries executed per batch (or once if no selector).
  executors: Executor | Executor[];

  // Optional SELECT query that returns bindings to process.
  // Omit for aggregate stages.
  selector?: StageSelector;

  // URIs per CONSTRUCT query VALUES clause (only used with selector).
  batchSize?: number; // Default: 10
}

class Stage {
  readonly name: string;

  constructor(options: StageOptions);

  // Runs the stage, writing output to the writer.
  // Returns NotSupported if the executor signals it.
  async run(
    dataset: Dataset,
    distribution: Distribution,
    writer: Writer,
  ): Promise<NotSupported | void>;
}
```

**Execution flow**:

```
┌─────────────────────────────────────────────────────────────┐
│  1. Run selector query with pagination                      │
│     SELECT $this WHERE { $this a schema:Thing }             │
│     LIMIT 10 OFFSET 0                                       │
└─────────────────────────┬───────────────────────────────────┘
                          │ yields URIs: [uri1, uri2, ..., uri10]
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Batch URIs and execute CONSTRUCT with VALUES            │
│     CONSTRUCT { $this ?p ?o } WHERE {                       │
│       VALUES $this { <uri1> <uri2> ... <uri10> }            │
│       $this ?p ?o                                           │
│     }                                                       │
└─────────────────────────┬───────────────────────────────────┘
                          │ streams quads
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Repeat until selector exhausted                         │
│     LIMIT 10 OFFSET 10, OFFSET 20, ...                      │
└─────────────────────────────────────────────────────────────┘
```

### Selector and Executor: Separated Concerns

Selection and execution are decoupled. The **selector** yields individual binding rows; the **executor** decides how to batch and inject them into CONSTRUCT queries. This separation means:

- The selector's page size (LIMIT/OFFSET for SPARQL pagination) is independent of the executor's batch size (VALUES clause grouping).
- Consumers iterate binding rows directly — pagination is an internal detail of the selector implementation.

#### StageSelector Interface

`StageSelector` is an `AsyncIterable<StageSelectorBindings>`. Consumers iterate it directly with `for await`:

```typescript
interface StageSelector extends AsyncIterable<StageSelectorBindings> {}

type StageSelectorBindings = Record<string, NamedNode>;
```

The selector yields all projected variables per row (NamedNode values only). For example, `SELECT ?class ?property WHERE { ... }` yields `{ class: NamedNode, property: NamedNode }` rows.

#### SparqlSelector (Implemented)

SPARQL-based selector using `sparqljs` for AST manipulation and `SparqlEndpointFetcher` for querying:

```typescript
class SparqlSelector implements StageSelector {
  constructor(options: {
    query: string; // SELECT query projecting named variables
    endpoint: URL; // SPARQL endpoint
    pageSize?: number; // Overrides query LIMIT; default: query LIMIT or 10
    fetcher?: SparqlEndpointFetcher;
  });

  async *[Symbol.asyncIterator](): AsyncIterableIterator<StageSelectorBindings>;
}
```

- Parses the SELECT query via `sparqljs` and manipulates LIMIT/OFFSET on the AST
- A LIMIT in the query sets the default page size (like LD Workbench); `pageSize` option overrides it
- Validates: must be SELECT (not CONSTRUCT), must project named variables (not `SELECT *`)

#### Pagination (Selector Concern)

- Uses SPARQL LIMIT/OFFSET for pagination
- Stops when a page returns fewer results than `pageSize`
- Large OFFSET values can be slow on some endpoints; prefer multiple stages with filtered selectors

#### Batching with VALUES Clause (Executor Concern)

The executor groups binding rows into VALUES clauses for CONSTRUCT queries. The batch size is configured on the executor/stage, not the selector:

```sparql
-- Without batching (N queries):
CONSTRUCT { <uri1> ?p ?o } WHERE { <uri1> ?p ?o }
CONSTRUCT { <uri2> ?p ?o } WHERE { <uri2> ?p ?o }
...

-- With batching (1 query, multi-variable):
CONSTRUCT { ?class ?p ?o } WHERE {
  VALUES (?class ?property) { (<Person> <name>) (<Person> <age>) }
  ?class ?p ?o
}
```

**Implementation**:

```typescript
function withValuesBatch(
  query: ConstructQuery, // Parsed SPARQL query
  variable: string, // Variable to bind (e.g., "$this")
  values: NamedNode[], // URIs to batch
): ConstructQuery {
  // Prepend VALUES clause to WHERE patterns
  return {
    ...query,
    where: [
      {
        type: 'values',
        values: values.map((uri) => ({ [variable]: uri })),
      },
      ...query.where,
    ],
  };
}
```

### Multi-Stage Pipelines

[LD Workbench](https://github.com/netwerk-digitaal-erfgoed/ld-workbench) supports chaining stages where the output of one stage becomes the input to the next.

```yaml
# LD Workbench configuration example
stages:
  - name: extract-persons
    iterator:
      query: SELECT $this WHERE { $this a schema:Person }
      endpoint: http://source.example/sparql
    generator:
      - query: file://queries/person.rq

  - name: enrich-persons
    iterator:
      query: SELECT $this WHERE { $this a schema:Person }
      # No endpoint = uses previous stage output
    generator:
      - query: file://queries/enrich.rq
        endpoint: http://enrichment.example/sparql
```

#### Stage materialisation

LD Workbench materialises each stage's output to an N-Triples file on disk. The next stage queries this file using Comunica's file query engine. This is good for **transparency** (each stage's output is inspectable) and **resumability** (a pipeline can restart from any stage).

However, file-based querying breaks down for large outputs. Comunica's file engine loads the entire file into memory to query it, which is impractical for millions of triples. For large inter-stage datasets, the output needs to be loaded into a SPARQL store (e.g. Qlever, Oxigraph) that can be queried efficiently. LD Workbench already supports this via `importTo`, which uploads the file to a Graph Store Protocol endpoint before querying.

LDE should follow the same pattern: materialise to file by default for transparency, but support loading into a SPARQL store for stages that produce large outputs.

**LDE equivalent** (potential design):

```typescript
const pipeline = new Pipeline({
  stages: [
    new Stage({
      name: 'extract-persons',
      selector: new SparqlSelector(
        'SELECT $this WHERE { $this a schema:Person }',
      ),
      executors: SparqlConstructExecutor.fromFile('queries/person.rq'),
    }),
    new Stage({
      name: 'enrich-persons',
      selector: new SparqlSelector(
        'SELECT $this WHERE { $this a schema:Person }',
      ),
      executors: SparqlConstructExecutor.fromFile('queries/enrich.rq'),
    }),
  ],
});
```

### Composition Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                           Stage                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  SparqlSelector (optional)                               │  │
│  │  - SELECT $this WHERE { ... }                              │  │
│  │  - Omitted for aggregate stages                            │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
│                             │ URIs (or skip if aggregate)        │
│                             ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Executor(s) — run concurrently (Promise.race)              │  │
│  │                                                             │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │ SparqlConstructExecutor (plain)                      │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │ VocabularyExecutor(SparqlConstructExecutor) (wrapped) │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
│                             │ Quads (enriched if wrapped)        │
│                             ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Writer                                                     │  │
│  │  - File, SPARQL store, ...                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Refactoring PerClassAnalyzer (Done)

`PerClassAnalyzer` has been replaced by factory functions (`createDatatypeStage()`, `createLanguageStage()`, `createObjectClassStage()`) that compose a `SparqlSelector` with a `SparqlConstructExecutor` inside a `Stage`:

```typescript
// Implemented: Stage with selector handles both phases

new Stage({
  name: 'per-class-properties',
  selector: new SparqlSelector('SELECT DISTINCT $this WHERE { ?s a $this }'),
  executors: SparqlConstructExecutor.fromFile(
    'queries/class-property-datatypes.rq',
  ),
});
```

This also requires changing the `<#class#>` template variable to a proper SPARQL variable ?class.

### Terminology

| LD Workbench | LDE                       | Description                                       |
| ------------ | ------------------------- | ------------------------------------------------- |
| Iterator     | `SparqlSelector`          | SELECT query that finds resources to process      |
| Generator    | `SparqlConstructExecutor` | CONSTRUCT query that transforms each resource     |
| Stage        | `Stage`                   | Composes optional selector + executor(s) + writer |
| Pipeline     | `Pipeline`                | Multiple stages chained together                  |

**Rationale for terminology changes**:

- "Iterator" in CS typically means traversing without transformation; "Selector" describes selecting resources
- "Generator" in JS/Python means lazy-yielding functions; "Executor" describes executing queries
- "Stage" is the same term, but now a concrete class that composes selector, executors, and writer

### Architecture: Smart Orchestrator, Focused Components

The most fundamental difference between LD Workbench and LDE is where control lives.

#### LD Workbench: autonomous components, event-driven coordination

In LD Workbench, Iterator, Generator, and Stage are all independent `EventEmitter` subclasses. Each component manages its own lifecycle:

```
LD Workbench:
  Iterator (EventEmitter)  ──emit('data', $this)──▶  Generator (EventEmitter)
       │                                                   │
       └──emit('iteratorResult')──▶ Stage ◀──emit('generatorResult')──┘
```

The Iterator fetches SELECT pages on its own schedule and emits URIs. Generators listen for those events and run CONSTRUCT queries independently. Stage is a wiring harness — it connects event listeners, tracks completion with manual bookkeeping (`checkEnd()`, `generatorProcessedCounts`, `iteratorEnded`), and waits for everything to finish. No single component owns the data flow.

This design gives free concurrency: because the Iterator's `async` event handler's returned Promise is never awaited, it keeps fetching pages while Generators are still processing previous URIs. Multiple Generators also receive the same `$this` simultaneously via `Promise.all`. The overlapping of network requests is a real throughput benefit when the bottleneck is endpoint latency.

#### LDE: Stage as orchestrator

In LDE, Stage owns the loop. It async-iterates over the selector, batches the bindings, calls the executors, and feeds quads to the writer:

```
LDE:
  Stage (orchestrator)
    for await (batch of selector)        ← Stage controls pagination
      for (executor of executors)
        for await (quad of executor)     ← Stage controls execution
          writer.write(quad)             ← Stage controls output
```

The subcomponents (SparqlSelector, SparqlConstructExecutor, Writer) are focused: they do one thing when asked and return results. They don't know about each other, don't manage their own lifecycle, and don't emit events. Stage decides _when_ and _how_ to compose them.

#### Comparison

|                          | LD Workbench                                         | LDE                                          |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------- |
| **Control**              | Distributed across components                        | Centralised in Stage                         |
| **Coordination**         | EventEmitter events                                  | `async`/`await` iteration                    |
| **Concurrency**          | Implicit (fire-and-forget events)                    | Explicit (`Promise.race` over a pending set) |
| **Backpressure**         | None — can exhaust memory                            | Built-in — consumer pulls at its own pace    |
| **Composition**          | Manual event wiring                                  | `yield*`, `for await`, pipeline operators    |
| **Error handling**       | Separate `error` event channel                       | Standard `try/catch`                         |
| **Completion**           | Manual bookkeeping flags                             | Loop ends                                    |
| **Progress reporting**   | Components must emit events to report back           | Stage already sees all data — just count it  |
| **Changing concurrency** | Requires rewiring event listeners between components | Stage change only — subcomponents unchanged  |
| **Testability**          | Must mock EventEmitter lifecycle                     | Pure-ish functions over iterables            |

The LDE components aren't "dumb" — SparqlSelector handles pagination, SparqlConstructExecutor handles query templating and streaming. But they're not autonomous. They're focused tools that Stage picks up and uses. This means:

- **Testability** — components are functions over iterables, easy to test in isolation without event wiring
- **Flexibility** — changing the concurrency strategy (sequential → `Promise.race` → bounded queue) is a Stage change, not a rewrite of every component
- **Observability** — Stage sees every element and every quad pass through, so progress reporting falls out naturally (see [CLI Progress Reporting](#cli-progress-reporting))

The LD Workbench approach made sense when the components needed to run independently. But `async`/`await` with `Promise.race` gives the same throughput benefit (overlapping network requests) while keeping control in one place.

#### Multiple generators per stage

LD Workbench supports multiple generators per stage, each receiving the same `$this` URIs. With EventEmitter this is implicit (all generators listen to the same event); each generator also manages its own batch size independently.

In practice, generators almost always query the same endpoint as the iterator (generator defaults to the iterator's endpoint when none is configured). Per-generator batch sizes only matter when generators hit different endpoints with different performance characteristics, which is rare.

With AsyncIterable, fan-out is explicit but straightforward. `Stage` accepts one or more executors directly:

```typescript
// Stage with two executors against different endpoints
new Stage({
  name: 'extract',
  selector: new SparqlSelector('SELECT $this WHERE { ... }'),
  executors: [
    SparqlConstructExecutor.fromFile('queries/extract-b.rq'), // endpoint B
    SparqlConstructExecutor.fromFile('queries/extract-c.rq'), // endpoint C
  ],
});
```

#### Concurrency architecture (Future)

> **Current status:** `Stage.run()` is currently sequential — it collects all executor streams and merges them. The concurrent design below is aspirational; `maxConcurrency` and `delayMs` are not yet implemented.

Without concurrency, `Stage` serialises everything: the selector waits for each executor to finish before fetching the next page. Network idle time between SELECT and CONSTRUCT requests is wasted. With multiple executors against different endpoints, each waits for the others per batch.

The fix is **`Promise.race` over a pending set**. Each executor batch is dispatched as an independent Promise without awaiting it. The selector loop keeps advancing, only pausing when `maxConcurrency` is reached. Since the output always goes to a Writer (file, SPARQL store), quads are written directly inside each async function — no `yield*` needed.

```
Endpoint A (selector):   [page 1] [page 2] [page 3] ...     ← runs ahead
Endpoint B (executor 1): [batch 1·····] [batch 2·····]       ← independent
Endpoint C (executor 2): [batch 1··] [batch 2··] [batch 3··] ← independent
```

All endpoints stay busy: the selector runs ahead because it dispatches without awaiting, and executors against different endpoints run as independent Promises. `maxConcurrency` bounds the total in-flight work to prevent memory exhaustion.

```typescript
class Stage {
  async run(dataset: Dataset, distribution: Distribution, writer: Writer) {
    const pending = new Set<Promise<void>>();

    for await (const batch of this.selector.batches()) {
      for (const executor of this.executors) {
        const p = (async () => {
          const quads = executor.execute(dataset, distribution, {
            bindings: toBatch(batch),
          });
          for await (const quad of quads) {
            writer.addQuad(quad);
          }
        })().finally(() => pending.delete(p));
        pending.add(p);
      }

      if (pending.size >= this.maxConcurrency) {
        await Promise.race(pending); // wait for ANY one to finish
      }
    }

    await Promise.all(pending); // drain remaining work
  }
}
```

Per-executor [decorators](#executor-decorators) work transparently here — they're baked into the executor via wrapping, so `executor.execute()` already returns enriched quads.

**Memory** is bounded by: `maxConcurrency × batchSize × average quads per URI`. The `maxConcurrency` knob controls the total number of in-flight executor batches across all executors.

**Progress reporting** does not require EventEmitter — see [CLI Progress Reporting](#cli-progress-reporting).

### CLI Progress Reporting

LD Workbench displays real-time progress in the terminal using `ora` spinners with per-stage metrics (processed elements, generated quads, duration, memory). LDE adopts the same user experience but with a cleaner implementation that doesn't depend on EventEmitter.

#### What the user sees

```
▶ Starting pipeline "dkg"
✔ Validating pipeline
⠋ Running stage "classes":

  Dataset:            Beeld en Geluid
  Processed elements: 1.2k
  Generated quads:    45.3k
  Duration:           12s
  Memory:             128 MB

✔ Stage "classes" resulted in 45,312 statements for 1,200 elements (took 12s)
⠋ Importing data to SPARQL store

  Statements: 45.3k
  Duration:   3s

✔ Imported 45,312 statements to SPARQL store (took 3s)
✔ Pipeline "dkg" completed in 1m 23s
```

Each stage shows:

- **Spinner** while running, **checkmark** on success, **cross** on failure
- **Live counters** for elements processed, quads generated, elapsed time, and memory
- **Import progress** when writing to a SPARQL store (statements uploaded, duration)
- **Summary line** on completion with totals and elapsed time

#### Design: ProgressReporter interface

Progress reporting is a cross-cutting concern owned by the pipeline orchestrator, not by `Stage` or `Executor`. A `ProgressReporter` interface decouples rendering from the pipeline logic:

```typescript
interface ProgressReporter {
  pipelineStart(name: string): void;
  stageStart(stage: string, dataset: string): void;
  stageProgress(update: StageProgressUpdate): void;
  stageComplete(stage: string, result: StageResult): void;
  stageFail(stage: string, error: Error): void;
  importStart(): void;
  importProgress(statements: number): void;
  importComplete(statements: number, duration: number): void;
  pipelineComplete(duration: number): void;
  pipelineFail(error: Error): void;
}

interface StageProgressUpdate {
  elementsProcessed: number;
  quadsGenerated: number;
}

interface StageResult {
  elementsProcessed: number;
  quadsGenerated: number;
  duration: number;
}
```

Two implementations:

| Implementation        | Use case                                                                |
| --------------------- | ----------------------------------------------------------------------- |
| `OraProgressReporter` | Interactive CLI — `ora` spinners with live-updating counters            |
| `LogProgressReporter` | Non-interactive / CI — plain `console.info` lines, no ANSI escape codes |

A `--silent` flag suppresses all output (for programmatic use / testing).

#### How the orchestrator reports progress

The pipeline orchestrator wraps the write loop with progress callbacks. No EventEmitter needed — the orchestrator owns the loop and calls the reporter directly:

```typescript
class Pipeline {
  async run(reporter?: ProgressReporter) {
    reporter?.pipelineStart(this.name);

    for await (const dataset of this.selector.select()) {
      const distribution = await this.resolver.resolve(dataset);

      for (const stage of this.stages) {
        reporter?.stageStart(stage.name, dataset.name);
        const startTime = performance.now();
        let elementsProcessed = 0;
        let quadsGenerated = 0;

        // Stage.run() accepts an onProgress callback
        await stage.run(dataset, distribution, writer, {
          onProgress(elements, quads) {
            elementsProcessed = elements;
            quadsGenerated = quads;
            reporter?.stageProgress({ elementsProcessed, quadsGenerated });
          },
        });

        reporter?.stageComplete(stage.name, {
          elementsProcessed,
          quadsGenerated,
          duration: performance.now() - startTime,
        });
      }
    }

    reporter?.pipelineComplete(performance.now() - this.startTime);
  }
}
```

The `onProgress` callback is called by `Stage` after each batch completes. This keeps `Stage` unaware of the rendering — it just reports numbers. The reporter decides how to display them (spinner update, log line, or nothing).

#### Why EventEmitter isn't needed for progress

This is a direct consequence of the [smart orchestrator architecture](#architecture-smart-orchestrator-focused-components). In LD Workbench, Stage doesn't own the data flow, so subcomponents must emit events for Stage to know what's happening. In LDE, Stage already sees every element and quad pass through because it controls the iteration — progress data is a natural byproduct of the loop.

## Package Structure

### Current Layout

```
@lde/pipeline/
  src/
    batch.ts              # batch() async iterable utility
    builder.ts            # PipelineBuilder, helper functions (registry, manual, fileWriter, sparqlWriter)
    config.ts             # RawPipelineConfig, defineConfig, loadPipelineConfig, normalizeConfig
    import.ts             # Importer interface
    index.ts              # Re-exports everything
    pipeline.ts           # Pipeline orchestration
    selector.ts           # StageSelector interface
    stage.ts              # Stage class (composes selector + executors)
    step.ts               # Legacy Step/DataEmittingStep interfaces, NotSupported
    sparql/
      executor.ts         # SparqlConstructExecutor, Executor interface, substituteQueryTemplates
      graph.ts            # withDefaultGraph() — FROM <graph> via AST
      index.ts            # Re-exports
      selector.ts         # SparqlSelector: StageSelector implementation
      values.ts           # injectValues() — VALUES clause via AST
    distribution/
      index.ts            # Re-exports
      probe.ts            # Distribution probing (SparqlProbeResult, DataDumpProbeResult)
      report.ts           # probeResultsToQuads() — probe results to RDF
      resolver.ts         # DistributionResolver, SparqlDistributionResolver
      resolveDistributions.ts  # Helper for stage-level resolution
    step/
      sparqlQuery.ts      # DataEmittingStep wrapper (wraps executor)
    writer/
      fileWriter.ts       # FileWriter
      index.ts            # Re-exports
      serialize.ts        # serializeQuads()
      sparqlUpdateWriter.ts  # SparqlUpdateWriter (with auth support)
      writer.ts           # Writer interface

@lde/pipeline-void/
  src/
    sparqlQueryAnalyzer.ts    # createQueryStage() — wraps executor in a Stage
    perClassAnalyzer.ts       # createDatatypeStage(), createLanguageStage(), createObjectClassStage()
    vocabularyAnalyzer.ts     # VocabularyExecutor: enriches with void:vocabulary triples
    # provenance moved to @lde/pipeline
```

## Migration Path

### Phase 1: Dataset Knowledge Graph (Done)

1. ~~Create `SparqlConstructExecutor` in `@lde/pipeline`~~
2. ~~Create `collect()` utility~~ (removed in Phase 2)
3. ~~Refactor `SparqlQuery` step to use `SparqlConstructExecutor`~~
4. ~~Refactor `SparqlQueryAnalyzer` to use `SparqlConstructExecutor` + `collect()`~~
5. ~~Add `bindings` support to `SparqlConstructExecutor.execute()`~~
6. ~~Refactor `PerClassAnalyzer` to compose with `SparqlConstructExecutor` via `bindings`~~
7. ~~Add `ObjectClassAnalyzer`, `DatatypeAnalyzer`, `LanguageAnalyzer` subclasses~~
8. ~~Add `VocabularyExecutor` decorator and `provenancePlugin()`~~

### Phase 2: LD Workbench (Future)

1. ~~Extract `DistributionResolver` interface and `SparqlDistributionResolver` from `DistributionAnalyzer`~~
2. ~~Extract probe reporting into a stream transformer~~
3. ~~Create `SparqlSelector` implementing `StageSelector` for paginated SELECT queries~~
4. ~~Create batching utility for VALUES clause injection~~ (`injectValues()` in `sparql/values.ts`)
5. ~~Create `Stage` composing optional selector + executor(s) + writer~~
6. ~~Refactor `PerClassAnalyzer` to use `Stage`~~
7. Migrate LD Workbench stages to use LDE components
8. Add multi-stage pipeline support with stage chaining

## Appendix: Legacy Stage Type Taxonomy

For reference, the earlier stage type taxonomy before the unified model was adopted:

| Stage type              | Component                | Output                                               | Examples                                                          |
| ----------------------- | ------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------- |
| **Aggregate**           | `Stage` (no selector)    | `AsyncIterable<Quad>`                                | DKG VOiD queries, `SparqlQuery` step                              |
| **Iterating**           | `Stage` (with selector)  | `AsyncIterable<Quad>`                                | LD Workbench stages, `PerClassAnalyzer`                           |
| **Endpoint Resolution** | `EndpointResolver` (TBD) | Side effect (endpoint ready) + `AsyncIterable<Quad>` | DKG `DistributionAnalyzer`                                        |
| **SPARQL Anything**     | TBD                      | `AsyncIterable<Quad>`                                | Non-RDF to RDF via [SPARQL Anything](https://sparql-anything.cc/) |

This taxonomy grew a new type for each use case. The unified model replaces it with configurations of the same five concepts (Selector, Query, Transformer, Writer, Source Resolver).
