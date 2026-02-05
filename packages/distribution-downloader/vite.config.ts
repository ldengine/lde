/// <reference types='vitest' />
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/distribution-downloader',
    test: {
      coverage: {
        thresholds: {
          lines: 93.33,
          functions: 100,
          branches: 85.71,
          statements: 93.33,
        },
      },
    },
  })
);
