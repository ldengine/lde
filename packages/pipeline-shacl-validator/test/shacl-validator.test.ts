import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

  afterEach(async () => {
    await rm(reportDir, { recursive: true, force: true });
  });

  it('returns conforms:true for valid data', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });
    const quads = parseFixture('valid.ttl');

    const result = await validator.validate(quads, dataset);

    expect(result.conforms).toBe(true);
    expect(result.violations).toBe(0);
  });

  it('returns violations for invalid data', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });
    const quads = parseFixture('invalid.ttl');

    const result = await validator.validate(quads, dataset);

    expect(result.conforms).toBe(false);
    expect(result.violations).toBeGreaterThan(0);
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
  });

  it('does not write a report file for valid data', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });
    const quads = parseFixture('valid.ttl');

    await validator.validate(quads, dataset);

    const entries = await readdir(reportDir);
    expect(entries).toHaveLength(0);
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

  it('truncates report file on first write per dataset', async () => {
    const invalidQuads = parseFixture('invalid.ttl');

    // First run: validate with one validator instance.
    const validator1 = new ShaclValidator({ shapesFile, reportDir });
    await validator1.validate(invalidQuads, dataset);
    const files = await readdir(reportDir);
    const firstContent = await readFile(join(reportDir, files[0]), 'utf-8');

    // Second run: a fresh validator instance writes to the same reportDir.
    const validator2 = new ShaclValidator({ shapesFile, reportDir });
    await validator2.validate(invalidQuads, dataset);
    const secondContent = await readFile(join(reportDir, files[0]), 'utf-8');

    // The second run should have truncated the file, not appended to it.
    // Blank node IDs differ between runs (global counter), so exact string
    // equality isn't possible. A non-truncated (appended) file would be ~2×.
    expect(secondContent.length).toBeLessThan(firstContent.length * 1.1);
  });

  it('caches shapes across validate calls', async () => {
    const validator = new ShaclValidator({ shapesFile, reportDir });
    const quads = parseFixture('valid.ttl');

    await validator.validate(quads, dataset);
    await validator.validate(quads, dataset);

    const report = await validator.report(dataset);
    expect(report.conforms).toBe(true);
    expect(report.quadsValidated).toBe(quads.length * 2);
  });
});
