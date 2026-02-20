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

const queriesDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'queries',
);

async function createVoidStage(
  filename: string,
  options?: {
    executor?: (query: string) => Executor;
    selection?: 'perClass';
  },
): Promise<Stage> {
  const query = await readQueryFile(resolve(queriesDir, filename));
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

export function subjectUriSpaces(): Promise<Stage> {
  return createVoidStage('subject-uri-space.rq');
}

export function classPartitions(): Promise<Stage> {
  return createVoidStage('class-partition.rq');
}

export function countObjectLiterals(): Promise<Stage> {
  return createVoidStage('object-literals.rq');
}

export function countObjectUris(): Promise<Stage> {
  return createVoidStage('object-uris.rq');
}

export function countProperties(): Promise<Stage> {
  return createVoidStage('properties.rq');
}

export function countSubjects(): Promise<Stage> {
  return createVoidStage('subjects.rq');
}

export function countTriples(): Promise<Stage> {
  return createVoidStage('triples.rq');
}

export function classPropertySubjects(): Promise<Stage> {
  return createVoidStage('class-properties-subjects.rq');
}

export function classPropertyObjects(): Promise<Stage> {
  return createVoidStage('class-properties-objects.rq');
}

export function countDatatypes(): Promise<Stage> {
  return createVoidStage('datatypes.rq');
}

export function detectLicenses(): Promise<Stage> {
  return createVoidStage('licenses.rq');
}

// Per-class stages

export function perClassObjectClasses(): Promise<Stage> {
  return createVoidStage('class-property-object-classes.rq', {
    selection: 'perClass',
  });
}

export function perClassDatatypes(): Promise<Stage> {
  return createVoidStage('class-property-datatypes.rq', {
    selection: 'perClass',
  });
}

export function perClassLanguages(): Promise<Stage> {
  return createVoidStage('class-property-languages.rq', {
    selection: 'perClass',
  });
}

// Domain-specific executor stages

export function uriSpaces(
  uriSpaces: ReadonlyMap<string, readonly Quad[]>,
): Promise<Stage> {
  return createVoidStage('object-uri-space.rq', {
    executor: (query) =>
      new UriSpaceExecutor(new SparqlConstructExecutor({ query }), uriSpaces),
  });
}

export function detectVocabularies(): Promise<Stage> {
  return createVoidStage('entity-properties.rq', {
    executor: (query) =>
      new VocabularyExecutor(new SparqlConstructExecutor({ query })),
  });
}
