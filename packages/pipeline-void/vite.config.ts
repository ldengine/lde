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
          functions: 91.66,
          lines: 93.65,
          branches: 69.23,
          statements: 93.65,
        },
      },
    },
  }),
);
