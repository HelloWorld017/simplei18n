import { defineConfig } from 'simplei18n';

export default defineConfig({
  target: {
    include: ['./src/components/**/*.tsx'],
    eager: ['en_US'],
    outDir: './src/i18n',
  },
  mergeTo: './src/i18n/merged.ts',
  locales: ['en_US', 'ko'],
  defaultLocale: 'en_US',
});
