# @lde/pipeline-shacl-validator

SHACL validation for [`@lde/pipeline`](../pipeline).

Validates RDF quads produced by pipeline stages against [SHACL shapes](https://www.w3.org/TR/shacl/),
writing per-dataset report files in SHACL validation report format.
Shapes can be provided in any RDF serialization (Turtle, JSON-LD, N-Triples etc.).

## Usage

```typescript
import { Pipeline, Stage, SparqlConstructExecutor } from '@lde/pipeline';
import { ShaclValidator } from '@lde/pipeline-shacl-validator';

const validator = new ShaclValidator({
  shapesFile: './shapes.ttl',
  reportDir: './validation',
});

const pipeline = new Pipeline({
  // ...
  stages: [
    new Stage({
      name: 'transform',
      executors: new SparqlConstructExecutor({ query: '...' }),
      validation: {
        validator,
        onInvalid: 'write', // 'write' | 'skip' | 'halt'
      },
    }),
  ],
});

await pipeline.run();
```

### `onInvalid` options

| Value     | Behaviour                                                        |
| --------- | ---------------------------------------------------------------- |
| `'write'` | Write quads to the output even if validation fails **(default)** |
| `'skip'`  | Discard invalid quads silently                                   |
| `'halt'`  | Throw an error, stopping the pipeline                            |

### Report files

Validation violations are written to `<reportDir>/<dataset-iri>.validation.ttl`
as SHACL validation report triples.
