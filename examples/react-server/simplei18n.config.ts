import { defineConfig } from 'simplei18n';

export default defineConfig({
  target: {
    include: ['./app/**/*.tsx'],
    eager: true,
    outDir: './app/_i18n',
  },
  mergeTo: './app/_i18n/merged.ts',
  locales: ['en_US', 'ko'],
  defaultLocale: 'en_US',
});
