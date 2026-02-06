/// <reference types='vitest' />
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/sparql-monitor',
    test: {
      env: {
        QLEVER_IMAGE: 'adfreiburg/qlever:commit-f35a290',
      },
      coverage: {
        thresholds: {
          lines: 79.06,
          functions: 100,
          branches: 51.72,
          statements: 79.06,
        },
      },
    },
  })
);
