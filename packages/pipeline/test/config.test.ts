import { describe, it, expect } from 'vitest';
import {
  defineConfig,
  normalizeConfig,
  RawPipelineConfig,
} from '../src/config.js';
import { RegistrySelector, ManualDatasetSelection } from '../src/selector.js';

describe('defineConfig', () => {
  it('returns the same config object', () => {
    const config: RawPipelineConfig = {
      selector: { type: 'registry', endpoint: 'http://example.com/sparql' },
      steps: [],
    };
    expect(defineConfig(config)).toBe(config);
  });
});

describe('normalizeConfig', () => {
  it('normalizes registry selector', () => {
    const raw: RawPipelineConfig = {
      selector: { type: 'registry', endpoint: 'http://example.com/sparql' },
    };

    const config = normalizeConfig(raw);

    expect(config.selector).toBeInstanceOf(RegistrySelector);
    expect(config.steps).toEqual([]);
  });

  it('normalizes manual selector', () => {
    const raw: RawPipelineConfig = {
      selector: {
        type: 'manual',
        datasets: [
          'http://example.com/dataset1',
          'http://example.com/dataset2',
        ],
      },
    };

    const config = normalizeConfig(raw);

    expect(config.selector).toBeInstanceOf(ManualDatasetSelection);
  });

  it('throws when selector is missing', () => {
    const raw: RawPipelineConfig = {};

    expect(() => normalizeConfig(raw)).toThrow(
      'Selector configuration is required'
    );
  });

  it('throws when registry endpoint is missing', () => {
    const raw: RawPipelineConfig = {
      selector: { type: 'registry' },
    };

    expect(() => normalizeConfig(raw)).toThrow(
      'Registry selector requires endpoint'
    );
  });

  it('throws when manual datasets are missing', () => {
    const raw: RawPipelineConfig = {
      selector: { type: 'manual', datasets: [] },
    };

    expect(() => normalizeConfig(raw)).toThrow(
      'Manual selector requires datasets'
    );
  });

  it('throws for unknown selector type', () => {
    const raw = {
      selector: { type: 'unknown' as never },
    };

    expect(() => normalizeConfig(raw)).toThrow(
      'Unknown selector type: unknown'
    );
  });

  it('normalizes sparql-query steps', () => {
    const raw: RawPipelineConfig = {
      selector: { type: 'registry', endpoint: 'http://example.com/sparql' },
      steps: [{ type: 'sparql-query', query: 'SELECT * WHERE { ?s ?p ?o }' }],
    };

    const config = normalizeConfig(raw);

    expect(config.steps).toHaveLength(1);
    expect(config.steps[0].identifier).toBe('SELECT * WHERE { ?s ?p ?o }');
  });

  it('normalizes file writer', () => {
    const raw: RawPipelineConfig = {
      selector: { type: 'registry', endpoint: 'http://example.com/sparql' },
      writers: [{ type: 'file', outputDir: '/output' }],
    };

    const config = normalizeConfig(raw);

    expect(config.writers).toHaveLength(1);
    expect(config.writers![0]).toEqual({ type: 'file', outputDir: '/output' });
  });

  it('normalizes SPARQL writer', () => {
    const raw: RawPipelineConfig = {
      selector: { type: 'registry', endpoint: 'http://example.com/sparql' },
      writers: [{ type: 'sparql', endpoint: 'http://example.com/update' }],
    };

    const config = normalizeConfig(raw);

    expect(config.writers).toHaveLength(1);
    expect(config.writers![0].type).toBe('sparql');
    expect(config.writers![0].endpoint).toEqual(
      new URL('http://example.com/update')
    );
  });

  it('throws when file writer missing outputDir', () => {
    const raw: RawPipelineConfig = {
      selector: { type: 'registry', endpoint: 'http://example.com/sparql' },
      writers: [{ type: 'file' }],
    };

    expect(() => normalizeConfig(raw)).toThrow(
      'File writer requires outputDir'
    );
  });

  it('throws when SPARQL writer missing endpoint', () => {
    const raw: RawPipelineConfig = {
      selector: { type: 'registry', endpoint: 'http://example.com/sparql' },
      writers: [{ type: 'sparql' }],
    };

    expect(() => normalizeConfig(raw)).toThrow(
      'SPARQL writer requires endpoint'
    );
  });

  it('preserves QLever config', () => {
    const raw: RawPipelineConfig = {
      selector: { type: 'registry', endpoint: 'http://example.com/sparql' },
      qlever: { mode: 'docker', port: 7001 },
    };

    const config = normalizeConfig(raw);

    expect(config.qlever).toEqual({ mode: 'docker', port: 7001 });
  });
});
