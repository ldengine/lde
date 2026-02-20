# Pipeline VoID

Extensions to [@lde/pipeline](../pipeline) for VoID (Vocabulary of Interlinked Datasets) statistical analysis of RDF datasets.

## Stage factories

### Global stages (one CONSTRUCT query per dataset):

| Factory                   | Query                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `classPartition()`        | [`class-partition.rq`](src/queries/class-partition.rq) — Classes with entity counts                                |
| `classPropertySubjects()` | [`class-properties-subjects.rq`](src/queries/class-properties-subjects.rq) — Properties per class (subject counts) |
| `classPropertyObjects()`  | [`class-properties-objects.rq`](src/queries/class-properties-objects.rq) — Properties per class (object counts)    |
| `countDatatypes()`        | [`datatypes.rq`](src/queries/datatypes.rq) — Dataset-level datatypes                                               |
| `countObjectLiterals()`   | [`object-literals.rq`](src/queries/object-literals.rq) — Literal object counts                                     |
| `countObjectUris()`       | [`object-uris.rq`](src/queries/object-uris.rq) — URI object counts                                                 |
| `countProperties()`       | [`properties.rq`](src/queries/properties.rq) — Distinct properties                                                 |
| `countSubjects()`         | [`subjects.rq`](src/queries/subjects.rq) — Distinct subjects                                                       |
| `countTriples()`          | [`triples.rq`](src/queries/triples.rq) — Total triple count                                                        |
| `detectLicenses()`        | [`licenses.rq`](src/queries/licenses.rq) — License detection                                                       |
| `subjectUriSpace()`       | [`subject-uri-space.rq`](src/queries/subject-uri-space.rq) — Subject URI namespaces                                |

### Per-class stages (iterated with a class selector):

| Factory                 | Query                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `perClassDatatype()`    | [`class-property-datatypes.rq`](src/queries/class-property-datatypes.rq) — Per-class datatype partitions               |
| `perClassLanguage()`    | [`class-property-languages.rq`](src/queries/class-property-languages.rq) — Per-class language tags                     |
| `perClassObjectClass()` | [`class-property-object-classes.rq`](src/queries/class-property-object-classes.rq) — Per-class object class partitions |

### Domain-specific stages:

| Factory               | Description                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `detectVocabulary()`  | [`entity-properties.rq`](src/queries/entity-properties.rq) — Entity properties with automatic `void:vocabulary` detection             |
| `uriSpace(uriSpaces)` | [`object-uri-space.rq`](src/queries/object-uri-space.rq) — Object URI namespace linksets, aggregated against a provided URI space map |

All factories return `Promise<Stage>`.

## Executor decorators

- `VocabularyExecutor` — Wraps an executor; detects known vocabulary namespace prefixes in `void:property` quads and appends `void:vocabulary` triples.
- `UriSpaceExecutor` — Wraps an executor; consumes `void:Linkset` quads, matches `void:objectsTarget` against configured URI spaces, and emits aggregated linksets.

## Usage

```typescript
import {
  countTriples,
  classPartition,
  detectVocabulary,
} from '@lde/pipeline-void';
import { Pipeline, SparqlUpdateWriter, provenancePlugin } from '@lde/pipeline';

await new Pipeline({
  datasetSelector: selector,
  stages: [countTriples(), classPartition(), detectVocabulary()],
  plugins: [provenancePlugin()],
  writers: new SparqlUpdateWriter({
    endpoint: new URL('http://localhost:7200/repositories/lde/statements'),
  }),
}).run();
```
