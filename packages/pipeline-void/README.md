# Pipeline VOiD

VOiD (Vocabulary of Interlinked Datasets) statistical analysis for RDF datasets.

## Analyzers

- **SparqlQueryAnalyzer** — Execute SPARQL CONSTRUCT queries with template substitution
- **PerClassAnalyzer** — Two-phase analyzer that iterates over classes to avoid timeouts

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
import { SparqlQueryAnalyzer } from '@lde/pipeline-void';

// Load a query from file
const analyzer = await SparqlQueryAnalyzer.fromFile('triples.rq');

// Execute against a dataset
const result = await analyzer.execute(dataset);
if (result instanceof Success) {
  // result.data contains the VOiD statistics as RDF
}
```
