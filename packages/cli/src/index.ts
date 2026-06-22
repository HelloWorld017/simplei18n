import fs from 'fs/promises';
import path from 'path';

import { parseScope } from '@simplei18n/parser';
import fg from 'fast-glob';
import { createJiti } from 'jiti';
import yaml from 'js-yaml';
import { parseSync } from 'oxc-parser';
import * as v from 'valibot';

type GenerateOptions = {
  cwd?: string;
  removeDangling?: boolean;
};

type SourceEntry = {
  key: string;
  value: string;
};

type KeyTree = {
  children: Record<string, KeyTree>;
  value?: string;
};

const CONFIG_FILES = [
  'simplei18n.config.ts',
  'simplei18n.config.mts',
  'simplei18n.config.js',
  'simplei18n.config.mjs'
];

const JS_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.mts', '.cjs', '.cts']);
const YAML_EXTENSIONS = new Set(['.yml', '.yaml']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizePath = (filePath: string) => filePath.split(path.sep).join('/');
const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

const joinKey = (...parts: Array<string | undefined>): string =>
  parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map(part => part.trim().replace(/^\.+|\.+$/g, ''))
    .filter(part => part.length > 0)
    .join('.');

const stringifyTsString = (value: string): string => JSON.stringify(value);

const targetConfigSchema = v.object({
  include: v.pipe(v.array(v.string()), v.nonEmpty()),
  scope: v.optional(v.string()),
  outDir: v.string()
});

const configSchema = v.pipe(
  v.object({
    target: v.pipe(
      v.union([targetConfigSchema, v.pipe(v.array(targetConfigSchema), v.nonEmpty())]),
      v.transform(input => Array.isArray(input) ? input : [input])
    ),
    defaultLocale: v.string(),
    locales: v.pipe(v.array(v.string()), v.nonEmpty())
  }),
  v.check((config) => config.locales.includes(config.defaultLocale), 'locale must include "defaultLocale"')
);

export type TargetConfig = v.InferInput<typeof targetConfigSchema>;
export type Config = v.InferInput<typeof configSchema>;
export type NormalizedConfig = v.InferOutput<typeof configSchema>;

const normalizeConfig = (config: unknown): NormalizedConfig => {
  const result = v.safeParse(configSchema, config);
  if (!result.success) {
    const error = result.issues.map(issue => {
      const path = issue.path?.length ? issue.path?.join('.') : 'config';
      return `${path}: ${issue.message}`;
    }).join('\n');

    throw new Error(`Invalid simplei18n config:\n${error}`);
  }

  return result.output;
};

const findConfig = async (cwd: string): Promise<string> => {
  for (const fileName of CONFIG_FILES) {
    const filePath = path.join(cwd, fileName);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {}
  }

  throw new Error(`Cannot find simplei18n config. Expected one of: ${CONFIG_FILES.join(', ')}`);
};

const loadConfig = async (cwd: string): Promise<NormalizedConfig> => {
  const configPath = await findConfig(cwd);
  const jiti = createJiti(configPath, { interopDefault: true });
  const loaded = await jiti.import(configPath, { default: true });
  return normalizeConfig(loaded);
};

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
  const body = yaml.load(source) ?? {};
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

const readLocaleFile = async (filePath: string): Promise<Record<string, string>> => {
  try {
    const source = await fs.readFile(filePath, 'utf8');
    const parsed = yaml.load(source) ?? {};
    if (!isObject(parsed)) {
      throw new Error(`Locale file ${filePath} must contain an object.`);
    }

    return Object.keys(parsed).reduce<Record<string, string>>((result, key) => {
      const value = parsed[key];
      if (typeof value !== 'string') {
        throw new Error(`Locale value '${key}' in ${filePath} must be a string.`);
      }

      result[key] = value;
      return result;
    }, {});
  } catch (error) {
    if (isObject(error) && error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
};

const dumpLocale = (locale: Record<string, string>): string =>
  Object.keys(locale)
    .sort()
    .map(key => `${stringifyTsString(key)}: ${stringifyTsString(locale[key])}`)
    .join('\n') + (Object.keys(locale).length > 0 ? '\n' : '{}\n');

const mergeLocale = (
  existing: Record<string, string>,
  source: Record<string, string>,
  removeDangling: boolean
): Record<string, string> => {
  const keys = removeDangling ? Object.keys(source) : unique([...Object.keys(existing), ...Object.keys(source)]);
  return keys.sort().reduce<Record<string, string>>((result, key) => {
    result[key] = existing[key] ?? source[key];
    return result;
  }, {});
};

const createKeyTree = (entries: SourceEntry[]): KeyTree => {
  const root: KeyTree = { children: {} };

  for (const entry of entries) {
    const parts = entry.key.split('.').filter(Boolean);
    let node = root;
    for (const part of parts) {
      node.children[part] = node.children[part] ?? { children: {} };
      node = node.children[part];
    }
    node.value = entry.value;
  }

  return root;
};

const indent = (level: number): string => '  '.repeat(level);
const isValidIdentifier = (value: string): boolean => /^[A-Za-z_$][\w$]*$/.test(value);
const propertyName = (value: string): string => isValidIdentifier(value) ? value : stringifyTsString(value);
const escapeComment = (value: string): string => value.replace(/\*\//g, '*\\/').replace(/[\r\n]+/g, ' ');

const renderKeyTree = (tree: KeyTree, level: number): string[] => {
  return Object.keys(tree.children).sort().flatMap(key => {
    const child = tree.children[key];
    const lines: string[] = [];

    if (child.value !== undefined && Object.keys(child.children).length === 0) {
      lines.push(`${indent(level)}/** ${escapeComment(child.value)} */`);
      lines.push(`${indent(level)}${propertyName(key)}: string;`);
      return lines;
    }

    lines.push(`${indent(level)}${propertyName(key)}: {`);
    lines.push(...renderKeyTree(child, level + 1));
    if (child.value !== undefined) {
      lines.push(`${indent(level + 1)}/** ${escapeComment(child.value)} */`);
      lines.push(`${indent(level + 1)}_value: string;`);
    }
    lines.push(`${indent(level)}};`);
    return lines;
  });
};

const renderTypes = (entries: SourceEntry[], locales: string[], defaultLocale: string): string => {
  const localeUnion = locales.map(stringifyTsString).join(' | ');
  const treeLines = renderKeyTree(createKeyTree(entries), 2);

  return [
    "declare module 'simplei18n' {",
    '  interface TranslationConfig {',
    `    locales: ${localeUnion};`,
    `    defaultLocale: ${stringifyTsString(defaultLocale)};`,
    '  }',
    '',
    '  interface TranslationKey {',
    ...treeLines,
    '  }',
    '}',
    '',
    'declare global {',
    "  declare module '*.i18n.yaml' {",
    "    import type { Locale } from 'simplei18n';",
    '    declare const locale: Locale;',
    '    export default locale;',
    '  }',
    '}',
    '',
    'export {}',
    ''
  ].join('\n');
};

const renderIndex = (locales: string[], defaultLocale: string): string => [
  "import { defineLocales } from 'simplei18n';",
  '',
  'export default defineLocales({',
  '  locales: {',
  ...locales.map(locale => `    ${propertyName(locale)}: import('./_locales/${locale}.i18n.yaml'),`),
  '  },',
  `  defaultLocale: ${stringifyTsString(defaultLocale)},`,
  '});',
  ''
].join('\n');

const writeTarget = async (
  cwd: string,
  target: TargetConfig,
  config: Pick<Config, 'locales' | 'defaultLocale'>,
  removeDangling: boolean
) => {
  const files = await fg(target.include, {
    cwd,
    absolute: true,
    onlyFiles: true,
    unique: true
  });

  const entries = (await Promise.all(files.map(file => collectFileEntries(file, target.scope)))).flat();
  const source = entries.reduce<Record<string, string>>((result, entry) => {
    result[entry.key] = entry.value;
    return result;
  }, {});

  const outDir = path.resolve(cwd, target.outDir);
  const localeDir = path.join(outDir, '_locales');
  await fs.mkdir(localeDir, { recursive: true });

  for (const locale of config.locales) {
    const localePath = path.join(localeDir, `${locale}.i18n.yaml`);
    const existing = await readLocaleFile(localePath);
    const merged = mergeLocale(existing, source, removeDangling);
    await fs.writeFile(localePath, dumpLocale(merged));
  }

  await fs.writeFile(path.join(outDir, 'i18n.d.ts'), renderTypes(entries, config.locales, config.defaultLocale));
  await fs.writeFile(path.join(outDir, 'index.ts'), renderIndex(config.locales, config.defaultLocale));

  process.stdout.write(`Generated ${normalizePath(path.relative(cwd, outDir))}\n`);
};

export const generate = async (options: GenerateOptions = {}): Promise<void> => {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd);

  for (const target of config.target) {
    await writeTarget(cwd, target, config, options.removeDangling ?? false);
  }
};

const printUsage = () => {
  process.stderr.write('Usage: simplei18n generate [--remove-dangling]\n');
  process.exitCode = 1;
};

export const cli = async () => {
  const [command, ...args] = process.argv.slice(2);

  if (command !== 'generate'|| args.includes('-h') || args.includes('--help')) {
    printUsage();
    return;
  }

  const unknownArgs = args.filter(arg => arg !== '--remove-dangling');
  if (unknownArgs.length > 0) {
    process.stderr.write(`Unknown argument: ${unknownArgs.join(', ')}\n`);
    printUsage();
    return;
  }

  await generate({ removeDangling: args.includes('--remove-dangling') });
};
