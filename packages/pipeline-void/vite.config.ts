/// <reference types='vitest' />
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/pipeline-void',
    test: {
      coverage: {
        thresholds: {
          functions: 94.11,
          lines: 96.29,
          branches: 84,
          statements: 96.36,
        },
      },
    },
  }),
);
