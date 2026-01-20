import { describe, it, expect } from 'vitest';
import { defineConfig, normalizeConfig } from '../src/config.js';

describe('defineConfig', () => {
  it('returns the config as-is', () => {
    const config = {
      databaseUrl: 'postgres://localhost/test',
      intervalSeconds: 60,
      monitors: [
        {
          identifier: 'test',
          endpointUrl: 'https://example.org/sparql',
          query: 'ASK { ?s ?p ?o }',
        },
      ],
    };

    expect(defineConfig(config)).toEqual(config);
  });
});

describe('normalizeConfig', () => {
  it('converts string URLs to URL objects', () => {
    const raw = {
      databaseUrl: 'postgres://localhost/test',
      intervalSeconds: 300,
      monitors: [
        {
          identifier: 'test',
          endpointUrl: 'https://example.org/sparql',
          query: 'ASK { ?s ?p ?o }',
        },
      ],
    };

    const normalized = normalizeConfig(raw);

    expect(normalized.databaseUrl).toBe('postgres://localhost/test');
    expect(normalized.intervalSeconds).toBe(300);
    expect(normalized.monitors[0].identifier).toBe('test');
    expect(normalized.monitors[0].endpointUrl).toBeInstanceOf(URL);
    expect(normalized.monitors[0].endpointUrl.href).toBe(
      'https://example.org/sparql'
    );
  });

  it('preserves URL objects', () => {
    const url = new URL('https://example.org/sparql');
    const raw = {
      monitors: [
        {
          identifier: 'test',
          endpointUrl: url,
          query: 'ASK { ?s ?p ?o }',
        },
      ],
    };

    const normalized = normalizeConfig(raw);

    expect(normalized.monitors[0].endpointUrl).toBe(url);
  });
});
