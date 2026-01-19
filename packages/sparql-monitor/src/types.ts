/**
 * Configuration for a monitor.
 */
export interface MonitorConfig {
  /** Unique identifier for this monitor. */
  identifier: string;
  /** URL of the SPARQL endpoint to monitor. */
  endpointUrl: URL;
  /** SPARQL query to execute. */
  query: string;
}

/**
 * Result of a single check against a SPARQL endpoint.
 */
export interface CheckResult {
  /** Whether the endpoint responded successfully. */
  success: boolean;
  /** Response time in milliseconds. */
  responseTimeMs: number;
  /** Error message if the check failed. */
  errorMessage: string | null;
  /** Timestamp when the response was received (UTC). */
  observedAt: Date;
}

/**
 * Observation record from the database.
 */
export interface Observation {
  id: string;
  monitor: string;
  observedAt: Date;
  success: boolean;
  responseTimeMs: number;
  errorMessage: string | null;
}

/**
 * Store interface for persisting observations.
 */
export interface ObservationStore {
  /**
   * Get the latest observation for each identifier.
   * Returns a map keyed by identifier.
   */
  getLatest(): Promise<Map<string, Observation>>;

  /**
   * Get a specific observation by ID.
   */
  get(id: string): Promise<Observation | null>;

  /**
   * Save a new observation.
   */
  store(observation: Omit<Observation, 'id'>): Promise<Observation>;

  /**
   * Refresh the latest_observations materialized view.
   */
  refreshLatestObservationsView(): Promise<void>;

  /**
   * Close the database connection.
   */
  close(): Promise<void>;
}
