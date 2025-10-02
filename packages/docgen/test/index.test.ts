import { describe, it } from 'vitest';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { generateDocumentation } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHACL_PATH = join(__dirname, 'fixtures', 'shacl.ttl');
const TEMPLATE_PATH = join(__dirname, 'fixtures', 'template.liquid');
const FRAME_PATH = join(__dirname, '../frames', 'shacl.frame.jsonld');

describe('Integration tests', () => {
  it('should render template', async () => {
    const output = await generateDocumentation(
      SHACL_PATH,
      TEMPLATE_PATH,
      FRAME_PATH
    );

    expect(output.trim()).toBe(`targetClass: http://www.w3.org/ns/dcat#Dataset
    numOfProperties: 3
        path: http://purl.org/dc/terms/title
        minCount: 1
        severity: 
        description: 
    
        path: http://purl.org/dc/terms/alternative
        minCount: 
        severity: 
        description: 
        datatype: xsd:string
    
        path: http://purl.org/dc/terms/description
        minCount: 1
        severity: Info
        description: Require description to be a multilingual string if it exists
        datatype: rdf:langString, xsd:string`);
  });
});
