# Pipeline VoID

Extensions to [@lde/pipeline](../pipeline) for VoID (Vocabulary of Interlinked Datasets) statistical analysis of RDF datasets.

## Stage factories

### Global stages (one CONSTRUCT query per dataset):

| Factory                                | Query                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `createClassPartitionStage()`          | [`class-partition.rq`](src/queries/class-partition.rq) — Classes with entity counts                                |
| `createClassPropertiesSubjectsStage()` | [`class-properties-subjects.rq`](src/queries/class-properties-subjects.rq) — Properties per class (subject counts) |
| `createClassPropertiesObjectsStage()`  | [`class-properties-objects.rq`](src/queries/class-properties-objects.rq) — Properties per class (object counts)    |
| `createDatatypesStage()`               | [`datatypes.rq`](src/queries/datatypes.rq) — Dataset-level datatypes                                               |
| `createLicensesStage()`                | [`licenses.rq`](src/queries/licenses.rq) — License detection                                                       |
| `createObjectLiteralsStage()`          | [`object-literals.rq`](src/queries/object-literals.rq) — Literal object counts                                     |
| `createObjectUrisStage()`              | [`object-uris.rq`](src/queries/object-uris.rq) — URI object counts                                                 |
| `createPropertiesStage()`              | [`properties.rq`](src/queries/properties.rq) — Distinct properties                                                 |
| `createSubjectsStage()`                | [`subjects.rq`](src/queries/subjects.rq) — Distinct subjects                                                       |
| `createSubjectUriSpaceStage()`         | [`subject-uri-space.rq`](src/queries/subject-uri-space.rq) — Subject URI namespaces                                |
| `createTriplesStage()`                 | [`triples.rq`](src/queries/triples.rq) — Total triple count                                                        |

### Per-class stages (iterated with a class selector):

| Factory                            | Query                                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `createPerClassDatatypeStage()`    | [`class-property-datatypes.rq`](src/queries/class-property-datatypes.rq) — Per-class datatype partitions               |
| `createPerClassLanguageStage()`    | [`class-property-languages.rq`](src/queries/class-property-languages.rq) — Per-class language tags                     |
| `createPerClassObjectClassStage()` | [`class-property-object-classes.rq`](src/queries/class-property-object-classes.rq) — Per-class object class partitions |

### Domain-specific stages:

| Factory                          | Description                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `createUriSpaceStage(uriSpaces)` | [`object-uri-space.rq`](src/queries/object-uri-space.rq) — Object URI namespace linksets, aggregated against a provided URI space map |
| `createVocabularyStage()`        | [`entity-properties.rq`](src/queries/entity-properties.rq) — Entity properties with automatic `void:vocabulary` detection             |

All factories return `Promise<Stage>`.

## Executor decorators

- `VocabularyExecutor` — Wraps an executor; detects known vocabulary namespace prefixes in `void:property` quads and appends `void:vocabulary` triples.
- `UriSpaceExecutor` — Wraps an executor; consumes `void:Linkset` quads, matches `void:objectsTarget` against configured URI spaces, and emits aggregated linksets.

## Usage

```typescript
import {
  createTriplesStage,
  createClassPartitionStage,
  createVocabularyStage,
} from '@lde/pipeline-void';
import { Pipeline, SparqlUpdateWriter, provenancePlugin } from '@lde/pipeline';

await new Pipeline({
  datasetSelector: selector,
  stages: [
    createTriplesStage(),
    createClassPartitionStage(),
    createVocabularyStage(),
  ],
  plugins: [provenancePlugin()],
  writers: new SparqlUpdateWriter({
    endpoint: new URL('http://localhost:7200/repositories/lde/statements'),
  }),
}).run();
```
