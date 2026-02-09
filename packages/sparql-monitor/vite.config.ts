import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/sparql-monitor',
    test: {
      coverage: {
        exclude: ['src/cli.ts', 'drizzle.config.ts'],
        thresholds: {
          functions: 96.96,
          lines: 95.23,
          branches: 79.06,
          statements: 93.8,
        },
      },
    },
  })
);
