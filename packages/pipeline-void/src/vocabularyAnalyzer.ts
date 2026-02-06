import { Dataset } from '@lde/dataset';
import type { DatasetCore } from '@rdfjs/types';
import { DataFactory, Store } from 'n3';
import {
  type Analyzer,
  Success,
  type Failure,
  type NotSupported,
} from './analyzer.js';

const { namedNode, quad } = DataFactory;

const VOID = 'http://rdfs.org/ns/void#';
const voidProperty = namedNode(`${VOID}property`);
const voidVocabulary = namedNode(`${VOID}vocabulary`);

/**
 * Known vocabulary namespace prefixes mapped to their canonical URIs.
 */
const vocabularyPrefixes: ReadonlyMap<string, string> = new Map([
  ['http://schema.org/', 'http://schema.org/'],
  ['https://schema.org/', 'https://schema.org/'],
  [
    'https://www.ica.org/standards/RiC/ontology#',
    'https://www.ica.org/standards/RiC/ontology#',
  ],
  [
    'http://www.cidoc-crm.org/cidoc-crm/',
    'http://www.cidoc-crm.org/cidoc-crm/',
  ],
  ['http://purl.org/ontology/bibo/', 'http://purl.org/ontology/bibo/'],
  ['http://purl.org/dc/elements/1.1/', 'http://purl.org/dc/elements/1.1/'],
  ['http://purl.org/dc/terms/', 'http://purl.org/dc/terms/'],
  ['http://purl.org/dc/dcmitype/', 'http://purl.org/dc/dcmitype/'],
  [
    'http://www.w3.org/2004/02/skos/core#',
    'http://www.w3.org/2004/02/skos/core#',
  ],
  ['http://xmlns.com/foaf/0.1/', 'http://xmlns.com/foaf/0.1/'],
]);

/**
 * Decorator analyzer that enriches results with `void:vocabulary` triples.
 *
 * Wraps another analyzer, runs it, then inspects `void:property` triples
 * to detect known vocabulary prefixes and add corresponding `void:vocabulary`
 * triples to the result.
 */
export class VocabularyAnalyzer implements Analyzer {
  public readonly name: string;

  constructor(private readonly inner: Analyzer) {
    this.name = inner.name;
  }

  public async execute(
    dataset: Dataset
  ): Promise<Success | Failure | NotSupported> {
    const result = await this.inner.execute(dataset);
    if (!(result instanceof Success)) {
      return result;
    }

    const enriched = addVocabularyTriples(result.data, dataset.iri.toString());
    return new Success(enriched);
  }

  public async finish(): Promise<void> {
    await this.inner.finish?.();
  }
}

function addVocabularyTriples(
  data: DatasetCore,
  datasetIri: string
): DatasetCore {
  const store = new Store([...data]);
  const datasetNode = namedNode(datasetIri);

  // Collect unique vocabulary URIs from void:property triples.
  const detectedVocabularies = new Set<string>();
  for (const q of store.match(null, voidProperty, null)) {
    const propertyUri = q.object.value;
    for (const [prefix, vocabUri] of vocabularyPrefixes) {
      if (propertyUri.startsWith(prefix)) {
        detectedVocabularies.add(vocabUri);
        break;
      }
    }
  }

  for (const vocabUri of detectedVocabularies) {
    store.addQuad(quad(datasetNode, voidVocabulary, namedNode(vocabUri)));
  }

  return store;
}
