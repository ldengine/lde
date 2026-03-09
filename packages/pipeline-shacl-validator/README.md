# @lde/pipeline-shacl-validator

SHACL validation for [`@lde/pipeline`](../pipeline).

Validates RDF quads produced by pipeline stages against [SHACL shapes](https://www.w3.org/TR/shacl/),
writing per-executor report files in SHACL validation report format.

## Usage

```typescript
import { Pipeline, Stage, SparqlConstructExecutor } from '@lde/pipeline';
import { ShaclPipelineValidator } from '@lde/pipeline-shacl-validator';

const validator = new ShaclPipelineValidator({
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
| `'skip'`  | Discard the batch silently                                       |
| `'halt'`  | Throw an error, stopping the pipeline                            |

### Report files

Validation violations are written to `<reportDir>/<dataset-name>/<executor-name>.validation.ttl`
as SHACL validation report triples. This lets you trace violations back to specific CONSTRUCT queries.

## Development

```sh
npx nx test pipeline-shacl-validator
npx nx build pipeline-shacl-validator
```
