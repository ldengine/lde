import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/pipeline',
    test: {
      fileParallelism: false,
      coverage: {
        thresholds: {
          functions: 91.02,
          lines: 89.66,
          branches: 78.87,
          statements: 89.81,
        },
      },
    },
  })
);
