import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['eslint', 'typescript', 'oxc', 'import', 'react', 'jsx-a11y'],

  env: {
    browser: true,
    node: true,
    builtin: true,
  },

  options: {
    typeAware: true,
    reportUnusedDisableDirectives: 'warn',
  },

  categories: {
    correctness: 'error',
    suspicious: 'warn',
  },

  rules: {
    'typescript/consistent-type-imports': 'error',
    'typescript/no-empty-interface': 'off',
    'typescript/no-empty-object-type': 'off',
    'typescript/no-misused-promises': 'off',
    'typescript/no-non-null-assertion': 'off',
    'typescript/no-unsafe-type-assertion': 'off',
    'no-empty-function': 'off',
    'no-underscore-dangle': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    'import/no-named-as-default-member': 'off',
    'import/prefer-default-export': 'off',
    'jsx-a11y/label-has-associated-control': ['error', { controlComponents: ['Toggle'] }],

    'react/no-unknown-property': 'off',
    'react/react-in-jsx-scope': 'off',

    'arrow-body-style': ['error', 'as-needed'],
    'eqeqeq': ['error', 'always'],
    'class-methods-use-this': 'off',
    'curly': ['error', 'all'],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'prefer-const': 'off',
    'prefer-promise-reject-errors': 'off',
  },

  overrides: [
    {
      files: ['**/*.d.ts'],
      rules: {
        'no-var': 'off',
      },
    },
  ],
});
