# DKG to LDE Migration

## Phase 1: Generic Components (Complete)

All generic components have been ported from [dataset-knowledge-graph](https://github.com/netwerk-digitaal-erfgoed/dataset-knowledge-graph) to LDE.

### Analyzers (`@lde/pipeline-void`)

- ✅ **VocabularyAnalyzer** — detects vocabulary usage from property IRIs, generates `void:vocabulary` triples
- ✅ **ObjectClassAnalyzer** — two-phase analyzer for class+property object class partitions (factory function `createObjectClassAnalyzer()`)
- ✅ **DatatypeAnalyzer** — two-phase analyzer for datatype statistics per class/property (factory function `createDatatypeAnalyzer()`)
- ✅ **LanguageAnalyzer** — two-phase analyzer for language tag statistics per class/property (factory function `createLanguageAnalyzer()`)
- ✅ **SparqlQueryAnalyzer** — wraps `SparqlConstructExecutor` + `collect()` for the `Analyzer` interface
- ✅ **PerClassAnalyzer** — two-phase analyzer composing with `SparqlConstructExecutor` via `bindings`

### Pipeline (`@lde/pipeline`)

- ✅ **SparqlConstructExecutor** — streaming CONSTRUCT query execution with template substitution and `bindings` support
- ✅ **collect()** — materialise quad stream into N3 Store
- ✅ **SparqlQuery step** — `DataEmittingStep` wrapper for pipeline use
- ✅ **DistributionAnalyzer** — probes distributions, imports dumps via `@lde/sparql-importer`
- ✅ **Distribution downloading** with byteSize check
- ✅ **RegistrySelector** — select datasets from a registry via SPARQL query
- ✅ All 16 VoID analysis queries

### Utilities (`@lde/pipeline`)

- ✅ **provenancePlugin()** — PROV-O metadata (`prov:Entity`, `prov:Activity`, timestamps)

## NDE-Specific (stays in DKG)

- UriSpaceAnalyzer (Network of Terms catalog)
- GraphDBClient (NDE infrastructure)
- CLI with NDE-specific configuration

## Phase 2: What's Next

See [sparql-construct-design.md](sparql-construct-design.md) for the full design. Key work:

### Core Components

- [x] **`Stage`** — composes optional selector + executor(s) + writer. Replaces `PerClassAnalyzer`'s custom iteration.
- [ ] **`PaginatedSelector`** — paginated SELECT query yielding `NamedNode` URIs
- [ ] **VALUES batching** — inject `$this` bindings into CONSTRUCT queries via VALUES clause
- [ ] **`Promise.race` concurrency** — concurrent selector/executor execution with `maxConcurrency` backpressure

### Executor Decorators

- [x] Replace `VocabularyAnalyzer` decorator with `VocabularyExecutor` executor decorator
- [x] Replace `withProvenance()` Store-based utility with `provenancePlugin()` pipeline plugin
- [ ] Drop `Analyzer` interface — analysis becomes CONSTRUCT queries consumed via executor decorators

### Configuration

- [ ] **c12 config** — replace LD Workbench YAML with type-safe `pipeline.config.ts` via [c12](https://github.com/unjs/c12)
- [ ] **`defineConfig()`** helper for type-safe pipeline configuration

### LD Workbench Migration

- [ ] Merge [LD Workbench](https://github.com/netwerk-digitaal-erfgoed/ld-workbench) into LDE monorepo
- [ ] Stage chaining (stage output → next stage input)
- [ ] Stage materialisation (write to file, import into SPARQL store)
- [ ] Comunica file engine integration
- [ ] Standardise `<#class#>` template variable to `$this` in query files
