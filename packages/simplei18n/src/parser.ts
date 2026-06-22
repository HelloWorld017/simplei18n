import yaml from 'js-yaml';

import { anyChar, digit, letter, result, string, whitespace } from 'parjs';
import {
  between,
  later,
  many,
  manyBetween,
  manyTill,
  map,
  maybe,
  or,
  qthen,
  then,
  thenPick,
  thenq
} from 'parjs/combinators';

import type { Parjser } from 'parjs';
import {I18nAtom, I18nAtomInterpolation, I18nAtomKind, I18nAtomTag} from './types';

const stringifyConsecutive = <T>() =>
  map<T[], (T | string)[]>(result =>
    result.reduce<(T | string)[]>((prev, curr) => {
      const lastItem = (prev.length >= 1)
        ? prev[prev.length - 1]
        : undefined;

      if (typeof lastItem === 'string' && typeof curr === 'string') {
        return [ ...prev.slice(0, -1), lastItem + curr ];
      }

      return [ ...prev, curr ];
    }, [])
  );

const atom = later<I18nAtom>();

const interpolation: Parjser<I18nAtomInterpolation> =
  anyChar().pipe(
    manyBetween(string('{'), string('}')),
    map(result => ([I18nAtomKind.Interpolation, result.join('')]))
  );

const escape: Parjser<string> =
  string('\\').pipe(
    qthen(
      string('\\').pipe(
        or(string('{')),
        or(string('<')),
      )
    )
  );

const tagName: Parjser<string> =
  letter().pipe(
    or(digit())
  );

const tag: Parjser<I18nAtomTag> =
  string('<').pipe(
    qthen(tagName.pipe(
      many(),
      map(chars => chars.join(''))
    )),
    thenq(whitespace()),
    then(string('/').pipe(maybe(''), map(item => !!item))),
    map(([ tagName, closes ]) => ({ tagName, closes })),
    thenq(string('>'))
  ).pipe(
    thenPick(({ tagName, closes }) => {
      if (closes) {
        return result([I18nAtomKind.Tag, tagName, []]);
      }

      const tagClose = string(tagName)
        .pipe(
          between('</', '>')
        );

      return atom.pipe(
        manyTill(tagClose),
        stringifyConsecutive<I18nAtom>(),
        map(result => [I18nAtomKind.Tag, tagName, result])
      );
    })
  );

atom.init(
  escape.pipe(
    or(tag),
    or(interpolation),
    or(anyChar())
  )
);

const program: Parjser<I18nAtom[]> =
  atom.pipe(
    many(),
    stringifyConsecutive<I18nAtom>()
  );

const parseAllI18n = <TKey extends string>(i18nData: Record<TKey, string>): Record<TKey, I18nAtom[]> =>
  Object.fromEntries(Object.entries(i18nData).map(([key, value]) => {
    const parseResult = program.parse(value as string);
    if (parseResult.kind === 'OK') {
      return [ key as TKey, parseResult.value] as const;
    }

    throw parseResult;
  }, {})) as Record<TKey, I18nAtom[]>;

export const parse = <TKey extends string>(text: string): Record<TKey, I18nAtom[]>  => {
  const i18nData = yaml.load(text) as Record<TKey, string>;
  return parseAllI18n(i18nData);
};

export const parseScope = (text: string): string | undefined => {
  const match = text.match(/^\s*#\s*scope:\s*([^\r\n#]+?)\s*$/m);
  return match?.[1]?.trim() || undefined;
};
