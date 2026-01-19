import { CronJob } from 'cron';
import { SparqlMonitor } from './monitor.js';
import type { ObservationStore, MonitorConfig } from './types.js';

export interface MonitorServiceOptions {
  /** Store for persisting observations. */
  store: ObservationStore;
  /** Monitor configurations. */
  monitors: MonitorConfig[];
  /** Polling interval in seconds (default: 300). */
  intervalSeconds?: number;
  /** Optional custom monitor instance. */
  sparqlMonitor?: SparqlMonitor;
}

/**
 * Orchestrates monitoring of multiple SPARQL endpoints.
 */
export class MonitorService {
  private readonly store: ObservationStore;
  private readonly sparqlMonitor: SparqlMonitor;
  private readonly configs: MonitorConfig[];
  private readonly intervalSeconds: number;
  private job: CronJob | null = null;

  constructor(options: MonitorServiceOptions) {
    this.store = options.store;
    this.sparqlMonitor = options.sparqlMonitor ?? new SparqlMonitor();
    this.configs = options.monitors;
    this.intervalSeconds = options.intervalSeconds ?? 300;
  }

  /**
   * Perform an immediate check for a monitor.
   */
  async checkNow(identifier: string): Promise<void> {
    const config = this.configs.find((c) => c.identifier === identifier);
    if (!config) {
      throw new Error(`Monitor not found: ${identifier}`);
    }
    await this.performCheck(config);
    await this.refreshView();
  }

  /**
   * Perform an immediate check for all monitors.
   */
  async checkAll(): Promise<void> {
    await Promise.all(this.configs.map((config) => this.performCheck(config)));
    await this.refreshView();
  }

  /**
   * Start monitoring all configured endpoints.
   */
  start(): void {
    if (!this.job) {
      const cronExpression = this.secondsToCron(this.intervalSeconds);
      this.job = new CronJob(cronExpression, () => this.checkAll());
      this.job.start();
    }
  }

  /**
   * Stop monitoring.
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
  }

  /**
   * Check whether monitoring is running.
   */
  isRunning(): boolean {
    return this.job !== null;
  }

  /**
   * Convert seconds to a cron expression.
   */
  private secondsToCron(seconds: number): string {
    if (seconds < 60) {
      return `*/${seconds} * * * * *`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `0 */${minutes} * * * *`;
    }
    const hours = Math.floor(minutes / 60);
    return `0 0 */${hours} * * *`;
  }

  private async performCheck(config: MonitorConfig): Promise<void> {
    const result = await this.sparqlMonitor.check(
      config.endpointUrl,
      config.query
    );
    await this.store.store({
      monitor: config.identifier,
      ...result,
    });
  }

  private async refreshView(): Promise<void> {
    try {
      await this.store.refreshLatestObservationsView();
    } catch {
      // View refresh failure is not critical
    }
  }
}
