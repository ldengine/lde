import { Liquid } from 'liquidjs';
import { dirname } from 'path';
import type { NodeObject } from 'jsonld';

export async function render(
  shapes: NodeObject,
  templatePath: string
): Promise<string> {
  const templatesDir = dirname(templatePath);
  const engine = new Liquid({
    root: templatesDir,
    extname: '.liquid',
  });

  engine.registerFilter(
    'lang',
    (nodes: any | any[] | undefined, language: string) => {
      if (nodes === undefined) {
        return '';
      }

      const filtered = [nodes]
        .flat()
        .filter((node: any) => node['@language'] === language);
      return filtered[0]?.['@value'] ?? '';
    }
  );

  engine.registerFilter('mergePropertiesByPath', (properties: object[]) => {
    const grouped: Record<string, any[]> = properties.reduce(
      (acc: Record<string, any[]>, propertyShape: any) => {
        const path = propertyShape.path;
        acc[path] ??= [];
        acc[path].push(propertyShape);
        return acc;
      },
      {}
    );

    return Object.entries(grouped).map(([_path, propertyShapes]) => {
      const result: { [key: string]: any } = {};
      for (const propertyShape of propertyShapes) {
        for (const key in propertyShape) {
          if (result[key] === undefined && propertyShape[key] !== undefined) {
            result[key] = propertyShape[key];
          }
        }
      }

      return result;
    });
  });

  return engine.renderFile(templatePath, { nodeShapes: shapes['@graph'] });
}
