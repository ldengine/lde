import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/pipeline-shacl-validator',
    test: {
      coverage: {
        thresholds: {
          autoUpdate: true,
          functions: 100,
          lines: 97.82,
          branches: 92.85,
          statements: 95.91,
        },
      },
    },
  }),
);
