#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from 'c12';
import { createRequire } from 'node:module';
import { MonitorService } from './service.js';
import { PostgresObservationStore } from './store.js';
import { normalizeConfig, type SparqlMonitorConfig } from './config.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('sparql-monitor')
  .description('Monitor SPARQL endpoints')
  .version(version);

program
  .command('start')
  .description('Start monitoring all configured endpoints')
  .option('-c, --config <path>', 'Config file path')
  .action(async (options) => {
    const { config: rawConfig } = await loadConfig<SparqlMonitorConfig>({
      name: 'sparql-monitor',
      configFile: options.config,
      dotenv: true,
    });

    if (!rawConfig) {
      console.error('Error: No configuration found.');
      console.error(
        'Create a sparql-monitor.config.ts file or specify --config.'
      );
      process.exit(1);
    }

    const config = normalizeConfig(rawConfig);

    const databaseUrl = config.databaseUrl ?? process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error(
        'Error: databaseUrl required (set in config or DATABASE_URL env).'
      );
      process.exit(1);
    }

    if (config.monitors.length === 0) {
      console.error('Error: No monitors configured.');
      process.exit(1);
    }

    const store = await PostgresObservationStore.create(databaseUrl);
    const service = new MonitorService({
      store,
      monitors: config.monitors,
      intervalSeconds: config.intervalSeconds,
    });

    // Run initial check
    await service.checkAll();

    service.start();
    console.log(`Monitoring ${config.monitors.length} endpoint(s)...`);
    console.log(`Interval: ${config.intervalSeconds ?? 300} seconds`);

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down...');
      service.stop();
      await store.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program
  .command('check [identifier]')
  .description('Run immediate check (all monitors or specific one)')
  .option('-c, --config <path>', 'Config file path')
  .action(async (identifier, options) => {
    const { config: rawConfig } = await loadConfig<SparqlMonitorConfig>({
      name: 'sparql-monitor',
      configFile: options.config,
      dotenv: true,
    });

    if (!rawConfig) {
      console.error('Error: No configuration found.');
      console.error(
        'Create a sparql-monitor.config.ts file or specify --config.'
      );
      process.exit(1);
    }

    const config = normalizeConfig(rawConfig);

    const databaseUrl = config.databaseUrl ?? process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error(
        'Error: databaseUrl required (set in config or DATABASE_URL env).'
      );
      process.exit(1);
    }

    if (config.monitors.length === 0) {
      console.error('Error: No monitors configured.');
      process.exit(1);
    }

    const store = await PostgresObservationStore.create(databaseUrl);
    const service = new MonitorService({
      store,
      monitors: config.monitors,
      intervalSeconds: config.intervalSeconds,
    });

    try {
      if (identifier) {
        const monitor = config.monitors.find(
          (m) => m.identifier === identifier
        );
        if (!monitor) {
          console.error(`Error: Monitor '${identifier}' not found.`);
          console.error(
            'Available monitors:',
            config.monitors.map((m) => m.identifier).join(', ')
          );
          process.exit(1);
        }
        console.log(`Checking ${identifier}...`);
        await service.checkNow(identifier);
        console.log(`Check completed for ${identifier}.`);
      } else {
        console.log(`Checking ${config.monitors.length} endpoint(s)...`);
        await service.checkAll();
        console.log('All checks completed.');
      }
    } finally {
      await store.close();
    }
  });

program.parse();
