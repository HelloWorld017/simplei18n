import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { parseSync } from 'oxc-parser';
import { parseScope } from './parser';
import { parseYaml } from './yaml';
import type { TargetConfig } from './config';

type SourceEntry = {
  key: string;
  value: string;
};

type ExtractCacheEntry = {
  mtimeMs: number;
  size: number;
  entries: SourceEntry[];
};

export type ExtractCache = Map<string, ExtractCacheEntry>;

type ExtractOptions = {
  cache?: ExtractCache;
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
  const body = parseYaml(source) ?? {};
  const entries = flattenYamlValue(body);

  return entries
    .map(entry => ({
      key: joinKey(targetScope, sourceScope, entry.key),
      value: entry.value,
    }))
    .map(entry => {
      if (!entry.key) {
        throw new Error(`Empty i18n key found in ${filePath}.`);
      }

      return entry;
    });
};

const normalizeTemplateLiteralRaw = (raw: string): string => raw.replace(/\\(`|\$\{)/g, '$1');

const getTemplateLiteralText = (node: Record<string, unknown>, filePath: string): string => {
  const expressions = Array.isArray(node.expressions) ? node.expressions : [];
  if (expressions.length > 0) {
    throw new Error(
      `simplei18n yaml template literal interpolation is not supported in ${filePath}.`,
    );
  }

  const quasis = Array.isArray(node.quasis) ? node.quasis : [];
  return quasis
    .map(quasi => {
      if (!isObject(quasi) || !isObject(quasi.value) || typeof quasi.value.raw !== 'string') {
        throw new Error(`Cannot read yaml template literal in ${filePath}.`);
      }

      return normalizeTemplateLiteralRaw(quasi.value.raw);
    })
    .join('');
};

const isIdentifier = (node: unknown, name: string): boolean =>
  isObject(node) && node.type === 'Identifier' && node.name === name;

const unwrapParenthesized = (node: unknown): unknown => {
  let current = node;
  while (isObject(current) && current.type === 'ParenthesizedExpression') {
    current = current.expression;
  }

  return current;
};

const getYamlTaggedTemplateSource = (node: unknown, filePath: string, tagName: string): string => {
  const expression = unwrapParenthesized(node);
  if (
    !isObject(expression) ||
    expression.type !== 'TaggedTemplateExpression' ||
    !isIdentifier(expression.tag, tagName)
  ) {
    throw new Error(`defineI18n must return ${tagName}\`...\` in ${filePath}.`);
  }

  if (!isObject(expression.quasi) || expression.quasi.type !== 'TemplateLiteral') {
    throw new Error(`defineI18n yaml argument is invalid in ${filePath}.`);
  }

  return getTemplateLiteralText(expression.quasi, filePath);
};

const getFunctionReturnExpression = (node: Record<string, unknown>, filePath: string): unknown => {
  const body = unwrapParenthesized(node.body);
  if (!isObject(body)) {
    throw new Error(`defineI18n callback body is invalid in ${filePath}.`);
  }

  if (body.type !== 'BlockStatement') {
    return body;
  }

  const statements = Array.isArray(body.body) ? body.body : [];
  const returnStatement = statements.find(
    statement => isObject(statement) && statement.type === 'ReturnStatement',
  );
  if (!isObject(returnStatement)) {
    throw new Error(`defineI18n callback must return yaml\`...\` in ${filePath}.`);
  }

  return returnStatement.argument;
};

const getDefineI18nSource = (node: unknown, filePath: string): string => {
  const arg = unwrapParenthesized(node);

  if (!isObject(arg)) {
    throw new Error(`defineI18n must be called with yaml => yaml\`...\` in ${filePath}.`);
  }

  if (arg.type !== 'ArrowFunctionExpression' && arg.type !== 'FunctionExpression') {
    throw new Error(`defineI18n must be called with yaml => yaml\`...\` in ${filePath}.`);
  }

  const params = Array.isArray(arg.params) ? arg.params : [];
  const yamlParam = params[0];
  if (
    !isObject(yamlParam) ||
    yamlParam.type !== 'Identifier' ||
    typeof yamlParam.name !== 'string'
  ) {
    throw new Error(`defineI18n callback must receive a yaml parameter in ${filePath}.`);
  }

  return getYamlTaggedTemplateSource(
    getFunctionReturnExpression(arg, filePath),
    filePath,
    yamlParam.name,
  );
};

const collectDefineI18nSources = (source: string, filePath: string): string[] => {
  const ast = parseSync(filePath, source, {
    sourceType: 'module',
    lang: filePath.endsWith('x') ? 'tsx' : 'ts',
  });

  const sources: string[] = [];
  const visit = (node: unknown) => {
    if (!isObject(node)) {
      return;
    }

    if (node.type === 'CallExpression' && isIdentifier(node.callee, 'defineI18n')) {
      const args = Array.isArray(node.arguments) ? node.arguments : [];
      sources.push(getDefineI18nSource(args[0], filePath));
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

export const extractFile = async (
  filePath: string,
  targetScope?: string,
  cache?: ExtractCache,
): Promise<SourceEntry[]> => {
  const cacheKey = `${targetScope ?? ''}\0${filePath}`;
  const stat = cache ? await fs.stat(filePath) : null;
  const cached = cache?.get(cacheKey);
  if (cached && stat && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.entries;
  }

  const extension = path.extname(filePath);
  const source = await fs.readFile(filePath, 'utf8');
  let entries: SourceEntry[];

  if (YAML_EXTENSIONS.has(extension) && /\.i18n\.ya?ml$/.test(filePath)) {
    entries = parseYamlSource(source, filePath, targetScope);
  } else if (JS_EXTENSIONS.has(extension)) {
    entries = collectDefineI18nSources(source, filePath).flatMap(yamlSource =>
      parseYamlSource(yamlSource, filePath, targetScope),
    );
  } else {
    entries = [];
  }

  if (cache && stat) {
    cache.set(cacheKey, { mtimeMs: stat.mtimeMs, size: stat.size, entries });
  }

  return entries;
};

export const createExtractCache = (): ExtractCache => new Map();
export const invalidateExtractCache = (cache: ExtractCache, filePath: string) => {
  for (const key of cache.keys()) {
    if (key.endsWith(`\0${filePath}`)) {
      cache.delete(key);
    }
  }
};

export const extract = async (cwd: string, target: TargetConfig, options: ExtractOptions = {}) => {
  const files = await fg(target.include, {
    cwd,
    absolute: true,
    onlyFiles: true,
    unique: true,
  });

  const entries = (
    await Promise.all(files.map(file => extractFile(file, target.scope, options.cache)))
  ).flat();
  return Object.fromEntries(entries.map(entry => [entry.key, entry.value] as const));
};
