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
          autoUpdate: true,
          lines: 90.32,
          functions: 66.66,
          branches: 100,
          statements: 90.32,
        },
      },
    },
  })
);
