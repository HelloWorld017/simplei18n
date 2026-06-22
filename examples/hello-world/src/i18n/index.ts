import { defineLocales } from 'simplei18n';

export default defineLocales({
  locales: {
    en_US: import('./_locales/en_US.i18n.yaml'),
    ko: import('./_locales/ko.i18n.yaml'),
  },
  defaultLocale: "en_US",
});
