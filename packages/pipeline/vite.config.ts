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
          functions: 71.42,
          lines: 67.79,
          branches: 66.66,
          statements: 68.33,
        },
      },
    },
  })
);
