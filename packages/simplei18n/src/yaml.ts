import { parse, parseDocument } from 'yaml';
import type { DocumentOptions, ParseOptions, SchemaOptions, ToJSOptions } from 'yaml';

export const TODO_TAG = '!todo';

const yamlOptions = {
  customTags: [{ tag: TODO_TAG, resolve: (value: string) => value }],
} satisfies ParseOptions & DocumentOptions & SchemaOptions & ToJSOptions;

export const parseYaml = (source: string): unknown => parse(source, yamlOptions);
export const parseYamlDocument = (source: string) => parseDocument(source, yamlOptions);
