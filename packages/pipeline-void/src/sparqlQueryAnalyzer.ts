import { Stage, SparqlConstructExecutor, readQueryFile } from '@lde/pipeline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create a Stage that executes a SPARQL CONSTRUCT query from the queries directory.
 *
 * `#subjectFilter#` is handled at runtime by the executor;
 * `?dataset` and `FROM <graph>` are handled at the AST level by the executor.
 */
export async function createQueryStage(filename: string): Promise<Stage> {
  const rawQuery = await readQueryFile(resolve(__dirname, 'queries', filename));
  const executor = new SparqlConstructExecutor({ query: rawQuery });

  return new Stage({ name: filename, executors: executor });
}
