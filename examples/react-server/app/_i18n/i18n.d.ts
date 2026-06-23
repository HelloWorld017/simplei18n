declare module '@simplei18n/core' {
  import type { TranslationDescriptor } from '@simplei18n/core';

  interface I18nConfig {
    locales: 'en_US' | 'ko';
    defaultLocale: 'en_US';
  }

  interface TranslationMap {
    home: {
      /** Client clicks */
      clientCount: TranslationDescriptor<never, never>;
      /** Increment on client */
      clientIncrement: TranslationDescriptor<never, never>;
      /** Client component */
      clientTitle: TranslationDescriptor<never, never>;
      /** Current locale: {lang} */
      currentLocale: TranslationDescriptor<'lang', never>;
      /** This text is rendered on the <strong>server</strong> with {library}. */
      lead: TranslationDescriptor<'library', 'strong'>;
      /** English */
      switchEnglish: TranslationDescriptor<never, never>;
      /** Korean */
      switchKorean: TranslationDescriptor<never, never>;
      /** simplei18n react-server */
      title: TranslationDescriptor<never, never>;
    };
  }
}

declare global {
  module '*.i18n.yaml' {
    import type { Locale } from '@simplei18n/core';
    const locale: Locale;
    export default locale;
  }
}

export {};
