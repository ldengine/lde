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
          lines: 88.88,
          functions: 100,
          branches: 52.17,
          statements: 88.88,
        },
      },
    },
  })
);
