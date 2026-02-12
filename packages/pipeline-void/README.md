# Pipeline VOiD

VOiD (Vocabulary of Interlinked Datasets) statistical analysis for RDF datasets.

## Query stages

- `createQueryStage(filename, distribution)` — Create a `Stage` from a SPARQL CONSTRUCT query file
- `createDatatypeStage(distribution)` — Per-class datatype partitions
- `createLanguageStage(distribution)` — Per-class language tags
- `createObjectClassStage(distribution)` — Per-class object class partitions

## Streaming transformers

- `withVocabularies(quads, datasetIri)` — Detect and append `void:vocabulary` triples
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
  withVocabularies,
  withProvenance,
} from '@lde/pipeline-void';
import { Distribution } from '@lde/dataset';

const distribution = Distribution.sparql(new URL('http://example.com/sparql'));

// Simple CONSTRUCT query stage
const stage = await createQueryStage('triples.rq', distribution);
await stage.run(dataset, distribution, writer);

// Per-class stage (streaming)
const datatypeStage = await createDatatypeStage(distribution);
await datatypeStage.run(dataset, distribution, writer);
```

## Validation

```sh
npx nx test pipeline-void
npx nx lint pipeline-void
npx nx typecheck pipeline-void
```
