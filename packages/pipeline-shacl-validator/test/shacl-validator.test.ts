import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Parser } from 'n3';
import type { Quad } from '@rdfjs/types';
import { Dataset } from '@lde/dataset';
import { ShaclValidator } from '../src/shacl-validator.js';

const shapesFile = join(__dirname, 'fixtures', 'shapes.ttl');

const dataset = new Dataset({
  iri: new URL('http://example.org/dataset'),
  distributions: [],
});

function parseFixture(filename: string): Quad[] {
  const parser = new Parser();
  const content = readFileSync(join(__dirname, 'fixtures', filename), 'utf-8');
  return parser.parse(content);
}

describe('ShaclValidator', () => {
  let reportDir: string;

  beforeEach(async () => {
    reportDir = await mkdtemp(join(tmpdir(), 'shacl-validator-test-'));
  });

  it('returns conforms:true for valid data', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });
    const quads = parseFixture('valid.ttl');

    const result = await validator.validate(quads, dataset);

    expect(result.conforms).toBe(true);
    expect(result.violations).toBe(0);

    await rm(reportDir, { recursive: true });
  });

  it('returns violations for invalid data', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });
    const quads = parseFixture('invalid.ttl');

    const result = await validator.validate(quads, dataset);

    expect(result.conforms).toBe(false);
    expect(result.violations).toBeGreaterThan(0);

    await rm(reportDir, { recursive: true });
  });

  it('writes a report file for invalid data', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });
    const quads = parseFixture('invalid.ttl');

    const result = await validator.validate(quads, dataset);

    const files = await readdir(reportDir);
    expect(files.some((f) => f.endsWith('.validation.ttl'))).toBe(true);

    expect(result.message).toMatch(/\.validation\.ttl$/);

    const content = await readFile(join(reportDir, files[0]), 'utf-8');
    expect(content).toContain('shacl');

    await rm(reportDir, { recursive: true });
  });

  it('does not write a report file for valid data', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });
    const quads = parseFixture('valid.ttl');

    await validator.validate(quads, dataset);

    const entries = await readdir(reportDir);
    expect(entries).toHaveLength(0);

    await rm(reportDir, { recursive: true });
  });

  it('accumulates results across validate calls', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });
    const validQuads = parseFixture('valid.ttl');
    const invalidQuads = parseFixture('invalid.ttl');

    await validator.validate(validQuads, dataset);
    await validator.validate(invalidQuads, dataset);

    const report = await validator.report(dataset);
    expect(report.conforms).toBe(false);
    expect(report.violations).toBeGreaterThan(0);
    expect(report.quadsValidated).toBe(validQuads.length + invalidQuads.length);

    await rm(reportDir, { recursive: true });
  });

  it('returns empty report for unseen dataset', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });
    const other = new Dataset({
      iri: new URL('http://example.org/other'),
      distributions: [],
    });

    const report = await validator.report(other);
    expect(report.conforms).toBe(true);
    expect(report.violations).toBe(0);
    expect(report.quadsValidated).toBe(0);
  });

  it('returns conforms:true for empty quads', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });

    const result = await validator.validate([], dataset);

    expect(result.conforms).toBe(true);
    expect(result.violations).toBe(0);
  });

  it('caches shapes across validate calls', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });
    const quads = parseFixture('valid.ttl');

    await validator.validate(quads, dataset);
    await validator.validate(quads, dataset);

    const report = await validator.report(dataset);
    expect(report.conforms).toBe(true);
    expect(report.quadsValidated).toBe(quads.length * 2);

    await rm(reportDir, { recursive: true });
  });
});
