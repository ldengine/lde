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
          functions: 80,
          lines: 77.01,
          branches: 83.78,
          statements: 77.01,
        },
      },
    },
  })
);
