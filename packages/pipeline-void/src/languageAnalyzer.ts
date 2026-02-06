import {
  PerClassAnalyzer,
  type PerClassAnalyzerOptions,
} from './perClassAnalyzer.js';

const QUERY_FILE = 'class-property-languages.rq';

/**
 * Per-class analyzer for language partitions.
 *
 * Detects which language tags are used for each property of each class.
 */
export class LanguageAnalyzer extends PerClassAnalyzer {
  /**
   * Create a LanguageAnalyzer.
   */
  public static async create(
    options?: PerClassAnalyzerOptions
  ): Promise<LanguageAnalyzer> {
    const query = await PerClassAnalyzer.loadQuery(QUERY_FILE);
    return new LanguageAnalyzer(QUERY_FILE, query, options);
  }
}
