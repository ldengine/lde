import { Parser } from '@traqula/parser-sparql-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import {
  AstFactory,
  type QueryConstruct,
  type TripleNesting,
} from '@traqula/rules-sparql-1-1';
import { ldkit, rdf } from 'ldkit/namespaces';

const generator = new Generator();
const F = new AstFactory();

export function prepareQuery(query: string): string {
  const parsed = new Parser().parse(query);
  if (parsed.type !== 'query' || parsed.subType !== 'construct') {
    throw new Error('Must be CONSTRUCT query');
  }

  const construct = parsed as QueryConstruct;
  const firstTriple = construct.template.triples[0] as TripleNesting;

  // Clone the template triples so we don't mutate the WHERE clause
  // (CONSTRUCT WHERE shorthand shares the same BGP object).
  construct.template = F.patternBgp(
    [
      ...construct.template.triples,
      F.triple(
        firstTriple.subject,
        F.termNamed(F.gen(), rdf.type),
        F.termNamed(F.gen(), ldkit.Resource),
      ),
    ],
    F.gen(),
  );

  return generator.generate(construct);
}
