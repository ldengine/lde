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
          functions: 92.39,
          lines: 91.61,
          branches: 82.53,
          statements: 91.78,
        },
      },
    },
  })
);
