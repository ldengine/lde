/// <reference types='vitest' />
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/sparql-monitor',
    test: {
      coverage: {
        thresholds: {
          functions: 62.5,
          lines: 76.01,
          branches: 84.21,
          statements: 76.01,
        },
      },
    },
  })
);