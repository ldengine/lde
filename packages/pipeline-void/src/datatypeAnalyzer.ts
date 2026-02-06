import {
  PerClassAnalyzer,
  type PerClassAnalyzerOptions,
} from './perClassAnalyzer.js';

const QUERY_FILE = 'class-property-datatypes.rq';

/**
 * Per-class analyzer for datatype partitions.
 *
 * Detects which datatypes are used for each property of each class.
 */
export class DatatypeAnalyzer extends PerClassAnalyzer {
  /**
   * Create a DatatypeAnalyzer.
   */
  public static async create(
    options?: PerClassAnalyzerOptions
  ): Promise<DatatypeAnalyzer> {
    const query = await PerClassAnalyzer.loadQuery(QUERY_FILE);
    return new DatatypeAnalyzer(QUERY_FILE, query, options);
  }
}
