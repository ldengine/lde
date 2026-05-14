import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { extractTargetShapes } from '../src/pathExtractor.js';

const shapesFile = join(__dirname, 'fixtures', 'schema-profile.ttl');

describe('extractTargetShapes', () => {
  it('returns one entry per sh:targetClass declared in the SHACL', async () => {
    const shapes = await extractTargetShapes(shapesFile);
    const classes = shapes.map((s) => s.targetClass.value).sort();
    expect(classes).toEqual([
      'https://schema.org/CreativeWork',
      'https://schema.org/Organization',
      'https://schema.org/Person',
      'https://schema.org/Place',
    ]);
  });

  it('merges multiple NodeShapes that target the same class', async () => {
    const shapes = await extractTargetShapes(shapesFile);
    const creativeWork = findByClass(shapes, 'https://schema.org/CreativeWork');
    // CreativeWorkShape declares schema:name + schema:creator + …;
    // CreativeWorkAssociatedMediaCardinalityShape adds qualified shapes on
    // schema:associatedMedia. Both target schema:CreativeWork — paths must be
    // deduplicated across the two shapes.
    const pathValues = creativeWork.paths.map((p) => p.value);
    expect(pathValues).toContain('https://schema.org/name');
    expect(pathValues).toContain('https://schema.org/creator');
    expect(pathValues).toContain('https://schema.org/associatedMedia');
    // associatedMedia appears in both shapes but only once in the merged set.
    expect(
      pathValues.filter((p) => p === 'https://schema.org/associatedMedia'),
    ).toHaveLength(1);
  });

  it('marks paths with nested-shape constraints as follow paths', async () => {
    const shapes = await extractTargetShapes(shapesFile);
    const creativeWork = findByClass(shapes, 'https://schema.org/CreativeWork');
    const followValues = creativeWork.followPaths.map((p) => p.value);

    // sh:or with sh:class/sh:node branches.
    expect(followValues).toContain('https://schema.org/creator');
    expect(followValues).toContain('https://schema.org/associatedMedia');
    expect(followValues).toContain('https://schema.org/contentLocation');
    expect(followValues).toContain('https://schema.org/locationCreated');
    expect(followValues).toContain('https://schema.org/about');
    expect(followValues).toContain('https://schema.org/identifier');
    // Direct sh:node.
    expect(followValues).toContain('https://schema.org/material');
    expect(followValues).toContain('https://schema.org/genre');
    expect(followValues).toContain('https://schema.org/dateCreated');
  });

  it('omits paths whose constraint is purely datatype/nodeKind from follow paths', async () => {
    const shapes = await extractTargetShapes(shapesFile);
    const creativeWork = findByClass(shapes, 'https://schema.org/CreativeWork');
    const followValues = creativeWork.followPaths.map((p) => p.value);

    // schema:name has only sh:datatype rdf:langString — must not appear.
    expect(followValues).not.toContain('https://schema.org/name');
    // schema:description, schema:abstract: pure datatype.
    expect(followValues).not.toContain('https://schema.org/description');
    expect(followValues).not.toContain('https://schema.org/abstract');
    // schema:isPartOf has no value-shape constraint.
    expect(followValues).not.toContain('https://schema.org/isPartOf');
  });

  it('extracts Person nested paths so depth-1 from a CreativeWork creator hits them', async () => {
    const shapes = await extractTargetShapes(shapesFile);
    const person = findByClass(shapes, 'https://schema.org/Person');
    const pathValues = person.paths.map((p) => p.value);
    expect(pathValues).toContain('https://schema.org/name');
    expect(pathValues).toContain('https://schema.org/birthDate');
    expect(pathValues).toContain('https://schema.org/birthPlace');
    expect(pathValues).toContain('https://schema.org/hasOccupation');
  });
});

function findByClass(
  shapes: Awaited<ReturnType<typeof extractTargetShapes>>,
  iri: string,
) {
  const shape = shapes.find((s) => s.targetClass.value === iri);
  if (!shape) throw new Error(`No shape found for ${iri}`);
  return shape;
}
