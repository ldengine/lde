# SPARQL Monitor

Monitor SPARQL endpoints with periodic checks, storing observations in PostgreSQL.

## Installation

```bash
npm install @lde/sparql-monitor
```

## Usage

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
