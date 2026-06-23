import { defineLocales } from 'simplei18n';
import defaultEnUS from './_locales/en_US.i18n.yaml';
import defaultKo from './_locales/ko.i18n.yaml';

export default defineLocales({
  locales: {
    en_US: defaultEnUS,
    ko: defaultKo,
  },
  defaultLocale: 'en_US',
});
