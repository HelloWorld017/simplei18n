'use client';

import { createI18nResource, I18nProvider } from '@simplei18n/core/react';
import locales from './_i18n';
import type { LocaleKey } from '@simplei18n/core';
import type { PropsWithChildren } from 'react';

const i18nResource = createI18nResource(locales);
export const AppI18nProvider = ({ lang, children }: PropsWithChildren<{ lang: LocaleKey }>) => (
  <I18nProvider lang={lang} resource={i18nResource}>
    {children}
  </I18nProvider>
);
