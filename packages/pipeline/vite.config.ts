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
          functions: 93.18,
          lines: 93.37,
          branches: 87.53,
          statements: 92.75,
        },
      },
    },
  }),
);
