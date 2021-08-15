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

const atom = later<Atom>();

type Interpolation = { name: 'Interpolation', content: string };
const interpolation: Parjser<Interpolation> =
	anyChar().pipe(
		manyBetween(string('{'), string('}')),
		map(result => ({ name: 'Interpolation', content: result.join('') }))
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

type Tag = { name: 'Tag', tagName: string, content: Atom[] };
const tag: Parjser<Tag> =
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
				return result({ name: 'Tag', tagName, content: [] });
			}

			const tagClose = string(tagName)
				.pipe(
					between('</', '>')
				);

			return atom.pipe(
				manyTill(tagClose),
				stringifyConsecutive<Atom>(),
				map(result => ({ name: 'Tag', tagName, content: result }))
			);
		})
	);

type Atom = string | Interpolation | Tag;
atom.init(
	escape.pipe(
		or(tag),
		or(interpolation),
		or(anyChar())
	)
);

const program: Parjser<Atom[]> =
	atom.pipe(
		many(),
		stringifyConsecutive<Atom>()
	);

type I18n = { [ Key in string ]: string | I18n };
type ParsedI18n = { [ Key in string ]: Atom[] | ParsedI18n };

const parseAllI18n = (i18nData: I18n): ParsedI18n =>
	Object.keys(i18nData).reduce<ParsedI18n>((result, key) => {
		const value = i18nData[key];
		if (typeof value === 'string') {
			const parseResult = program.parse(value);
			if (parseResult.kind === 'OK') {
				return { ...result, [ key ]: parseResult.value };
			}

			throw parseResult;
		}

		return { ...result, [ key ]: parseAllI18n(value) };
	}, {});

export const parse = (text: string): ParsedI18n => {
	const i18nData = yaml.load(text) as I18n;
	return parseAllI18n(i18nData);
};

export const load = (text: string): string => {
	const i18n = parse(text);
	return (
		`const i18n = ${JSON.stringify(i18n)};` +
		`export default i18n;`
	);
}
