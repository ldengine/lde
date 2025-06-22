/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    passWithNoTests: true,
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,test}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      enabled: true,
      reporter: ['text'],
      provider: 'v8' as const,
      thresholds: {
        autoUpdate: true,
      },
    },
  },
});
