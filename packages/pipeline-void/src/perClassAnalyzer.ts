import { Distribution } from '@lde/dataset';
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
 * Replaces the legacy `PerClassAnalyzer` two-phase loop with streaming.
 */
async function createPerClassStage(
  queryFilename: string,
  distribution: Distribution
): Promise<Stage> {
  const rawQuery = await readQueryFile(
    resolve(__dirname, 'queries', queryFilename)
  );

  // Pre-process #subjectFilter# before the query is parsed as SPARQL.
  const subjectFilter = distribution.subjectFilter ?? '';
  const query = rawQuery.replace('#subjectFilter#', subjectFilter);

  // Build the selector SELECT query (same substitution for subjectFilter).
  const fromClause = distribution.namedGraph
    ? `FROM <${distribution.namedGraph}>`
    : '';
  const selectorQuery = [
    'SELECT DISTINCT ?class',
    fromClause,
    `WHERE { ${subjectFilter} ?s a ?class . }`,
    'LIMIT 1000',
  ].join('\n');

  const selector = new SparqlSelector({
    query: selectorQuery,
    endpoint: distribution.accessUrl!,
    pageSize: 1000,
  });

  const executor = new SparqlConstructExecutor({ query });

  return new Stage({
    name: queryFilename,
    selector,
    executors: executor,
  });
}

export function createDatatypeStage(
  distribution: Distribution
): Promise<Stage> {
  return createPerClassStage('class-property-datatypes.rq', distribution);
}

export function createLanguageStage(
  distribution: Distribution
): Promise<Stage> {
  return createPerClassStage('class-property-languages.rq', distribution);
}

export function createObjectClassStage(
  distribution: Distribution
): Promise<Stage> {
  return createPerClassStage('class-property-object-classes.rq', distribution);
}
