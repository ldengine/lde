# SPARQL Monitor

Monitor SPARQL endpoints with periodic checks, storing observations in PostgreSQL.

## Installation

```bash
npm install @lde/sparql-monitor
```

## CLI Usage

The easiest way to use the monitor is via the CLI with a configuration file.

### Quick Start

1. Create a configuration file (TypeScript, JavaScript, JSON, or YAML)
2. Run the monitor

```bash
# Start continuous monitoring
npx sparql-monitor start

# Run a one-off check
npx sparql-monitor check

# Check a specific monitor
npx sparql-monitor check dbpedia

# Use a custom config path
npx sparql-monitor start --config ./configs/production.config.ts
```

### TypeScript Config (`sparql-monitor.config.ts`)

```typescript
import { defineConfig } from '@lde/sparql-monitor';

export default defineConfig({
  databaseUrl: process.env.DATABASE_URL,
  intervalSeconds: 300,
  monitors: [
    {
      identifier: 'dbpedia',
      endpointUrl: new URL('https://dbpedia.org/sparql'),
      query: 'ASK { ?s ?p ?o }',
    },
    {
      identifier: 'wikidata',
      endpointUrl: new URL('https://query.wikidata.org/sparql'),
      query: 'SELECT * WHERE { ?s ?p ?o } LIMIT 1',
    },
  ],
});
```

### YAML Config (`sparql-monitor.config.yaml`)

```yaml
databaseUrl: ${DATABASE_URL}
intervalSeconds: 300
monitors:
  - identifier: dbpedia
    endpointUrl: https://dbpedia.org/sparql
    query: ASK { ?s ?p ?o }
  - identifier: wikidata
    endpointUrl: https://query.wikidata.org/sparql
    query: SELECT * WHERE { ?s ?p ?o } LIMIT 1
```

### Environment Variables

Create a `.env` file for sensitive configuration:

```
DATABASE_URL=postgres://user:pass@localhost:5432/monitoring
```

The CLI automatically loads `.env` files.

### Config Auto-Discovery

The CLI searches for configuration in this order:
1. `sparql-monitor.config.{ts,mts,js,mjs,json,yaml,yml}`
2. `.sparql-monitorrc`
3. `package.json` → `"sparql-monitor"` key

## Programmatic Usage

```typescript
import {
  MonitorService,
  PostgresObservationStore,
  type MonitorConfig,
} from '@lde/sparql-monitor';

// Define monitors
const monitors: MonitorConfig[] = [
  {
    identifier: 'dbpedia',
    endpointUrl: new URL('https://dbpedia.org/sparql'),
    query: 'ASK { ?s ?p ?o }',
  },
  {
    identifier: 'wikidata',
    endpointUrl: new URL('https://query.wikidata.org/sparql'),
    query: 'SELECT * WHERE { ?s ?p ?o } LIMIT 1',
  },
];

// Create store (initializes database schema automatically)
const store = await PostgresObservationStore.create(
  'postgres://user:pass@localhost:5432/db'
);

// Create service with polling interval
const service = new MonitorService({
  store,
  monitors,
  intervalSeconds: 300, // Check all endpoints every 5 minutes
});

// Start periodic monitoring
service.start();

// Or perform immediate checks
await service.checkAll();
await service.checkNow('dbpedia');

// Get latest observations
const observations = await store.getLatest();
for (const [identifier, observation] of observations) {
  console.log(
    `${identifier}: ${observation.success ? 'OK' : 'FAIL'} (${
      observation.responseTimeMs
    }ms)`
  );
}

// Stop monitoring and close the store
service.stop();
await store.close();
```

## Database Initialisation

`PostgresObservationStore.create()` automatically initializes the database schema:

- `observations` table for storing check results
- `latest_observations` materialized view for efficient queries
- Required indexes

This is idempotent and safe to call on every startup.

## Query Types

The monitor supports ASK, SELECT, and CONSTRUCT queries. The check is considered successful if the query executes without error.
