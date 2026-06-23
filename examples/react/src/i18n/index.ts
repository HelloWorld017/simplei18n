import { defineLocales } from 'simplei18n';
import defaultEnUS from './_locales/en_US.i18n.yaml';

export default defineLocales({
  locales: {
    en_US: defaultEnUS,
    ko: () => import('./_locales/ko.i18n.yaml'),
  },
  defaultLocale: 'en_US',
});
