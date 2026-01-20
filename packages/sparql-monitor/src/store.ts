import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.js';
import type { ObservationStore, Observation } from './types.js';

const { observations, latestObservations, refreshLatestObservationsViewSql } =
  schema;

/**
 * PostgreSQL implementation of the ObservationStore interface.
 */
export class PostgresObservationStore implements ObservationStore {
  private client: postgres.Sql;
  private db: PostgresJsDatabase;

  private constructor(connectionString: string) {
    this.client = postgres(connectionString);
    this.db = drizzle(this.client);
  }

  /**
   * Create a new store and initialize the database schema.
   */
  static async create(
    connectionString: string
  ): Promise<PostgresObservationStore> {
    const store = new PostgresObservationStore(connectionString);
    const { pushSchema } = await import('drizzle-kit/api');
    const result = await pushSchema(schema, store.db);
    await result.apply();
    return store;
  }

  async close(): Promise<void> {
    await this.client.end();
  }

  async getLatest(): Promise<Map<string, Observation>> {
    const rows = await this.db.select().from(latestObservations);
    return new Map(rows.map((row) => [row.monitor, row]));
  }

  async get(id: string): Promise<Observation | null> {
    const rows = await this.db
      .select()
      .from(observations)
      .where(eq(observations.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async store(observation: Omit<Observation, 'id'>): Promise<Observation> {
    const rows = await this.db
      .insert(observations)
      .values(observation)
      .returning();
    return rows[0];
  }

  async refreshLatestObservationsView(): Promise<void> {
    await this.db.execute(refreshLatestObservationsViewSql);
  }
}
