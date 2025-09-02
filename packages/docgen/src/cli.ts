#!/usr/bin/env node

import { Command } from 'commander';
import { generateDocumentation } from './index.js';
import packageJson from '../package.json' with { type: 'json' };
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name('docgen')
  .description('Generate documentation from RDF data')
  .version(packageJson.version);

program
  .command('from-shacl')
  .description('Generate documentation from a SHACL shapes file')
  .argument(
    '<shacl-file>',
    'Path to SHACL shapes file (in any RDF serialization format)'
  )
  .argument(
    '<template-file>',
    'Path to Liquid template file'
  )
  .option(
'-f --frame <json-ld-frame-file>',
    'Path to a JSON-LD Frame file',
    __dirname + '/../frames/shacl.frame.jsonld'
  )
  .addHelpText(
    'after',
    `
Example:
  $ npx @lde/docgen@latest from-shacl shacl.ttl template.liquid
    `
  )
  .action(async (rdfFile: string, templateFile: string, { frame }) => {
    try {
      const documentation = await generateDocumentation(rdfFile, templateFile, frame);
      console.log(documentation);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

program.parse();

