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
          autoUpdate: true,
          functions: 93.57,
          lines: 93.95,
          branches: 85.77,
          statements: 93.47,
        },
      },
    },
  })
);
