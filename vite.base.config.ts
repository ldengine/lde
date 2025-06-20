/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,test}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      enabled: true,
      provider: 'v8' as const,
      thresholds: {
        autoUpdate: true,
      },
    },
  },
});
