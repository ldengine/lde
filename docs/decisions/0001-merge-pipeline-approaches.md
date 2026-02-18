# 1. Merge pipeline approaches

Date: 2026-02-06

## Status

Accepted

## Context

In the Dutch digital heritage network, two approaches for RDF pipelines co-exist:

- [Dataset Knowledge Graph](https://github.com/netwerk-digitaal-erfgoed/dataset-knowledge-graph) (DKG): analyses datasets to produce VoID summaries of resource aggregates;
- [LD Workbench](https://github.com/netwerk-digitaal-erfgoed/ld-workbench): a CLI tool for transforming a dataset via SPARQL (iterator/generator pattern over resources)

Both share the same fundamental pattern: resolve distributions (importing them if needed), select items,
run SPARQL CONSTRUCT queries, write results.

Where they differ is primarily in scope (multi-dataset vs. single-dataset) and
iteration granularity (dataset-level aggregation vs. per-resource transformation).

### Shared components

| Component             | DKG                                                 | LD Workbench                                             |
| --------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| Item selection        | `RegistrySelector` (datasets from DCAT-AP registry) | Iterator (`SELECT` query paginating over resource URIs)  |
| Query execution       | SPARQL CONSTRUCT per analysis dimension             | Generator (CONSTRUCT per resource, with `$this` binding) |
| Distribution handling | Import RDF dumps into QLever for querying           | Import into local graph store, then query                |
| Output                | Files + GraphDB                                     | Files + TriplyDB                                         |
| Stage chaining        | Not used (parallel analysis stages)                 | Sequential: output of stage N feeds into stage N+1       |

### Limitations of the current separation

- **Duplicated infrastructure**: both projects independently implement SPARQL streaming, file writing,
  distribution import and endpoint management and test setup.
- **Divergent conventions**: DKG uses custom classes per analysis type; LD Workbench uses EventEmitter
  hierarchies. Neither approach is easily extensible by third parties.

## Decision

Merge the two approaches into a unified pipeline framework.

The shared abstractions become `@lde/pipeline`:

| LD Workbench      | DKG                  | LDE unified             |
| ----------------- | -------------------- | ----------------------- |
| Iterator          | RegistrySelector     | Selector (interface)    |
| Generator         | Per-analysis classes | Executor (interface)    |
| `$this` binding   | `?dataset`, `?class` | Named variable bindings |
| File / TriplyDB   | File / GraphDB       | Writer (interface)      |
| YAML config       | Hardcoded TypeScript | TypeScript API + YAML   |
| EventEmitter flow | Custom async classes | async/await + iterables |

### Pipeline Architecture

The core model:

- **Selector**: produces items to iterate (datasets, resources, classes)
- **Executor**: runs SPARQL CONSTRUCT queries, produces quads; decorated for domain-specific concerns (e.g. `VocabularyExecutor`)
- **Writer**: consumes quads (file, SPARQL store)
- **Stage**: orchestrator that owns the loop: selector iteration → executor batching → writer dispatch
- **Pipeline plugins**: lifecycle hooks for concerns like provenance (`provenancePlugin()`).

Key design principles:

- **Streaming by default**: all components stream quads; no materialisation to Store on the main path
- **Composition via decoration**: executors wrap other executors (decorator pattern), not inheritance
- **async/await, not EventEmitter**: control flow is explicit; EventEmitter only for progress observation
- **Bounded concurrency**: `maxConcurrency` + `Promise.race()` caps in-flight work to prevent unbounded memory growth
- **Configuration is code**: TypeScript objects, not builder chains; readable by both humans and AI agents

Move the VoID-specific code to a separate package `@lde/pipeline-void`.

## Consequences

- A single, coherent way to build RDF pipelines, whether for analysis or transformation.
- Shared thus faster development for both approaches.
- DKG becomes a consumer of `@lde/pipeline` and `@lde/pipeline-void`, no longer maintaining its own pipeline infrastructure.
- LD Workbench users get a migration path to LDE with improved concurrency, memory management and extensibility.
- Third-party developers can build custom pipeline stages using the same interfaces as built-in ones.
- LD Workbench’s YAML configuration support is planned as a secondary interface on top of the TypeScript API.
