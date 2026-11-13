import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'fixtures/**', '**/.test-*/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/*/src/**/*.{ts,tsx}', 'packages/*/workbench/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Type safety
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^(_|h|Fragment)$',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Code hygiene
      'no-empty': ['error', { allowEmptyCatch: false }],
      'prefer-const': 'error',
      'no-useless-assignment': 'warn',
      // Hooks discipline across Preact UI files
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Relax explicit `any` inside unit test mocks/spies while keeping source strictly typed
    files: ['packages/*/src/__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': 'off',
    },
  }
);
