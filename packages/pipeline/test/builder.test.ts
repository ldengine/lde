import { describe, it, expect } from 'vitest';
import {
  PipelineBuilder,
  registry,
  manual,
  fileWriter,
  sparqlWriter,
} from '../src/builder.js';
import { ManualDatasetSelection, RegistrySelector } from '../src/selector.js';

describe('PipelineBuilder', () => {
  describe('create', () => {
    it('creates a new builder instance', () => {
      const builder = PipelineBuilder.create();
      expect(builder).toBeInstanceOf(PipelineBuilder);
    });
  });

  describe('build', () => {
    it('throws when selector is not set', () => {
      const builder = PipelineBuilder.create();
      expect(() => builder.build()).toThrow('Selector is required');
    });

    it('builds config with selector and steps', () => {
      const selector = manual(new URL('http://example.com/dataset'));
      const config = PipelineBuilder.create()
        .withSelector(selector)
        .addStep({
          identifier: 'test',
          execute: async () => ({ data: [] } as never),
        })
        .build();

      expect(config.selector).toBe(selector);
      expect(config.steps).toHaveLength(1);
    });

    it('supports addSteps for multiple steps', () => {
      const selector = manual(new URL('http://example.com/dataset'));
      const step1 = { identifier: 'step1', execute: async () => ({} as never) };
      const step2 = { identifier: 'step2', execute: async () => ({} as never) };

      const config = PipelineBuilder.create()
        .withSelector(selector)
        .addSteps(step1, step2)
        .build();

      expect(config.steps).toHaveLength(2);
    });

    it('includes QLever config when set', () => {
      const selector = manual(new URL('http://example.com/dataset'));
      const config = PipelineBuilder.create()
        .withSelector(selector)
        .withQlever({ mode: 'docker', image: 'qlever:latest', port: 7002 })
        .build();

      expect(config.qlever).toEqual({
        mode: 'docker',
        image: 'qlever:latest',
        port: 7002,
      });
    });

    it('includes writers when set', () => {
      const selector = manual(new URL('http://example.com/dataset'));
      const config = PipelineBuilder.create()
        .withSelector(selector)
        .addWriter(fileWriter({ outputDir: 'output' }))
        .build();

      expect(config.writers).toHaveLength(1);
      expect(config.writers![0]).toEqual({ type: 'file', outputDir: 'output' });
    });
  });
});

describe('Helper functions', () => {
  describe('registry', () => {
    it('creates a RegistrySelector with URL', () => {
      const selector = registry(new URL('http://example.com/sparql'));
      expect(selector).toBeInstanceOf(RegistrySelector);
    });

    it('creates a RegistrySelector with string', () => {
      const selector = registry('http://example.com/sparql');
      expect(selector).toBeInstanceOf(RegistrySelector);
    });
  });

  describe('manual', () => {
    it('creates a ManualDatasetSelection', () => {
      const selector = manual(
        new URL('http://example.com/dataset1'),
        new URL('http://example.com/dataset2')
      );
      expect(selector).toBeInstanceOf(ManualDatasetSelection);
    });
  });

  describe('fileWriter', () => {
    it('creates file writer config', () => {
      const config = fileWriter({ outputDir: '/output' });
      expect(config).toEqual({ type: 'file', outputDir: '/output' });
    });
  });

  describe('sparqlWriter', () => {
    it('creates SPARQL writer config', () => {
      const endpoint = new URL('http://example.com/sparql');
      const config = sparqlWriter({ endpoint });
      expect(config).toEqual({ type: 'sparql', endpoint });
    });
  });
});
