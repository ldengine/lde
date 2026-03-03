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
          functions: 94.44,
          lines: 97.89,
          branches: 95.65,
          statements: 96.96,
        },
      },
    },
  }),
);
