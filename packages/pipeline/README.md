# Pipeline

Framework for building RDF data processing pipelines with SPARQL.

## Features

- **Pipeline** — orchestrates steps that process DCAT datasets
- **PipelineBuilder** — fluent API for constructing pipelines from steps and selectors
- **PipelineConfig** — load pipeline configuration from YAML/JSON files
- **SparqlConstructExecutor** — streaming SPARQL CONSTRUCT with template substitution and variable bindings
- **Distribution analysis** — probe and analyze dataset distributions

## Components

A **Pipeline** consists of:

- one **[Dataset Selector](#dataset-selector)**
- one **[Distribution Resolver](#distribution-resolver)** that resolves the input dataset to a usable SPARQL distribution
- one or more **Stages**, each consisting of:
  - an optional **Selector** that filters resources
  - one or more **Executors** that generate triples for each selected resource

### Dataset Selector

Selects datasets, either manually by the user or dynamically by querying a DCAT Dataset Registry.

### Distribution Resolver

Resolves each selected dataset to a usable distribution.

#### SPARQL Distribution Resolver

If a working SPARQL endpoint is already available for the dataset, that is used.
If not, and a valid RDF datadump is available, that is imported to a local SPARQL server.

#### Other Distribution Resolvers

### Bindings Selector

Selects resources from the dataset and to fan out queries per result in the executor.
Bindings are free, and replaced with `VALUES { ... }`.

### Executor

## Usage

```typescript
import {
  PipelineBuilder,
  SparqlConstructExecutor,
  collect,
} from '@lde/pipeline';

// Build a pipeline from steps
const pipeline = new PipelineBuilder().addStep(myStep).build();

// Or use the SPARQL executor directly
const executor = new SparqlConstructExecutor({
  query: 'CONSTRUCT { ?dataset ?p ?o } WHERE { ?s ?p ?o }',
});
const result = await executor.execute(dataset);
```

## Validation

```sh
npx nx run-many -t lint test typecheck build --projects=@lde/pipeline
```
