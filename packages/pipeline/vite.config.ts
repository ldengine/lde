/// <reference types='vitest' />
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/pipeline',
    test: {
      coverage: {
        thresholds: {
          functions: 88.88,
          lines: 74.53,
          branches: 83.78,
          statements: 74.53,
        },
      },
    },
  })
);
