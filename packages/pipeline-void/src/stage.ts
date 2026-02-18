import {
  Stage,
  SparqlConstructExecutor,
  SparqlItemSelector,
  readQueryFile,
  type Executor,
  type ItemSelector,
} from '@lde/pipeline';
import type { Quad } from '@rdfjs/types';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VocabularyExecutor } from './vocabularyAnalyzer.js';
import { UriSpaceExecutor } from './uriSpaceExecutor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function createVoidStage(
  filename: string,
  options?: {
    executor?: (query: string) => Executor;
    selection?: 'perClass';
  },
): Promise<Stage> {
  const query = await readQueryFile(resolve(__dirname, 'queries', filename));
  const executor =
    options?.executor?.(query) ?? new SparqlConstructExecutor({ query });

  if (options?.selection === 'perClass') {
    return new Stage({
      name: filename,
      itemSelector: classSelector(),
      executors: executor,
    });
  }
  return new Stage({ name: filename, executors: executor });
}

function classSelector(): ItemSelector {
  return {
    select: (distribution) => {
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

      return new SparqlItemSelector({
        query: selectorQuery,
        pageSize: 1000,
      }).select(distribution);
    },
  };
}

// Global stages

export function createSubjectUriSpaceStage(): Promise<Stage> {
  return createVoidStage('subject-uri-space.rq');
}

export function createClassPartitionStage(): Promise<Stage> {
  return createVoidStage('class-partition.rq');
}

export function createObjectLiteralsStage(): Promise<Stage> {
  return createVoidStage('object-literals.rq');
}

export function createObjectUrisStage(): Promise<Stage> {
  return createVoidStage('object-uris.rq');
}

export function createPropertiesStage(): Promise<Stage> {
  return createVoidStage('properties.rq');
}

export function createSubjectsStage(): Promise<Stage> {
  return createVoidStage('subjects.rq');
}

export function createTriplesStage(): Promise<Stage> {
  return createVoidStage('triples.rq');
}

export function createClassPropertiesSubjectsStage(): Promise<Stage> {
  return createVoidStage('class-properties-subjects.rq');
}

export function createClassPropertiesObjectsStage(): Promise<Stage> {
  return createVoidStage('class-properties-objects.rq');
}

export function createDatatypesStage(): Promise<Stage> {
  return createVoidStage('datatypes.rq');
}

export function createLicensesStage(): Promise<Stage> {
  return createVoidStage('licenses.rq');
}

// Per-class stages

export function createPerClassObjectClassStage(): Promise<Stage> {
  return createVoidStage('class-property-object-classes.rq', {
    selection: 'perClass',
  });
}

export function createPerClassDatatypeStage(): Promise<Stage> {
  return createVoidStage('class-property-datatypes.rq', {
    selection: 'perClass',
  });
}

export function createPerClassLanguageStage(): Promise<Stage> {
  return createVoidStage('class-property-languages.rq', {
    selection: 'perClass',
  });
}

// Domain-specific executor stages

export function createUriSpaceStage(
  uriSpaces: ReadonlyMap<string, readonly Quad[]>,
): Promise<Stage> {
  return createVoidStage('object-uri-space.rq', {
    executor: (query) =>
      new UriSpaceExecutor(new SparqlConstructExecutor({ query }), uriSpaces),
  });
}

export function createVocabularyStage(): Promise<Stage> {
  return createVoidStage('entity-properties.rq', {
    executor: (query) =>
      new VocabularyExecutor(new SparqlConstructExecutor({ query })),
  });
}
