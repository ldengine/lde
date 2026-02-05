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
          functions: 93.65,
          lines: 91.04,
          branches: 90.78,
          statements: 91.04,
        },
      },
    },
  })
);
