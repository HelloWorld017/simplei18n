import fs from 'node:fs/promises';
import path from 'node:path';

import { parseScope } from './parser';
import fg from 'fast-glob';
import { parse } from 'yaml';
import { parseSync } from 'oxc-parser';
import {TargetConfig} from './config';

type SourceEntry = {
  key: string;
  value: string;
};

const JS_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.mts', '.cjs', '.cts']);
const YAML_EXTENSIONS = new Set(['.yml', '.yaml']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const joinKey = (...parts: Array<string | undefined>): string =>
  parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map(part => part.trim().replace(/^\.+|\.+$/g, ''))
    .filter(part => part.length > 0)
    .join('.');

const flattenYamlValue = (value: unknown, prefix = ''): SourceEntry[] => {
  if (typeof value === 'string') {
    if (!prefix) {
      throw new Error('YAML source root must be an object.');
    }

    return [{ key: prefix, value }];
  }

  if (!isObject(value)) {
    throw new Error(`YAML source value at '${prefix || '<root>'}' must be a string or object.`);
  }

  return Object.keys(value).flatMap(key => flattenYamlValue(value[key], joinKey(prefix, key)));
};

const parseYamlSource = (source: string, filePath: string, targetScope?: string): SourceEntry[] => {
  const sourceScope = parseScope(source);
  const body = parse(source) ?? {};
  const entries = flattenYamlValue(body);

  return entries.map(entry => ({
    key: joinKey(targetScope, sourceScope, entry.key),
    value: entry.value
  })).map(entry => {
    if (!entry.key) {
      throw new Error(`Empty i18n key found in ${filePath}.`);
    }

    return entry;
  });
};

const getTemplateLiteralText = (node: Record<string, unknown>, filePath: string): string => {
  const expressions = Array.isArray(node.expressions) ? node.expressions : [];
  if (expressions.length > 0) {
    throw new Error(`simplei18n yaml template literal interpolation is not supported in ${filePath}.`);
  }

  const quasis = Array.isArray(node.quasis) ? node.quasis : [];
  return quasis.map(quasi => {
    if (!isObject(quasi) || !isObject(quasi.value) || typeof quasi.value.raw !== 'string') {
      throw new Error(`Cannot read yaml template literal in ${filePath}.`);
    }

    return quasi.value.raw;
  }).join('');
};

const isIdentifier = (node: unknown, name: string): boolean =>
  isObject(node) && node.type === 'Identifier' && node.name === name;

const collectDefineI18nSources = (source: string, filePath: string): string[] => {
  const ast = parseSync(filePath, source, {
    sourceType: 'module',
    lang: filePath.endsWith('x') ? 'tsx' : 'ts'
  } as never) as unknown;

  const sources: string[] = [];
  const visit = (node: unknown) => {
    if (!isObject(node)) {
      return;
    }

    if (node.type === 'CallExpression' && isIdentifier(node.callee, 'defineI18n')) {
      const args = Array.isArray(node.arguments) ? node.arguments : [];
      const firstArg = args[0];
      if (!isObject(firstArg) || firstArg.type !== 'TaggedTemplateExpression' || !isIdentifier(firstArg.tag, 'yaml')) {
        throw new Error(`defineI18n must be called with yaml\`...\` in ${filePath}.`);
      }

      if (!isObject(firstArg.quasi) || firstArg.quasi.type !== 'TemplateLiteral') {
        throw new Error(`defineI18n yaml argument is invalid in ${filePath}.`);
      }

      sources.push(getTemplateLiteralText(firstArg.quasi, filePath));
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent') {
        continue;
      }

      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (isObject(value)) {
        visit(value);
      }
    }
  };

  visit(ast);
  return sources;
};

const collectFileEntries = async (filePath: string, targetScope?: string): Promise<SourceEntry[]> => {
  const extension = path.extname(filePath);
  const source = await fs.readFile(filePath, 'utf8');

  if (YAML_EXTENSIONS.has(extension) && /\.i18n\.ya?ml$/.test(filePath)) {
    return parseYamlSource(source, filePath, targetScope);
  }

  if (JS_EXTENSIONS.has(extension)) {
    return collectDefineI18nSources(source, filePath).flatMap(yamlSource =>
      parseYamlSource(yamlSource, filePath, targetScope)
    );
  }

  return [];
};

export const extract = async (
  cwd: string,
  target: TargetConfig,
) => {
  const files = await fg(target.include, {
    cwd,
    absolute: true,
    onlyFiles: true,
    unique: true
  });

  const entries = (await Promise.all(files.map(file => collectFileEntries(file, target.scope)))).flat();
  return Object.fromEntries(entries.map(entry => [entry.key, entry.value] as const));
};
