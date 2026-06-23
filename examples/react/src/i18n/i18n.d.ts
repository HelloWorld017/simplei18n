declare module '@simplei18n/core' {
  import type { TranslationDescriptor } from '@simplei18n/core';

  interface I18nConfig {
    locales: 'en_US' | 'ko';
    defaultLocale: 'en_US';
  }

  interface TranslationMap {
    helloworld: {
      /** Hello updated */
      hello: TranslationDescriptor<never, never>;
      /** Hi */
      hi: TranslationDescriptor<never, never>;
      such: {
        /** Such updated {wow} */
        wow: TranslationDescriptor<'wow', never>;
        /** Such <b>{wow}</b> */
        wow2: TranslationDescriptor<'wow', 'b'>;
      };
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
