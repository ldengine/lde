import { Dataset, Distribution } from '@lde/dataset';
import {
  NotSupported,
  type Executor,
  type ExecuteOptions,
} from '@lde/pipeline';
import type { Quad } from '@rdfjs/types';
import prefixes from '@zazuko/prefixes';
import { DataFactory } from 'n3';

const { namedNode, quad } = DataFactory;

const VOID = 'http://rdfs.org/ns/void#';
const voidProperty = namedNode(`${VOID}property`);
const voidVocabulary = namedNode(`${VOID}vocabulary`);

const defaultVocabularies: readonly string[] = [
  ...new Set(Object.values(prefixes)),
];

/**
 * Executor decorator that passes through all quads from the inner executor
 * and appends `void:vocabulary` triples for detected vocabulary prefixes.
 *
 * Inspects quads with predicate `void:property` to detect known vocabulary
 * namespace prefixes, then yields the corresponding `void:vocabulary` quads
 * after all inner quads have been consumed.
 */
export class VocabularyExecutor implements Executor {
  constructor(
    private readonly inner: Executor,
    private readonly vocabularies: readonly string[] = defaultVocabularies,
  ) {}

  async execute(
    dataset: Dataset,
    distribution: Distribution,
    options?: ExecuteOptions,
  ): Promise<AsyncIterable<Quad> | NotSupported> {
    const result = await this.inner.execute(dataset, distribution, options);
    if (result instanceof NotSupported) {
      return result;
    }
    return withVocabularies(result, dataset.iri.toString(), this.vocabularies);
  }
}

async function* withVocabularies(
  quads: AsyncIterable<Quad>,
  datasetIri: string,
  vocabularies: readonly string[],
): AsyncIterable<Quad> {
  const detectedVocabularies = new Set<string>();

  for await (const q of quads) {
    yield q;

    if (q.predicate.equals(voidProperty)) {
      const propertyUri = q.object.value;
      for (const ns of vocabularies) {
        if (propertyUri.startsWith(ns)) {
          detectedVocabularies.add(ns);
          break;
        }
      }
    }
  }

  const datasetNode = namedNode(datasetIri);
  for (const vocabUri of detectedVocabularies) {
    yield quad(datasetNode, voidVocabulary, namedNode(vocabUri));
  }
}
