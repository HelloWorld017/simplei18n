import { Config, TargetConfig } from "./config";

export interface I18nConfig {}
export interface TranslationKeyMap {}

type ExtractKeys<T, Key extends keyof T = keyof T> = Key extends string
  ? T[Key] extends Record<string, any>
    ? `${Key}.${ExtractKeys<T[Key]>}`
    : Key
  : never;

export type TranslationKeys = ExtractKeys<TranslationKeyMap>;
export type Locale = Record<TranslationKeys, string>;
export type LocaleKeys = I18nConfig extends { locales: infer TLocale } ? (TLocale & string) : string;
export type LocaleDefaultKey = I18nConfig extends { defaultLocale: infer TDefaultLocale }
  ? (TDefaultLocale & LocaleKeys) : LocaleKeys;

export type LocaleModule = Promise<{ default: Locale }>;
export type LocalesConfig = {
  locales: Record<LocaleKeys, LocaleModule>;
  defaultLocale: LocaleDefaultKey;
};

export type RawI18n = string & { __kind?: 'RawI18n' };

export const I18nAtomKind  = {
  Interpolation: 1,
  Tag: 2,
} as const;

export type I18nAtom = string | I18nAtomInterpolation | I18nAtomTag;
export type I18nAtomInterpolation = [typeof I18nAtomKind.Interpolation, string];
export type I18nAtomTag = [typeof I18nAtomKind.Tag, string, I18nAtom[]];

export type { Config, TargetConfig }
