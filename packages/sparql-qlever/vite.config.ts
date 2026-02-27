import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/sparql-monitor',
    test: {
      env: {
        QLEVER_IMAGE: 'adfreiburg/qlever:commit-9352d06',
      },
      coverage: {
        thresholds: {
          lines: 77.5,
          functions: 100,
          branches: 45.45,
          statements: 77.5,
        },
      },
    },
  }),
);
