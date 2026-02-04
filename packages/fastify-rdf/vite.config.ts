/// <reference types='vitest' />
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.base.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/fastify-rdf',
    test: {
      coverage: {
        thresholds: {
          functions: 100,
          lines: 97.89,
          branches: 95,
          statements: 97.89,
        },
      },
    },
  })
);
