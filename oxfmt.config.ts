import { defineConfig } from 'oxfmt';

export default defineConfig({
  singleQuote: true,
  jsxSingleQuote: true,
  quoteProps: 'consistent',
  useTabs: false,
  tabWidth: 2,
  semi: true,
  trailingComma: 'all',
  printWidth: 100,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  insertFinalNewline: true,

  sortImports: {
    groups: ['builtin', 'external', 'internal', 'parent', 'index', 'sibling', 'type'],
    newlinesBetween: false,
    ignoreCase: false,
    internalPattern: ['@/**', '~/**'],
  },
});
