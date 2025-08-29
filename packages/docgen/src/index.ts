import { parseRdfToJsonLd } from './parse.js';
import { frame } from './frame.js';
import { render } from './render.js';

export async function generateDocumentation(
  rdfPath: string,
  templatePath: string,
  framePath: string
): Promise<string> {
  const jsonld = await parseRdfToJsonLd(rdfPath);
  const framed = await frame(jsonld, framePath);

  return render(framed, templatePath);
}
