# Pipeline Console Reporter

Console progress reporter for [@lde/pipeline](../pipeline). Displays real-time pipeline progress with spinners, colours and timing information.

## Usage

```typescript
import { Pipeline } from '@lde/pipeline';
import { ConsoleReporter } from '@lde/pipeline-console-reporter';

await new Pipeline({
  datasetSelector: selector,
  stages,
  writers,
  reporter: new ConsoleReporter(),
}).run();
```
