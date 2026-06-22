import type { Config, TargetConfig } from './config';

export interface I18nConfig {}
export interface TranslationMap {}
export type UnknownTranslationDescriptor = TranslationDescriptor<string, string>;
export type TranslationDescriptor<TInterpolations extends string, TTags extends string> = {
  __kind?: 'TranslationDescriptor';
  __interpolations?: TInterpolations;
  __tags?: TTags;
  __key?: string;
};

export const I18nAtomKind = {
  Interpolation: 1,
  Tag: 2,
} as const;

export type I18nAtom = string | I18nAtomInterpolation | I18nAtomTag;
export type I18nAtomInterpolation = [typeof I18nAtomKind.Interpolation, string];
export type I18nAtomTag = [typeof I18nAtomKind.Tag, string, I18nAtom[]];
export type I18nInterpolable = string | number | bigint;

export type RawI18n = string & { __kind?: 'RawI18n' };

export type Translation = I18nAtom[];
export type Translations = Record<string, Translation>;

export type LocaleKey = I18nConfig extends { locales: infer TLocale } ? TLocale & string : string;
export type LocaleDefaultKey = I18nConfig extends { defaultLocale: infer TDefaultLocale }
  ? TDefaultLocale & LocaleKey
  : LocaleKey;

export type LocaleModule = { default: Translations };
export type LocalesConfig = {
  locales: Record<LocaleKey, () => Promise<LocaleModule>>;
  defaultLocale: LocaleDefaultKey;
};

type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

export type TranslateOptions<TDescriptor extends UnknownTranslationDescriptor, TTagType> = Simplify<
  { $count?: number } & (TDescriptor['__tags'] & string extends never
    ? {}
    : { $tags: { [K in TDescriptor['__tags'] & string]: TTagType } }) &
    (TDescriptor['__interpolations'] & string extends never
      ? {}
      : { [K in TDescriptor['__interpolations'] & string]: I18nInterpolable })
>;

export type UnknownTranslateOptions<TTagType> = {
  $count?: number;
  $tags?: Record<string, TTagType>;
} & {
  [K in string]: unknown;
};

export type TranslateFunction<TReturnType, TTagType> = {
  (
    key: TranslationDescriptor<never, never>,
    options?: TranslateOptions<TranslationDescriptor<never, never>, TTagType>,
  ): string;
  <TDescriptor extends UnknownTranslationDescriptor>(
    key: TDescriptor,
    options: TranslateOptions<TDescriptor, TReturnType>,
  ): string;
};

export type TranslateFunctionInternal<TReturnType, TTagType> = (
  descriptor: UnknownTranslationDescriptor,
  opts: UnknownTranslateOptions<TTagType>,
) => TReturnType;

export type { Config, TargetConfig };
