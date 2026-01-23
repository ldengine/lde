import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import type { ObservationStore, Observation } from './types.js';

const { observations, latestObservations, refreshLatestObservationsViewSql } =
  schema;

/**
 * PostgreSQL implementation of the ObservationStore interface.
 */
export class PostgresObservationStore implements ObservationStore {
  private db: PostgresJsDatabase;

  private constructor(connectionString: string) {
    this.db = drizzle(connectionString);
  }

  /**
   * Create a new store and initialize the database schema.
   *
   * Uses drizzle-kit's generateMigration to create schema from code.
   * This approach works around a bug in pushSchema where the execute()
   * return format doesn't match what drizzle-kit expects.
   * See: https://github.com/drizzle-team/drizzle-orm/issues/5293
   */
  static async create(
    connectionString: string
  ): Promise<PostgresObservationStore> {
    const store = new PostgresObservationStore(connectionString);
    const { generateDrizzleJson, generateMigration } = await import(
      'drizzle-kit/api-postgres'
    );

    // Generate migration from empty state to our schema
    const empty = await generateDrizzleJson({});
    const target = await generateDrizzleJson(schema, empty.id);
    const migration = await generateMigration(empty, target);

    // Execute each statement, ignoring "already exists" errors for idempotency
    for (const statement of migration) {
      try {
        await store.db.execute(sql.raw(statement));
      } catch (error) {
        // Check both direct error and cause for "already exists"
        const isAlreadyExists = (e: unknown): boolean => {
          if (!(e instanceof Error)) return false;
          if (e.message.includes('already exists')) return true;
          if ('cause' in e) return isAlreadyExists(e.cause);
          return false;
        };
        if (!isAlreadyExists(error)) {
          throw error;
        }
      }
    }

    // Create unique index on materialized view for CONCURRENTLY refresh
    try {
      await store.db.execute(
        sql`CREATE UNIQUE INDEX latest_observations_monitor_idx ON latest_observations (monitor)`
      );
    } catch {
      // Index may already exist
    }

    return store;
  }

  async close(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.db as any).$client.end();
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
