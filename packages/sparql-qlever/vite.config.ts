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
          lines: 76.92,
          functions: 100,
          branches: 43.47,
          statements: 76.92,
        },
      },
    },
  })
);
