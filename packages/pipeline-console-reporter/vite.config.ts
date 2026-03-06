import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/pipeline-console-reporter',
    test: {
      coverage: {
        thresholds: {
          autoUpdate: true,
          functions: 0,
          lines: 9.23,
          branches: 0,
          statements: 9.23,
        },
      },
    },
  }),
);
