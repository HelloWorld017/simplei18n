import type { TargetConfig, Config } from '@simplei18n/cli';

export type LocaleModule = Promise<{ default: Record<string, string> }>;
export type LocalesConfig<TLocale extends string = string> = {
  locales: Record<TLocale, LocaleModule>;
  defaultLocale: TLocale;
};

export interface TranslationConfig {}
export interface TranslationKey {}

export const yaml = (strings: TemplateStringsArray, ...values: never[]): string => {
  if (values.length > 0) {
    throw new Error('simplei18n yaml template literal does not support interpolation.');
  }

  return strings.raw.join('');
};

export const defineI18n = (source: string): string => source;
export const defineConfig = <TConfig extends Config>(config: TConfig): TConfig => config;
export const defineLocales = <TLocale extends string>(config: LocalesConfig<TLocale>): LocalesConfig<TLocale> => config;
export type { TargetConfig, Config };
