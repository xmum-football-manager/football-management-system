import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['lib/match-lifecycle.ts', 'lib/lock-rules.ts']
    },
    include: ['**/__tests__/**/*.test.ts']
  }
});
