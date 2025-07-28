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
        QLEVER_IMAGE: 'adfreiburg/qlever:commit-45b05e1',
      },
      coverage: {
        thresholds: {
          lines: 81.08,
          functions: 81.81,
          branches: 45,
          statements: 81.08,
        },
      },
    },
  })
);
