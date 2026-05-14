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
          functions: 95.45,
          lines: 96.63,
          branches: 84,
          statements: 93.79,
        },
      },
    },
  }),
);
