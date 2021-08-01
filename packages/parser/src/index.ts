import yaml from 'js-yaml';

import { anyChar, digit, letter, string } from 'parjs';
import { between, later, many, manyBetween, manyTill, map, or, qthen, thenPick } from 'parjs/combinators';
import type { Parjser } from 'parjs';

const stringifyConsecutive = <T>() =>
	map<T[], (T | string)[]>(result =>
		result.reduce<(T | string)[]>((prev, curr) => {
			const lastItem = (prev.length > 1)
				? prev[prev.length - 1]
				: undefined;

			if (typeof lastItem === 'string') {
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
	tagName.pipe(
		manyBetween('<', '>'),
		map(result => result.join(''))
	).pipe(
		thenPick((content) => {
			const tagClose = string(content)
				.pipe(
					between('</', '>')
				);

			return atom.pipe(
				manyTill(tagClose),
				stringifyConsecutive<Atom>(),
				map(result => ({ name: 'Tag', tagName: content, content: result }))
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
