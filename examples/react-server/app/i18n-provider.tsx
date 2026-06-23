'use client';

import { PropsWithChildren } from 'react';
import { LocaleKey } from 'simplei18n';
import { createI18nResource, I18nProvider } from 'simplei18n/react';
import locales from './_i18n';

const i18nResource = createI18nResource(locales);
export const AppI18nProvider = ({ lang, children }: PropsWithChildren<{ lang: LocaleKey }>) => (
  <I18nProvider lang={lang} resource={i18nResource}>
    {children}
  </I18nProvider>
);
