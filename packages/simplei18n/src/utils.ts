import { Config, LocalesConfig, RawI18n } from "./types";

export const yaml = (strings: TemplateStringsArray, ...values: never[]): RawI18n => {
  if (values.length > 0) {
    throw new Error('simplei18n yaml template literal does not support interpolation.');
  }

  return strings.raw.join('');
};

export const defineI18n = (_source: RawI18n): void => {};
export const defineConfig = <TConfig extends Config>(config: TConfig): TConfig => config;
export const defineLocales = (config: LocalesConfig): LocalesConfig => config;

