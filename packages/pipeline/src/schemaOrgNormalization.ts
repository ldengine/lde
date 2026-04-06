import type { QuadTransform } from './stage.js';
import type { PipelinePlugin } from './pipeline.js';
import type { Quad } from '@rdfjs/types';
import { DataFactory } from 'n3';

const { namedNode, quad } = DataFactory;

const VOID_CLASS = namedNode('http://rdfs.org/ns/void#class');
const VOID_PROPERTY = namedNode('http://rdfs.org/ns/void#property');

const HTTP_SCHEMA_ORG = 'http://schema.org/';
const HTTPS_SCHEMA_ORG = 'https://schema.org/';

/** QuadTransform that normalizes `http://schema.org/` to `https://schema.org/` in `void:class` and `void:property` objects. */
export const schemaOrgNormalizationTransform: QuadTransform = (quads) =>
  normalizeSchemaOrg(quads);

/**
 * Pipeline plugin that normalizes `http://schema.org/` to `https://schema.org/`
 * in `void:class` and `void:property` quad objects.
 *
 * `void:vocabulary` quads are left unchanged so consumers can see which
 * namespace the source dataset actually uses.
 */
export function schemaOrgNormalizationPlugin(): PipelinePlugin {
  return {
    name: 'schema-org-normalization',
    beforeStageWrite: schemaOrgNormalizationTransform,
  };
}

async function* normalizeSchemaOrg(
  quads: AsyncIterable<Quad>,
): AsyncIterable<Quad> {
  for await (const q of quads) {
    if (
      (q.predicate.equals(VOID_CLASS) || q.predicate.equals(VOID_PROPERTY)) &&
      q.object.termType === 'NamedNode' &&
      q.object.value.startsWith(HTTP_SCHEMA_ORG)
    ) {
      yield quad(
        q.subject,
        q.predicate,
        namedNode(
          HTTPS_SCHEMA_ORG + q.object.value.slice(HTTP_SCHEMA_ORG.length),
        ),
        q.graph,
      );
    } else {
      yield q;
    }
  }
}
