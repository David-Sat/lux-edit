import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/src/__tests__/**/*.test.{ts,tsx}'],
    exclude: [
      '**/.worktrees/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.visual-edit/**',
    ],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        'packages/*/src/**/__tests__/**',
        'packages/*/src/**/*.d.ts',
        'packages/*/src/**/types.ts',
        'packages/*/src/index.ts',
      ],
    },
  },
});
