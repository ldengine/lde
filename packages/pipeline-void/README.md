# Pipeline VOiD

VOiD (Vocabulary of Interlinked Datasets) statistical analysis for RDF datasets.

## Query stages

- `createQueryStage(filename, distribution)` — Create a `Stage` from a SPARQL CONSTRUCT query file
- `createDatatypeStage(distribution)` — Per-class datatype partitions
- `createLanguageStage(distribution)` — Per-class language tags
- `createObjectClassStage(distribution)` — Per-class object class partitions

## Executor decorators

- `VocabularyExecutor` — Wraps an executor; detects and appends `void:vocabulary` triples
- `withProvenance(quads, iri, startedAt, endedAt)` — Append PROV-O provenance metadata

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
  createQueryStage,
  createDatatypeStage,
  VocabularyExecutor,
  Stage,
} from '@lde/pipeline-void';
import { SparqlConstructExecutor } from '@lde/pipeline';

// Simple CONSTRUCT query stage
const stage = await createQueryStage('triples.rq');
await stage.run(dataset, distribution, writer);

// Executor decorator: vocabulary detection wraps entity-properties executor
const executor = await SparqlConstructExecutor.fromFile(
  'queries/entity-properties.rq',
);
const entityPropertiesStage = new Stage({
  name: 'entity-properties',
  executors: new VocabularyExecutor(executor),
});
```

## Validation

```sh
npx nx test pipeline-void
npx nx lint pipeline-void
npx nx typecheck pipeline-void
```
