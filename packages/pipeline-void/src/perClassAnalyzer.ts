import {
  Stage,
  SparqlSelector,
  SparqlConstructExecutor,
  readQueryFile,
} from '@lde/pipeline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create a Stage that first selects classes from the endpoint,
 * then runs a per-class CONSTRUCT query with `?class` bound via VALUES.
 *
 * The selector is a factory that receives the runtime distribution,
 * so no distribution is needed at construction time.
 */
async function createPerClassStage(queryFilename: string): Promise<Stage> {
  const rawQuery = await readQueryFile(
    resolve(__dirname, 'queries', queryFilename)
  );

  const executor = new SparqlConstructExecutor({ query: rawQuery });

  return new Stage({
    name: queryFilename,
    selector: (distribution) => {
      const subjectFilter = distribution.subjectFilter ?? '';
      const fromClause = distribution.namedGraph
        ? `FROM <${distribution.namedGraph}>`
        : '';
      const selectorQuery = [
        'SELECT DISTINCT ?class',
        fromClause,
        `WHERE { ${subjectFilter} ?s a ?class . }`,
        'LIMIT 1000',
      ].join('\n');

      return new SparqlSelector({
        query: selectorQuery,
        endpoint: distribution.accessUrl!,
        pageSize: 1000,
      });
    },
    executors: executor,
  });
}

export function createDatatypeStage(): Promise<Stage> {
  return createPerClassStage('class-property-datatypes.rq');
}

export function createLanguageStage(): Promise<Stage> {
  return createPerClassStage('class-property-languages.rq');
}

export function createObjectClassStage(): Promise<Stage> {
  return createPerClassStage('class-property-object-classes.rq');
}
