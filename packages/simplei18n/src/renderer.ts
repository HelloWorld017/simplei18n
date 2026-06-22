import { Parser, Document, parseDocument, CST } from 'yaml';

type KeyTree = {
  children: Record<string, KeyTree>;
  value?: string;
};

const indent = (level: number): string => '  '.repeat(level);
const isValidIdentifier = (value: string): boolean => /^[A-Za-z_$][\w$]*$/.test(value);
const propertyName = (value: string): string => isValidIdentifier(value) ? value : stringifyTsString(value);
const escapeComment = (value: string): string => value.replace(/\*\//g, '*\\/').replace(/[\r\n]+/g, ' ');
const stringifyTsString = (value: string): string => JSON.stringify(value);

const createKeyTree = (source: Record<string, string>): KeyTree => {
  const root: KeyTree = { children: {} };

  for (const [key, value] of Object.entries(source)) {
    const parts = key.split('.').filter(Boolean);
    let node = root;
    for (const part of parts) {
      node.children[part] = node.children[part] ?? { children: {} };
      node = node.children[part];
    }
    node.value = value;
  }

  return root;
};

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

export const renderTypes = (source: Record<string, string>, locales: string[], defaultLocale: string): string => {
  const localeUnion = locales.map(stringifyTsString).join(' | ');
  const treeLines = renderKeyTree(createKeyTree(source), 2);

  return [
    "declare module 'simplei18n' {",
    '  interface I18nConfig {',
    `    locales: ${localeUnion};`,
    `    defaultLocale: ${stringifyTsString(defaultLocale)};`,
    '  }',
    '',
    '  interface TranslationKeyMap {',
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

export const renderIndex = (locales: string[], defaultLocale: string): string => [
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

type RenderI18nOptions = {
  removeDangling?: boolean;
  wrapLength?: number | null;
};

type BlockMapDocument = CST.Document & { value: CST.BlockMap };
const getBlockMap = (tokens: CST.Token[]): CST.BlockMap =>
  tokens.find(
    (token): token is BlockMapDocument =>
      token.type === 'document' && token.value?.type === 'block-map'
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
  { removeDangling = true, wrapLength = 80 }: RenderI18nOptions = {}
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
