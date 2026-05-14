# @lde/pipeline-shacl-sampler

Per-class sampling stages for [`@lde/pipeline`](../pipeline),
derived from SHACL shapes.

Given a SHACL shapes file, this package builds one
[`Stage`](../pipeline/src/stage.ts) per `sh:targetClass`. Each stage’s
CONSTRUCT executor pulls N instances of the target class from the
distribution’s SPARQL endpoint plus their depth-1 neighbours along every
path the SHACL declares with a nested shape constraint (`sh:node`,
`sh:class`, `sh:qualifiedValueShape`, or `sh:or` branches that reference
those). The resulting quads are a sample subgraph rich enough for
[`@lde/pipeline-shacl-validator`](../pipeline-shacl-validator) to validate
without false-positive ‘missing nested node’ violations.

## Usage

```typescript
import { Pipeline } from '@lde/pipeline';
import { shaclSampleStages } from '@lde/pipeline-shacl-sampler';
import { ShaclValidator } from '@lde/pipeline-shacl-validator';

const shapesFile = 'https://docs.nde.nl/schema-profile/shacl.ttl';
const validator = new ShaclValidator({ shapesFile, reportDir: './validation' });

const stages = await shaclSampleStages({
  shapesFile,
  samplesPerClass: 50,
  validator,
});

await new Pipeline({ /* … */, stages }).run();
```

## Options

| Option            | Default | Description                                                                       |
| ----------------- | ------- | --------------------------------------------------------------------------------- |
| `shapesFile`      | —       | URL or local path to the SHACL shapes file. Any format `rdf-dereference` accepts. |
| `samplesPerClass` | `50`    | Number of top-level resources to sample per `sh:targetClass`.                     |
| `timeout`         | `60000` | SPARQL query timeout in milliseconds.                                             |

## Limitations

- Only plain-IRI `sh:path` values are supported. Sequence, alternative and
  inverse paths throw at extraction time.
- Depth-1 follow only: shapes nested more than one hop from a sampled
  top-level resource are not fully populated. If those nested classes are
  themselves `sh:targetClass` shapes they will be sampled and validated
  independently.
