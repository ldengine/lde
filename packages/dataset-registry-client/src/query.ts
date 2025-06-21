import { Generator, Parser } from 'sparqljs';
import { ldkit, rdf } from 'ldkit/namespaces';
import { DataFactory } from 'n3';

const generator = new Generator();

export function prepareQuery(query: string): string {
  const parsed = new Parser().parse(query);
  if (parsed.type !== 'query' || 'CONSTRUCT' !== parsed.queryType) {
    throw new Error('Must be CONSTRUCT query');
  }

  const template = parsed.template!;
  template.push({
    subject: template[0].subject,
    predicate: DataFactory.namedNode(rdf.type),
    object: DataFactory.namedNode(ldkit.Resource),
  });
  parsed.template = template;

  return generator.stringify(parsed);
}
