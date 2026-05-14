import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/pipeline-shacl-sampler',
    test: {
      coverage: {
        thresholds: {
          autoUpdate: true,
          functions: 80,
          lines: 92.42,
          branches: 77.77,
          statements: 89.04,
        },
      },
    },
  }),
);
