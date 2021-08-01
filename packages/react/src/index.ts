import { createElement } from 'react';
import type { FunctionComponent, ReactNode } from 'react';

export type I18nAtomInterpolation = { name: 'Interpolation', content: string };
export type I18nAtomTag = { name: 'Tag', tagName: string, content: I18nAtom[] };
export type I18nAtom = string | I18nAtomInterpolation | I18nAtomTag;
export type I18nPluralization =
	{ zero?: I18nAtom[], singular: I18nAtom[], plural: I18nAtom[] };

export type I18nKeys = 'ko' | 'en';
export type I18nValue = I18nAtom[] | I18nPluralization;
export type I18nObject = { [key: string]: I18nAtom[] | I18nPluralization | I18nObject };
export type I18n = { [Key in I18nKeys]?: I18nObject };
export type NamespacedI18n = { [key: string]: I18n | NamespacedI18n };

export type TranslateOptions =
	{ $count?: number } &
	{ [key: string]: string | FunctionComponent<{ children: ReactNode }> };

export type TranslateFunction =
	(key: string, options?: TranslateOptions) => ReactNode;

const access = (object: Record<string, unknown>, key: string): unknown => {
	const keyLevels = key.split('.');
	return keyLevels.reduce<unknown>((currentLevel, key) => {
		if (typeof currentLevel !== 'object' || !currentLevel) {
			throw new Error('Wrong key!');
		}

		return (currentLevel as Record<string, unknown>)[key];
	}, object);
};

const accessWithNamespace = (i18nOrNamespacedI18n: I18n | NamespacedI18n, key: string): I18nValue => {
	const namespace = key.split(':')[0];
	const i18n = namespace ? access(i18nOrNamespacedI18n, namespace) as I18n : i18nOrNamespacedI18n;
	return access(i18n, key) as I18nValue;
};

const isI18nPluralization = (value: I18nValue): value is I18nPluralization =>
	!Array.isArray(value);

export type UseI18n = {
	t: TranslateFunction
};

export const useI18n = (i18n: I18n | NamespacedI18n): UseI18n => {
	const translate = (atoms: I18nAtom[], options: TranslateOptions): ReactNode =>
		atoms.map<ReactNode>(atom => {
			if (typeof atom === 'string') {
				return atom;
			}

			if (atom.name === 'Interpolation') {
				return options[atom.content] as string ?? '';
			}

			if (atom.name === 'Tag') {
				const component = options[atom.tagName] as FunctionComponent<{ children: ReactNode }>;
				if (!component) {
					return null;
				}

				return createElement(
					component,
					{ children: translate(atom.content, options) }
				);
			}

			return null;
		}, []);

	const t = (key: string, options: TranslateOptions = {}): ReactNode => {
		const value = accessWithNamespace(i18n, key);
		if (isI18nPluralization(value)) {
			if (options.$count === 0)
				return translate(value.zero ?? value.plural, options);

			if (options.$count === 1)
				return translate(value.singular, options);

			return translate(value.plural, options);
		}

		return translate(value, options);
	};

	return { t };
};
