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
          functions: 92.1,
          lines: 87.22,
          branches: 91.56,
          statements: 87.22,
        },
      },
    },
  })
);
