# Pipeline

Framework for building RDF data processing pipelines with SPARQL.

## Features

- **Pipeline** — orchestrates steps that process DCAT datasets
- **PipelineBuilder** — fluent API for constructing pipelines from steps and selectors
- **PipelineConfig** — load pipeline configuration from YAML/JSON files
- **SparqlConstructExecutor** — streaming SPARQL CONSTRUCT with template substitution and variable bindings
- **Distribution analysis** — probe and analyze dataset distributions

## Subpath exports

| Export                   | Description                                                   |
| ------------------------ | ------------------------------------------------------------- |
| `@lde/pipeline`          | Steps, pipeline, builder, config, SPARQL                      |
| `@lde/pipeline/analyzer` | Analyzer contracts (`Analyzer`, `BaseAnalyzer`, result types) |

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
