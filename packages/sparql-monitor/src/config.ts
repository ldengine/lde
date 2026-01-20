import type { MonitorConfig } from './types.js';

/**
 * Raw config as loaded from file (URL can be string or URL).
 */
export interface RawMonitorConfig {
  /** Unique identifier for this monitor. */
  identifier: string;
  /** URL of the SPARQL endpoint to monitor (string or URL). */
  endpointUrl: string | URL;
  /** SPARQL query to execute. */
  query: string;
}

/**
 * Configuration for the SPARQL monitor.
 */
export interface SparqlMonitorConfig {
  /** PostgreSQL connection string. */
  databaseUrl?: string;
  /** Polling interval in seconds (default: 300). */
  intervalSeconds?: number;
  /** Monitor definitions. */
  monitors: RawMonitorConfig[];
}

/**
 * Type helper for TypeScript config files.
 *
 * @example
 * ```ts
 * // sparql-monitor.config.ts
 * import { defineConfig } from '@lde/sparql-monitor';
 *
 * export default defineConfig({
 *   databaseUrl: process.env.DATABASE_URL,
 *   intervalSeconds: 300,
 *   monitors: [
 *     {
 *       identifier: 'dbpedia',
 *       endpointUrl: new URL('https://dbpedia.org/sparql'),
 *       query: 'ASK { ?s ?p ?o }',
 *     },
 *   ],
 * });
 * ```
 */
export function defineConfig(config: SparqlMonitorConfig): SparqlMonitorConfig {
  return config;
}

/**
 * Normalize config (convert string URLs to URL objects).
 */
export function normalizeConfig(raw: SparqlMonitorConfig): {
  databaseUrl?: string;
  intervalSeconds?: number;
  monitors: MonitorConfig[];
} {
  return {
    ...raw,
    monitors: raw.monitors.map((m) => ({
      ...m,
      endpointUrl:
        typeof m.endpointUrl === 'string'
          ? new URL(m.endpointUrl)
          : m.endpointUrl,
    })),
  };
}
