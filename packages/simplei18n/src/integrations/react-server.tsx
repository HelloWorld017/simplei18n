import { AsyncLocalStorage } from 'node:async_hooks';
import { createElement, Fragment } from 'react';
import { createI18nResource, createTranslateFunction, wrapWithProxy } from '@/utils';
import type {
  LocaleKey,
  MergedLocalesConfig,
  TranslateFunctionInternal,
  TranslateOptions,
  TranslationMap,
  Translations,
  UnknownTranslationDescriptor,
} from '@/types';
import type { ComponentType, JSX, PropsWithChildren, ReactNode } from 'react';

type StringTag = (children: string) => string;
type NodesTag = ComponentType<PropsWithChildren> | keyof JSX.IntrinsicElements;

type I18nStore = {
  lang: LocaleKey;
  translations: Translations;
};

const i18nStorage = new AsyncLocalStorage<I18nStore>();

const getI18nStore = () => {
  const store = i18nStorage.getStore();
  if (!store) {
    throw new Error('No i18n registered. Call registerI18n first.');
  }

  return store;
};

export const registerI18n = (mergedLocales: MergedLocalesConfig, lang: string | null) => {
  const nextLang = lang ?? mergedLocales.defaultLocale;
  const translations = mergedLocales.locales[nextLang];
  if (!translations) {
    throw new Error(`No translations found for locale: ${nextLang}`);
  }

  i18nStorage.enterWith({ lang: nextLang, translations });
};

export const useI18n = () => {
  const { lang, translations } = getI18nStore();
  const translateString = wrapWithProxy(
    createTranslateFunction<string, StringTag>({
      createTag: (tag, children) => tag(children),
      reduce: args => args.map(value => value ?? '').join(''),
      translations,
    }),
  );

  const translateNodes = wrapWithProxy(
    createTranslateFunction<ReactNode, NodesTag>({
      createTag: (tag, children, index) =>
        createElement(tag as ComponentType<PropsWithChildren>, { key: index }, children),
      reduce: args => args,
      translations,
    }),
  );

  return {
    lang,
    t: translateNodes,
    ts: translateString,
  };
};

export type GlobalTranslate = {
  <TDescriptor extends UnknownTranslationDescriptor>(
    props: {
      children: TDescriptor;
    } & TranslateOptions<TDescriptor, NodesTag>,
  ): ReactNode;
} & TranslationMap;

type GlobalTranslateInternalProps = {
  $count?: number;
  $tags?: Record<string, NodesTag>;
  children: UnknownTranslationDescriptor;
};

const Translate = (({ children, $count, $tags, ...opts }: GlobalTranslateInternalProps) => {
  const { translations } = getI18nStore();
  const translate = createTranslateFunction<ReactNode, NodesTag>({
    createTag: (tag, children, index) =>
      createElement(tag as ComponentType<PropsWithChildren>, { key: index }, children),
    reduce: args => args,
    translations,
  }) as TranslateFunctionInternal<ReactNode, NodesTag>;
  const nodes = translate(children, { $count, $tags, ...opts });
  return createElement(Fragment, null, nodes);
}) as GlobalTranslate;

export const t = wrapWithProxy({ _: Translate });
export { I18nProvider } from './react';
export { createI18nResource };
