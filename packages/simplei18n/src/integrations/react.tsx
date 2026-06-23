/** @jsxImportSource react */
'use client';

import { createI18nResource, createTranslateFunction, isPromise, wrapWithProxy } from '@/utils';
import { createContext, createElement, use, useMemo } from 'react';
import type {
  LocaleKey,
  MergedLocalesConfig,
  TranslateOptions,
  TranslationMap,
  Translations,
  UnknownTranslationDescriptor,
  TranslateFunctionInternal,
  LocalesResource,
} from '@/types';
import type { ComponentType, JSX, PropsWithChildren, ReactNode } from 'react';

type StringTag = (children: string) => string;
type NodesTag = ComponentType<PropsWithChildren> | keyof JSX.IntrinsicElements;

export const registerI18n = (_mergedLocales: MergedLocalesConfig, _lang: string | null): void => {
  throw new Error('registerI18n is only available in react-server environments.');
};

type I18nContextType = {
  lang: LocaleKey;
  resources: LocalesResource[];
};

const I18nContext = createContext<I18nContextType | null>(null);

type I18nProviderProps = PropsWithChildren<{
  lang: string | null;
  resource: LocalesResource;
}>;

export const I18nProvider = ({ lang, resource, children }: I18nProviderProps) => {
  const parentCtx = use(I18nContext);
  const nextI18nContext = useMemo(
    () => ({
      lang: lang ?? parentCtx?.lang ?? resource.defaultLocale,
      resources: [resource, ...(parentCtx?.resources ?? [])],
    }),
    [lang, resource, parentCtx],
  );

  return <I18nContext.Provider value={nextI18nContext}>{children}</I18nContext.Provider>;
};

const useI18nContext = (): I18nContextType => {
  const ctx = use(I18nContext);
  if (!ctx) {
    throw new Error('No I18nProvider found!');
  }

  return ctx;
};

const useTranslationsList = (ctx: I18nContextType) =>
  ctx.resources.map(resource => {
    const result = resource.load(ctx.lang);
    if (isPromise(result)) {
      return use(result);
    }

    return result;
  });

export const I18nLoader = ({ children }: PropsWithChildren) => {
  const ctx = useI18nContext();
  useTranslationsList(ctx);
  return <>{children}</>;
};

export const useI18n = () => {
  const ctx = useI18nContext();
  const translationsList = useTranslationsList(ctx);
  const translations = useMemo(
    () => Object.assign({}, ...translationsList) as Translations,
    [translationsList],
  );

  const translateString = useMemo(
    () =>
      wrapWithProxy(
        createTranslateFunction<string, StringTag>({
          createTag: (tag, children) => tag(children),
          reduce: args => args.map(value => value ?? '').join(''),
          translations,
        }),
      ),
    [translations],
  );

  const translateNodes = useMemo(
    () =>
      wrapWithProxy(
        createTranslateFunction<ReactNode, NodesTag>({
          createTag: (tag, children, index) =>
            createElement(tag as ComponentType<PropsWithChildren>, { key: index }, children),
          reduce: args => args,
          translations,
        }),
      ),
    [translations],
  );

  const i18n = useMemo(
    () => ({
      lang: ctx.lang,
      t: translateNodes,
      ts: translateString,
    }),
    [ctx.lang, translateNodes, translateString],
  );

  return i18n;
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
  const { t } = useI18n();
  const translate = t as TranslateFunctionInternal<ReactNode, NodesTag>;
  const nodes = translate(children, { $count, $tags, ...opts });
  return <>{nodes}</>;
}) as GlobalTranslate;

export const t = wrapWithProxy({ _: Translate });
export { createI18nResource };
