import { createContext, createElement, useContext } from 'react';
import type { ComponentType, ReactNode } from 'react';

export type I18nAtomInterpolation = { name: 'Interpolation', content: string };
export type I18nAtomTag = { name: 'Tag', tagName: string, content: I18nAtom[] };
export type I18nAtom = string | I18nAtomInterpolation | I18nAtomTag;
export type I18nPluralization =
	{ zero?: I18nAtom[], singular: I18nAtom[], plural: I18nAtom[] };

export type I18nValue = I18nAtom[] | I18nPluralization;
export type I18nObject = { [key: string]: I18n };
export type I18n = { [key: string]: I18nAtom[] | I18nPluralization | I18n };
export type NamespacedI18n = { [key: string]: I18nObject | NamespacedI18n };

export type TranslateOptionsBase =
	{ $count?: number };

export type TranslateOptions =
	TranslateOptionsBase &
	{ [key: string]: string | ReactNode | ComponentType<{ children: ReactNode }> };

export type TranslateFunction =
	(key: string, options?: TranslateOptions) => ReactNode;

export type TranslateStringOptions =
	TranslateOptionsBase &
	{ [key: string]: string };

export type TranslateStringFunction =
	(key: string, options?: TranslateStringOptions) => string;

const access = (object: Record<string, unknown>, key: string): unknown => {
	const keyLevels = key.split('.');
	return keyLevels.reduce<unknown>((currentLevel, key) => {
		if (typeof currentLevel !== 'object' || !currentLevel) {
			throw new Error('Wrong key!');
		}

		return (currentLevel as Record<string, unknown>)[key];
	}, object);
};

const accessWithNamespace =
	(i18nOrNamespacedI18n: I18nObject | NamespacedI18n, namespacedKey: string, context: I18nContextType): I18nValue => {
		const [key, namespace] = namespacedKey.split(':').reverse();
		const i18n = namespace ? access(i18nOrNamespacedI18n, namespace) as I18nObject : i18nOrNamespacedI18n;
		return access(i18n[context.lang] ?? i18n[context.fallbackLang], key) as I18nValue;
	};

const isI18nPluralization = (value: I18nValue): value is I18nPluralization =>
	!Array.isArray(value);

const getPluralization = (count: number | undefined, value: I18nValue) => {
	if (!isI18nPluralization(value)) {
		return value;
	}

	if (count === 0)
		return value.zero ?? value.plural;

	if (count === 1)
		return value.singular;

	return value.plural;
};

export type UseI18n = {
	t: TranslateFunction,
	ts: TranslateStringFunction
};

export const useI18n = (componentI18n?: I18nObject | NamespacedI18n): UseI18n => {
	const context = useContext(I18nContext);
	const i18n = componentI18n ?? context.i18n ?? {};

	const translate = (atoms: I18nAtom[], options: TranslateOptions): ReactNode =>
		atoms.map<ReactNode>((atom, index) => {
			if (typeof atom === 'string') {
				return atom;
			}

			if (atom.name === 'Interpolation') {
				return options[atom.content] as ReactNode ?? '';
			}

			if (atom.name === 'Tag') {
				const component = options[atom.tagName] as ComponentType<{ children: ReactNode }>;
				if (!component) {
					return null;
				}

				return createElement(
					component,
					{ children: translate(atom.content, options), key: `${atom.tagName}-${index}` }
				);
			}

			return null;
		}, []);

	const translateString = (atoms: I18nAtom[], options: TranslateStringOptions): string =>
		atoms.map(atom => {
			if (typeof atom === 'string') {
				return atom;
			}

			if (atom.name === 'Interpolation') {
				return options[atom.content];
			}

			return '';
		}).join('');

	const t = (key: string, options: TranslateOptions = {}): ReactNode => {
		const value = accessWithNamespace(i18n, key, context);
		return translate(getPluralization(options.$count, value), options);
	};

	const ts = (key: string, options: TranslateStringOptions = {}): string => {
		const value = accessWithNamespace(i18n, key, context);
		return translateString(getPluralization(options.$count, value), options);
	}

	return { t, ts };
};

export type I18nContextType = {
	i18n?: I18nObject | NamespacedI18n,
	lang: string
	fallbackLang: string
};

export const I18nContext = createContext<I18nContextType>({ lang: 'en', fallbackLang: 'en' });
export const I18nProvider = I18nContext.Provider;
