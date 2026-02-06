/// <reference types='vitest' />
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/sparql-writer',
    test: {
      coverage: {
        thresholds: {
          functions: 100,
          lines: 94,
          branches: 78.94,
          statements: 94.11,
        },
      },
    },
  })
);
