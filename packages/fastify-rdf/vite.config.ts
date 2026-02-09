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
          functions: 87.5,
          lines: 97.05,
          branches: 94.44,
          statements: 97.05,
        },
      },
    },
  })
);
