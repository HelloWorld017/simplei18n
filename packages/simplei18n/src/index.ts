import type { TargetConfig, Config } from '@simplei18n/cli';

export interface TranslationConfig {}
export interface TranslationKey {}

type ExtractKeys<T, Key extends keyof T = keyof T> = Key extends string
  ? T[Key] extends Record<string, any>
    ? `${Key}.${ExtractKeys<T[Key]>}`
    : Key
  : never;

export type TranslationKeys = ExtractKeys<TranslationKey>;
export type Locale = Record<TranslationKeys, string>;
export type LocaleKeys = TranslationConfig extends { locales: infer TLocale } ? (TLocale & string) : string;
export type LocaleDefaultKey = TranslationConfig extends { defaultLocale: infer TDefaultLocale }
  ? (TDefaultLocale & LocaleKeys) : LocaleKeys;

export type LocaleModule = Promise<{ default: Locale }>;
export type LocalesConfig = {
  locales: Record<LocaleKeys, LocaleModule>;
  defaultLocale: LocaleDefaultKey;
};

export type RawI18n = string & { __kind?: 'RawI18n' };
export const yaml = (strings: TemplateStringsArray, ...values: never[]): RawI18n => {
  if (values.length > 0) {
    throw new Error('simplei18n yaml template literal does not support interpolation.');
  }

  return strings.raw.join('');
};

export const defineI18n = (_source: RawI18n): void => {};
export const defineConfig = <TConfig extends Config>(config: TConfig): TConfig => config;
export const defineLocales = (config: LocalesConfig): LocalesConfig => config;
export type { TargetConfig, Config };
