declare module 'simplei18n' {
  interface TranslationConfig {
    locales: "en_US" | "ko";
    defaultLocale: "en_US";
  }

  interface TranslationKey {
    helloworld: {
      /** Hi */
      hi: string;
    };
  }
}

declare global {
  declare module '*.i18n.yaml' {
    import type { Locale } from 'simplei18n';
    declare const locale: Locale;
    export default locale;
  }
}

export {}
