import { DataFactory, Store } from 'n3';
import type { NamedNode, Quad, Term } from '@rdfjs/types';
import { rdfDereferencer } from 'rdf-dereference';

const { namedNode } = DataFactory;

const SHACL = 'http://www.w3.org/ns/shacl#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

const sh = {
  targetClass: namedNode(`${SHACL}targetClass`),
  property: namedNode(`${SHACL}property`),
  path: namedNode(`${SHACL}path`),
  node: namedNode(`${SHACL}node`),
  class: namedNode(`${SHACL}class`),
  or: namedNode(`${SHACL}or`),
  qualifiedValueShape: namedNode(`${SHACL}qualifiedValueShape`),
};

const rdfFirst = namedNode(`${RDF}first`);
const rdfRest = namedNode(`${RDF}rest`);
const rdfNil = namedNode(`${RDF}nil`);

/**
 * A SHACL NodeShape with `sh:targetClass`, distilled to the information the
 * sampler needs: which paths are declared, and which of those need depth-1
 * follow because their constraint references a nested shape.
 */
export interface TargetShape {
  /** The class targeted by `sh:targetClass`. */
  targetClass: NamedNode;
  /** All distinct `sh:path` IRIs declared on property shapes of this target. */
  paths: NamedNode[];
  /**
   * Subset of {@link paths} whose property shape constrains the value to
   * another shape — via `sh:node`, `sh:class`, `sh:qualifiedValueShape`, or
   * `sh:or` branches that themselves reference a nested shape. The sampler
   * pulls in depth-1 triples reachable along these paths so SHACL nested
   * constraints (e.g. `creator → Person.name`) can validate.
   */
  followPaths: NamedNode[];
}

/**
 * Load the SHACL shapes file and extract its `sh:targetClass` shapes.
 *
 * Multiple NodeShapes can target the same class — they are merged into a
 * single {@link TargetShape} entry per class. Only plain-IRI `sh:path`
 * values are supported; sequence, alternative and inverse paths throw.
 *
 * @param shapesFile URL or local path to the SHACL shapes file.
 *   Any format supported by `rdf-dereference` (Turtle, JSON-LD, N-Triples …).
 */
export async function extractTargetShapes(
  shapesFile: string,
): Promise<TargetShape[]> {
  const store = await loadShapes(shapesFile);

  const byClass = new Map<string, { iri: NamedNode; shapeIris: Term[] }>();
  for (const quad of store.getQuads(null, sh.targetClass, null, null)) {
    if (quad.object.termType !== 'NamedNode') continue;
    const key = quad.object.value;
    const entry = byClass.get(key) ?? {
      iri: quad.object as NamedNode,
      shapeIris: [],
    };
    entry.shapeIris.push(quad.subject);
    byClass.set(key, entry);
  }

  const result: TargetShape[] = [];
  for (const { iri, shapeIris } of byClass.values()) {
    const paths: NamedNode[] = [];
    const followPaths: NamedNode[] = [];
    const seenPath = new Set<string>();
    const seenFollow = new Set<string>();

    for (const shapeIri of shapeIris) {
      for (const propQuad of store.getQuads(
        shapeIri,
        sh.property,
        null,
        null,
      )) {
        const propShape = propQuad.object;
        const path = readPath(store, propShape);
        if (!seenPath.has(path.value)) {
          seenPath.add(path.value);
          paths.push(path);
        }
        if (
          constraintReferencesNestedShape(store, propShape) &&
          !seenFollow.has(path.value)
        ) {
          seenFollow.add(path.value);
          followPaths.push(path);
        }
      }
    }

    result.push({ targetClass: iri, paths, followPaths });
  }

  return result;
}

async function loadShapes(shapesFile: string): Promise<Store> {
  const { data } = await rdfDereferencer.dereference(shapesFile, {
    localFiles: true,
  });
  const store = new Store();
  return new Promise<Store>((resolve, reject) => {
    data
      .on('data', (quad: Quad) => store.addQuad(quad))
      .on('end', () => resolve(store))
      .on('error', (error: Error) => reject(error));
  });
}

function readPath(store: Store, propShape: Term): NamedNode {
  const pathQuads = store.getQuads(propShape, sh.path, null, null);
  if (pathQuads.length !== 1) {
    throw new Error(
      `Property shape ${termLabel(propShape)} must have exactly one sh:path; found ${pathQuads.length}`,
    );
  }
  const pathTerm = pathQuads[0].object;
  if (pathTerm.termType !== 'NamedNode') {
    throw new Error(
      `Unsupported sh:path form on property shape ${termLabel(propShape)}: ` +
        `only plain IRI paths are supported (sequence, alternative and inverse paths are not).`,
    );
  }
  return pathTerm;
}

function constraintReferencesNestedShape(
  store: Store,
  propShape: Term,
): boolean {
  if (store.getQuads(propShape, sh.node, null, null).length > 0) return true;
  if (store.getQuads(propShape, sh.class, null, null).length > 0) return true;
  if (store.getQuads(propShape, sh.qualifiedValueShape, null, null).length > 0)
    return true;
  for (const orQuad of store.getQuads(propShape, sh.or, null, null)) {
    if (orListReferencesNestedShape(store, orQuad.object)) return true;
  }
  return false;
}

function orListReferencesNestedShape(store: Store, listHead: Term): boolean {
  let current: Term = listHead;
  while (
    !(current.termType === 'NamedNode' && current.value === rdfNil.value)
  ) {
    if (current.termType !== 'NamedNode' && current.termType !== 'BlankNode') {
      return false;
    }
    const firsts = store.getQuads(current, rdfFirst, null, null);
    if (firsts.length === 0) return false;
    if (constraintReferencesNestedShape(store, firsts[0].object)) return true;
    const rests = store.getQuads(current, rdfRest, null, null);
    if (rests.length === 0) return false;
    current = rests[0].object;
  }
  return false;
}

function termLabel(term: Term): string {
  return term.termType === 'BlankNode' ? `_:${term.value}` : `<${term.value}>`;
}
