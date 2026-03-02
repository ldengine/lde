import { describe, it, expect } from 'vitest';
import { DataFactory } from 'n3';
import {
  serializeHydraErrorAsJsonLd,
  createHydraErrorDataset,
} from '../src/hydra-error.js';

const { namedNode } = DataFactory;

const RDF_TYPE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
const HYDRA_ERROR = namedNode('http://www.w3.org/ns/hydra/core#Error');
const HYDRA_TITLE = namedNode('http://www.w3.org/ns/hydra/core#title');
const HYDRA_DESCRIPTION = namedNode(
  'http://www.w3.org/ns/hydra/core#description',
);

describe('serializeHydraErrorAsJsonLd', () => {
  it('should produce @context, @type, and title', () => {
    const json = JSON.parse(serializeHydraErrorAsJsonLd('Not Found'));
    expect(json['@context']).toBe('http://www.w3.org/ns/hydra/core#');
    expect(json['@type']).toBe('Error');
    expect(json['title']).toBe('Not Found');
  });

  it('should include description when provided', () => {
    const json = JSON.parse(
      serializeHydraErrorAsJsonLd('Not Found', 'The resource was not found'),
    );
    expect(json['description']).toBe('The resource was not found');
  });

  it('should omit description when not provided', () => {
    const json = JSON.parse(serializeHydraErrorAsJsonLd('Not Found'));
    expect(json).not.toHaveProperty('description');
  });

  it('should omit @id', () => {
    const json = JSON.parse(serializeHydraErrorAsJsonLd('Not Found'));
    expect(json).not.toHaveProperty('@id');
  });
});

describe('createHydraErrorDataset', () => {
  it('should produce rdf:type hydra:Error triple', () => {
    const dataset = createHydraErrorDataset('Not Found');
    const types = [...dataset.match(null, RDF_TYPE, HYDRA_ERROR)];
    expect(types).toHaveLength(1);
  });

  it('should produce hydra:title triple', () => {
    const dataset = createHydraErrorDataset('Not Found');
    const titles = [...dataset.match(null, HYDRA_TITLE, null)];
    expect(titles).toHaveLength(1);
    expect(titles[0].object.value).toBe('Not Found');
  });

  it('should produce hydra:description triple when provided', () => {
    const dataset = createHydraErrorDataset(
      'Not Found',
      'The resource was not found',
    );
    const descriptions = [...dataset.match(null, HYDRA_DESCRIPTION, null)];
    expect(descriptions).toHaveLength(1);
    expect(descriptions[0].object.value).toBe('The resource was not found');
  });

  it('should omit hydra:description when not provided', () => {
    const dataset = createHydraErrorDataset('Not Found');
    const descriptions = [...dataset.match(null, HYDRA_DESCRIPTION, null)];
    expect(descriptions).toHaveLength(0);
  });

  it('should use a blank node subject', () => {
    const dataset = createHydraErrorDataset('Not Found');
    const quads = [...dataset];
    for (const quad of quads) {
      expect(quad.subject.termType).toBe('BlankNode');
    }
  });
});
