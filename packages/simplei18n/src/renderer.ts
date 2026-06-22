import path from 'node:path';
import { Parser, Document, parse as parseYaml, parseDocument, CST } from 'yaml';
import { parse as parseI18n } from './parser';
import { I18nAtomKind } from './types';
import type { TargetConfig } from './config';
import type { I18nAtom } from './types';

type KeyTree = {
  children: Record<string, KeyTree>;
  metadata?: TranslationMetadata;
};

type TranslationMetadata = {
  value?: string;
  interpolations: Set<string>;
  tags: Set<string>;
};

const indent = (level: number): string => '  '.repeat(level);
const isValidIdentifier = (value: string): boolean => /^[A-Za-z_$][\w$]*$/.test(value);
const propertyName = (value: string): string =>
  isValidIdentifier(value) ? value : stringifyTsString(value);

const escapeComment = (value: string): string =>
  value.replace(/\*\//g, '*\\/').replace(/[\r\n]+/g, ' ');

const stringifyTsString = (value: string): string => JSON.stringify(value);
const normalizePluralizationKey = (key: string) => key.replace(/\.(?:plural|singular|zero)$/, '');
const toImportPath = (fromDir: string, toFile: string): string => {
  const relative = path.relative(fromDir, toFile).replace(/\\/g, '/');
  return relative.startsWith('.') ? relative : `./${relative}`;
};

const toPascalCase = (value: string): string => {
  const words = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) {
    return 'Locale';
  }

  return words.map(word => `${word[0].toUpperCase()}${word.slice(1)}`).join('');
};

const localeImportName = (target: TargetConfig, locale: string): string =>
  `${target.name}${toPascalCase(locale)}`;

const isEagerLocale = (target: TargetConfig, locale: string): boolean =>
  typeof target.eager === 'boolean' ? target.eager : target.eager.has(locale);

const collectAtomMetadata = (atoms: I18nAtom[], metadata: TranslationMetadata): void => {
  atoms.forEach(atom => {
    if (atom[0] === I18nAtomKind.Interpolation) {
      metadata.interpolations.add(atom[1]);
      return;
    }

    if (atom[0] === I18nAtomKind.Tag) {
      metadata.tags.add(atom[1]);
      collectAtomMetadata(atom[2], metadata);
    }
  });
};

const collectTranslationMetadata = (
  localeSources: string[],
): Record<string, TranslationMetadata> => {
  const metadataByKey: Record<string, TranslationMetadata> = {};

  for (const localeSource of localeSources) {
    const rawValues = (parseYaml(localeSource) ?? {}) as Record<string, string>;
    const translations = parseI18n(localeSource);

    for (const [key, value] of Object.entries(translations)) {
      const metadata = (metadataByKey[normalizePluralizationKey(key)] ??= {
        interpolations: new Set(),
        tags: new Set(),
      });

      const rawValue = rawValues[key];
      if (metadata.value === undefined && typeof rawValue === 'string') {
        metadata.value = rawValue;
      }

      collectAtomMetadata(value, metadata);
    }
  }

  return metadataByKey;
};

const renderStringUnion = (values: Set<string>): string => {
  const sorted = [...values].sort();
  return sorted.length > 0 ? sorted.map(stringifyTsString).join(' | ') : 'never';
};

const renderDescriptor = (metadata: TranslationMetadata): string =>
  `TranslationDescriptor<${renderStringUnion(metadata.interpolations)}, ${renderStringUnion(metadata.tags)}>`;

const createKeyTree = (source: Record<string, TranslationMetadata>): KeyTree => {
  const root: KeyTree = { children: {} };

  for (const [key, metadata] of Object.entries(source)) {
    const parts = key.split('.').filter(Boolean);
    let node = root;
    for (const part of parts) {
      node.children[part] = node.children[part] ?? { children: {} };
      node = node.children[part];
    }
    node.metadata = metadata;
  }

  return root;
};

const renderKeyTree = (tree: KeyTree, level: number): string[] =>
  Object.keys(tree.children)
    .sort()
    .flatMap(key => {
      const child = tree.children[key];
      const lines: string[] = [];
      const childKeys = Object.keys(child.children);
      const descriptor = child.metadata ? renderDescriptor(child.metadata) : null;

      if (descriptor && child.metadata?.value !== undefined) {
        lines.push(`${indent(level)}/** ${escapeComment(child.metadata.value)} */`);
      }

      if (descriptor && childKeys.length === 0) {
        lines.push(`${indent(level)}${propertyName(key)}: ${descriptor};`);
        return lines;
      }

      lines.push(`${indent(level)}${propertyName(key)}: ${descriptor ? `${descriptor} & ` : ''}{`);
      lines.push(...renderKeyTree(child, level + 1));
      lines.push(`${indent(level)}};`);
      return lines;
    });

export const renderTypes = (
  localeSources: string[],
  locales: string[],
  defaultLocale: string,
): string => {
  const localeUnion = locales.map(stringifyTsString).join(' | ');
  const treeLines = renderKeyTree(createKeyTree(collectTranslationMetadata(localeSources)), 2);

  return [
    "declare module 'simplei18n' {",
    "  import type { TranslationDescriptor } from 'simplei18n'",
    '',
    '  interface I18nConfig {',
    `    locales: ${localeUnion};`,
    `    defaultLocale: ${stringifyTsString(defaultLocale)};`,
    '  }',
    '',
    '  interface TranslationMap {',
    ...treeLines,
    '  }',
    '}',
    '',
    'declare global {',
    "  module '*.i18n.yaml' {",
    "    import type { Locale } from 'simplei18n';",
    '    const locale: Locale;',
    '    export default locale;',
    '  }',
    '}',
    '',
    'export {}',
    '',
  ].join('\n');
};

export const renderIndex = (
  locales: string[],
  defaultLocale: string,
  target: TargetConfig,
): string => {
  const eagerLocales = locales.filter(locale => isEagerLocale(target, locale));

  return [
    "import { defineLocales } from 'simplei18n';",
    ...eagerLocales.map(
      locale =>
        `import ${localeImportName(target, locale)} from ${stringifyTsString(`./_locales/${locale}.i18n.yaml`)};`,
    ),
    '',
    'export default defineLocales({',
    '  locales: {',
    ...locales.map(locale => {
      const localeValue = isEagerLocale(target, locale)
        ? localeImportName(target, locale)
        : `() => import(${stringifyTsString(`./_locales/${locale}.i18n.yaml`)})`;

      return `    ${propertyName(locale)}: ${localeValue},`;
    }),
    '  },',
    `  defaultLocale: ${stringifyTsString(defaultLocale)},`,
    '});',
    '',
  ].join('\n');
};

export const renderMergedIndex = (
  targets: TargetConfig[],
  locales: string[],
  defaultLocale: string,
  outputPath: string,
  workDir: string,
): string => {
  const outputDir = path.dirname(outputPath);
  const imports = targets.flatMap(target =>
    locales.map(locale => ({
      name: localeImportName(target, locale),
      path: toImportPath(
        outputDir,
        path.resolve(workDir, target.outDir, '_locales', `${locale}.i18n.yaml`),
      ),
    })),
  );

  return [
    "import { defineMergedLocales } from 'simplei18n';",
    ...imports.map(item => `import ${item.name} from ${stringifyTsString(item.path)};`),
    '',
    'export default defineMergedLocales({',
    '  locales: {',
    ...locales.flatMap(locale => [
      `    ${propertyName(locale)}: [`,
      ...targets.map(target => `      ${localeImportName(target, locale)},`),
      '    ],',
    ]),
    '  },',
    `  defaultLocale: ${stringifyTsString(defaultLocale)},`,
    '});',
    '',
  ].join('\n');
};

type RenderI18nOptions = {
  removeDangling?: boolean;
  wrapLength?: number | null;
};

type BlockMapDocument = CST.Document & { value: CST.BlockMap };
const getBlockMap = (tokens: CST.Token[]): CST.BlockMap =>
  tokens.find(
    (token): token is BlockMapDocument =>
      token.type === 'document' && token.value?.type === 'block-map',
  )!.value;

const getCollectionItemKey = (item: CST.CollectionItem) => {
  if (!item.key || !CST.isScalar(item.key)) {
    return null;
  }

  const scalar = CST.resolveAsScalar(item.key);
  return typeof scalar.value === 'string' ? scalar.value : null;
};

const getInsertIndex = (blockMap: CST.BlockMap, item: CST.CollectionItem) => {
  const collator = new Intl.Collator('en', { numeric: false, sensitivity: 'variant' });
  const newKey = getCollectionItemKey(item);
  if (!newKey) {
    return blockMap.items.length;
  }

  for (let i = 0; i < blockMap.items.length; i++) {
    const existingKey = getCollectionItemKey(blockMap.items[i]);
    if (existingKey && collator.compare(existingKey, newKey) > 0) {
      return i;
    }
  }

  return blockMap.items.length;
};

export const renderI18n = (
  source: Record<string, string>,
  existing?: string,
  { removeDangling = true, wrapLength = 80 }: RenderI18nOptions = {},
) => {
  let hasNewItem = false;
  const existingDoc = typeof existing === 'string' ? parseDocument(existing) : null;
  const newDoc = new Document({});
  for (const [key, value] of Object.entries(source)) {
    if (existingDoc?.has(key)) {
      continue;
    }

    const nodeType = (() => {
      if (value.includes('\n')) {
        return 'BLOCK_LITERAL';
      }

      if (wrapLength && value.length > wrapLength) {
        return 'BLOCK_FOLDED';
      }

      return 'QUOTE_DOUBLE';
    })();

    const node = newDoc.createNode(value);
    node.type = nodeType;
    node.comment = 'needs-edit';

    newDoc.set(key, node);
    hasNewItem = true;
  }

  const newDocStr = newDoc.toString({ lineWidth: wrapLength ?? 0 });
  if (!existing) {
    return newDocStr;
  }

  const existingTokens = Array.from(new Parser().parse(existing));
  const existingBlockMap = getBlockMap(existingTokens);

  if (hasNewItem) {
    const newTokens = Array.from(new Parser().parse(newDocStr));
    const newBlockMap = getBlockMap(newTokens);
    newBlockMap.items.forEach(item => {
      const insertPosition = getInsertIndex(existingBlockMap, item);
      existingBlockMap.items.splice(insertPosition, 0, item);
    });
  }

  if (removeDangling) {
    existingBlockMap.items = existingBlockMap.items.filter(item => {
      const key = getCollectionItemKey(item);
      return !key || Object.hasOwn(source, key);
    });
  }

  return existingTokens.reduce((prev, token) => prev + CST.stringify(token), '');
};
