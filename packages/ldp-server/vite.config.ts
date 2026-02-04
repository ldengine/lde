/// <reference types='vitest' />
import {defineConfig, mergeConfig} from 'vite';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/ldp-server',
    test: {
      coverage: {
        thresholds: {
          functions: 100,
          lines: 88.66,
          branches: 85.92,
          statements: 88.66,
        },
      },
    },
  })
);