/// <reference types='vitest' />
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/dataset-registry-client',
    test: {
      env: {
        QLEVER_IMAGE: 'adfreiburg/qlever:commit-9352d06',
      },
      coverage: {
        thresholds: {
          lines: 87.38,
          functions: 100,
          branches: 50,
          statements: 87.38,
        },
      },
    },
  })
);
