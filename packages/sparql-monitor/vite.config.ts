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
        exclude: ['**/cli.ts'],
        thresholds: {
          functions: 89.47,
          lines: 73.83,
          branches: 86.04,
          statements: 73.83,
        },
      },
    },
  })
);