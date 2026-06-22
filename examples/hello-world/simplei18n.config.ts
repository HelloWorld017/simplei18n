import { defineConfig } from 'simplei18n';

export default defineConfig({
  target: {
    include: ['./src/components/**/*.tsx'],
    outDir: './src/i18n',
  },
  locales: ['en_US', 'ko'],
  defaultLocale: 'en_US',
});
