import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    watch: false,
    environment: 'node',
    include: ['{src,test}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      enabled: true,
      reporter: ['text'],
      exclude: [...(configDefaults.coverage.exclude ?? []), '**/index.ts'],
      provider: 'v8' as const,
      thresholds: {
        autoUpdate: true,
      },
    },
  },
});
