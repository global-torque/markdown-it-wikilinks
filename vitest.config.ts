import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        statements: 90,
        lines: 90,
        branches: 85,
        'src/escape.ts': {
          branches: 100,
        },
      },
    },
  },
});
