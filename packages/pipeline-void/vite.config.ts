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
          functions: 51.72,
          lines: 82.47,
          branches: 85.18,
          statements: 82.82,
        },
      },
    },
  }),
);
