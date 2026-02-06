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
          functions: 100,
          lines: 96.15,
          branches: 73.68,
          statements: 96.15,
        },
      },
    },
  })
);
