import {
  boolean,
  index,
  integer,
  pgMaterializedView,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const columns = {
  id: uuid('id').notNull(),
  monitor: text('monitor').notNull(),
  observedAt: timestamp('observed_at', { mode: 'date' }).notNull(),
  success: boolean('success').notNull(),
  responseTimeMs: integer('response_time_ms').notNull(),
  errorMessage: text('error_message'),
};

/**
 * Observations table — maps to SOSA Observation concept.
 */
export const observations = pgTable(
  'observations',
  {
    ...columns,
    id: columns.id.primaryKey().defaultRandom(),
    observedAt: columns.observedAt.defaultNow(),
  },
  (table) => [
    index('observations_monitor_idx').on(table.monitor),
    index('observations_observed_at_idx').on(table.observedAt),
    index('observations_monitor_observed_at_idx').on(
      table.monitor,
      sql`${table.observedAt} DESC`
    ),
  ]
);

/**
 * SQL for refreshing the materialized view.
 */
export const refreshLatestObservationsViewSql = sql`
  REFRESH MATERIALIZED VIEW CONCURRENTLY latest_observations
`;

/**
 * Materialized view for the latest observation per monitor.
 */
export const latestObservations = pgMaterializedView(
  'latest_observations',
  columns
).as(sql`
  SELECT DISTINCT ON (monitor) *
  FROM ${observations}
  ORDER BY monitor, observed_at DESC
`);
