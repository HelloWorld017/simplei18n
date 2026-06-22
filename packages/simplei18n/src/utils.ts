import { I18nAtomKind } from './types';
import type {
  Config,
  I18nAtom,
  I18nInterpolable,
  Locale,
  LocaleKey,
  LocalesConfigInput,
  MergedLocalesConfigInput,
  RawI18n,
  TranslateFunction,
  TranslateFunctionInternal,
  Translations,
  UnknownTranslationDescriptor,
  UnknownTranslateOptions,
  TranslationMap,
  MergedLocalesConfig,
  LocalesResource,
  LocalesConfig,
} from './types';

export const yaml = (strings: TemplateStringsArray, ...values: never[]): RawI18n => {
  if (values.length > 0) {
    throw new Error('simplei18n yaml template literal does not support interpolation.');
  }

  return strings.raw.join('');
};

export const defineI18n = (_source: RawI18n): void => {};
export const defineConfig = <TConfig extends Config>(config: TConfig): TConfig => config;
export const defineLocales = <TConfig extends LocalesConfigInput>(config: TConfig): TConfig =>
  config;

export const defineMergedLocales = (config: MergedLocalesConfigInput): MergedLocalesConfig => ({
  locales: Object.fromEntries(
    Object.entries(config.locales).map(([locale, translations]) => [
      locale,
      Object.assign({}, ...translations),
    ]),
  ) as Record<LocaleKey, Locale>,
  defaultLocale: config.defaultLocale,
});

export const isPromise = <T, TPromise>(value: T | Promise<TPromise>): value is Promise<TPromise> =>
  !!value && typeof value === 'object' && 'then' in value && typeof value.then === 'function';

export const getPluralization = (
  translations: Translations,
  key: string,
  count: number | undefined,
) => {
  if (count === 0 && Object.hasOwn(translations, `${key}.zero`)) {
    return `${key}.zero`;
  }

  if (count === 1 && Object.hasOwn(translations, `${key}.singular`)) {
    return `${key}.singular`;
  }

  if (count !== 1 && Object.hasOwn(translations, `${key}.plural`)) {
    return `${key}.plural`;
  }

  return key;
};

export const createTranslateFunction = <
  TReturnType,
  TTagType,
  TTagReturnType = TReturnType,
>(props: {
  createTag: (tag: TTagType, children: TReturnType, index: number) => TTagReturnType;
  reduce: (args: (null | I18nInterpolable | TTagReturnType)[]) => TReturnType;
  translations: Translations;
}) =>
  ((
    descriptor: UnknownTranslationDescriptor,
    opts: UnknownTranslateOptions<TTagType>,
  ): TReturnType => {
    const key =
      typeof opts.$count === 'number'
        ? getPluralization(props.translations, descriptor.__key!, opts.$count)
        : descriptor.__key!;

    const translation = props.translations[key];
    if (!translation) {
      console.warn('No translation found for key:', key);
      return props.reduce([key]);
    }

    const interpolate = (atoms: I18nAtom[]): TReturnType =>
      props.reduce(
        atoms.map((atom, index) => {
          if (typeof atom === 'string') {
            return atom;
          }

          if (atom[0] === I18nAtomKind.Interpolation) {
            return opts[atom[1]] as I18nInterpolable;
          }

          if (atom[0] === I18nAtomKind.Tag) {
            const tag = opts.$tags?.[atom[1]];
            return props.createTag(tag!, interpolate(atom[2]), index);
          }

          return null;
        }),
      );

    return interpolate(translation);
  }) satisfies TranslateFunctionInternal<TReturnType, TTagType> as TranslateFunction<
    TReturnType,
    TTagType
  >;

export const wrapWithProxy = <T extends object>(value: T, prefix = ''): T & TranslationMap =>
  new Proxy(value, {
    get(target, key) {
      if (key === '__key') {
        return prefix.slice(0, -1);
      }

      if (typeof key === 'string' && !Object.hasOwn(target, key)) {
        return wrapWithProxy({}, `${prefix}${key}.`) as unknown;
      }

      return Reflect.get(target, key) as unknown;
    },
    apply: (...args) => (Reflect.apply as ProxyHandler<T>['apply'])!(...args),
  }) as T & TranslationMap;

export const createI18nResource = (locales: LocalesConfig): LocalesResource => {
  const resourceMap = new Map<LocaleKey, Promise<Translations>>();
  return {
    defaultLocale: locales.defaultLocale,
    load: (lang: LocaleKey) => {
      const promise = resourceMap.get(lang);
      if (promise) {
        return promise;
      }

      if (typeof locales.locales[lang] === 'function') {
        const newPromise = locales.locales[lang]().then(mod => mod.default);
        resourceMap.set(lang, newPromise);
        return newPromise;
      }

      return locales.locales[lang];
    },
  };
};
