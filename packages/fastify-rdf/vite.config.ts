import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/fastify-rdf',
    test: {
      coverage: {
        thresholds: {
          autoUpdate: true,
          functions: 93.33,
          lines: 95.45,
          branches: 90.32,
          statements: 95.58,
        },
      },
    },
  }),
);
