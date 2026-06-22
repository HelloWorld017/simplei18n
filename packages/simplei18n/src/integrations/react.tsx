import { createTranslateFunction, wrapWithProxy } from '@/utils';
import { createContext, createElement, use, useMemo } from 'react';
/** @jsxImportSource react */
import type {
  LocaleKey,
  LocalesConfig,
  TranslateOptions,
  TranslationMap,
  Translations,
  UnknownTranslationDescriptor,
  LocaleDefaultKey,
  TranslateFunctionInternal,
} from '@/types';
import type { ComponentType, JSX, PropsWithChildren, ReactNode } from 'react';

type StringTag = (children: string) => string;
type NodesTag = ComponentType<PropsWithChildren> | keyof JSX.IntrinsicElements;

type I18nResource = {
  defaultLocale: LocaleDefaultKey;
  load: (lang: LocaleKey) => Promise<Translations>;
};

export const createI18nResource = (locales: LocalesConfig): I18nResource => {
  const resourceMap = new Map<LocaleKey, Promise<Translations>>();
  return {
    defaultLocale: locales.defaultLocale,
    load: (lang: LocaleKey) => {
      const promise = resourceMap.get(lang);
      if (promise) {
        return promise;
      }

      const newPromise = locales.locales[lang]().then(mod => mod.default);
      resourceMap.set(lang, newPromise);
      return newPromise;
    },
  };
};

type I18nContextType = {
  lang: LocaleKey;
  resources: I18nResource[];
};

const I18nContext = createContext<I18nContextType | null>(null);

type I18nProviderProps = PropsWithChildren<{
  lang: string | null;
  resource: I18nResource;
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

export const useI18n = () => {
  const ctx = use(I18nContext);
  if (!ctx) {
    throw new Error('No I18nProvider found!');
  }

  const translationsList = ctx?.resources.map(resource => use(resource.load(ctx.lang)));
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
