import { Distribution } from '@lde/dataset';
import { Stage, SparqlConstructExecutor, readQueryFile } from '@lde/pipeline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create a Stage that executes a SPARQL CONSTRUCT query from the queries directory.
 *
 * Pre-processes `#subjectFilter#` before the query is parsed as SPARQL;
 * `?dataset` and `FROM <graph>` are handled at the AST level by the executor.
 */
export async function createQueryStage(
  filename: string,
  distribution: Distribution
): Promise<Stage> {
  const rawQuery = await readQueryFile(resolve(__dirname, 'queries', filename));

  const subjectFilter = distribution.subjectFilter ?? '';
  const query = rawQuery.replace('#subjectFilter#', subjectFilter);

  const executor = new SparqlConstructExecutor({ query });

  return new Stage({ name: filename, executors: executor });
}
