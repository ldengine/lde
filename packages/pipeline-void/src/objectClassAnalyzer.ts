import {
  PerClassAnalyzer,
  type PerClassAnalyzerOptions,
} from './perClassAnalyzer.js';

const QUERY_FILE = 'class-property-object-classes.rq';

/**
 * Per-class analyzer for object class partitions.
 *
 * Detects which classes appear as objects for each property of each class.
 */
export class ObjectClassAnalyzer extends PerClassAnalyzer {
  /**
   * Create an ObjectClassAnalyzer.
   */
  public static async create(
    options?: PerClassAnalyzerOptions
  ): Promise<ObjectClassAnalyzer> {
    const query = await PerClassAnalyzer.loadQuery(QUERY_FILE);
    return new ObjectClassAnalyzer(QUERY_FILE, query, options);
  }
}
