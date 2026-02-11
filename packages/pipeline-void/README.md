# Pipeline VOiD

VOiD (Vocabulary of Interlinked Datasets) statistical analysis for RDF datasets.

## Analyzers

- **SparqlQueryAnalyzer** — Execute SPARQL CONSTRUCT queries with template substitution

## Per-class stages

Factory functions that create `Stage` instances for per-class analysis.
Each stage first selects classes from the endpoint, then runs a CONSTRUCT query
with `?class` bound via VALUES:

- `createDatatypeStage` — per-class datatype partitions
- `createLanguageStage` — per-class language tags
- `createObjectClassStage` — per-class object class partitions

## SPARQL Queries

Generic VOiD analysis queries included:

| Query                              | Description                           |
| ---------------------------------- | ------------------------------------- |
| `triples.rq`                       | Total triple count                    |
| `subjects.rq`                      | Distinct subjects                     |
| `properties.rq`                    | Distinct properties                   |
| `class-partition.rq`               | Classes with entity counts            |
| `class-properties-subjects.rq`     | Properties per class (subject counts) |
| `class-properties-objects.rq`      | Properties per class (object counts)  |
| `class-property-datatypes.rq`      | Per-class datatype partitions         |
| `class-property-languages.rq`      | Per-class language tags               |
| `class-property-object-classes.rq` | Per-class object class partitions     |
| `object-literals.rq`               | Literal object counts                 |
| `object-uris.rq`                   | URI object counts                     |
| `object-uri-space.rq`              | Object URI namespaces                 |
| `subject-uri-space.rq`             | Subject URI namespaces                |
| `datatypes.rq`                     | Dataset-level datatypes               |
| `entity-properties.rq`             | Property statistics                   |
| `licenses.rq`                      | License detection                     |

## Usage

```typescript
import {
  SparqlQueryAnalyzer,
  Success,
  createDatatypeStage,
} from '@lde/pipeline-void';
import { Distribution } from '@lde/dataset';

// Simple CONSTRUCT query analyzer
const analyzer = await SparqlQueryAnalyzer.fromFile('triples.rq');
const result = await analyzer.execute(dataset);
if (result instanceof Success) {
  // result.data contains the VOiD statistics as RDF
}

// Per-class stage (streaming)
const distribution = Distribution.sparql(new URL('http://example.com/sparql'));
const stage = await createDatatypeStage(distribution);
const quads = await stage.run(dataset, distribution);
```

## Validation

```sh
npx nx test pipeline-void
npx nx lint pipeline-void
npx nx typecheck pipeline-void
```
