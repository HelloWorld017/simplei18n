# simplei18n

> Yet another simple, minimal i18n library

## Abstract

`simplei18n` is an i18n library that generates type-safe locale files from component-colocated translation declarations.

```tsx
import { defineI18n } from '@simplei18n/core';
import { t } from '@simplei18n/core/react';

defineI18n(
  yaml => yaml`
  # scope: mycomponent
  hello: 'Hello, <b>{user}</b>'
`,
);

export const MyComponent = () => (
  <h1>
    <t._ $tags={{ b: 'b' }} user='World'>
      {t.mycomponent.hello}
    </t._>
  </h1>
);
```

Example of generated code:

```yaml
# _locales/ko.i18n.yaml
mycomponent.hello: !todo 'Hello, <b>{user}</b>'
```

```ts
// i18n.d.ts
interface TranslationMap {
  mycomponent: {
    /** Hello, <b>{user}</b> */
    hello: TranslationDescriptor<'user', 'b'>;
  };
}
```

## Getting Started

```sh
$ pnpm add @simplei18n/core
```

### Vite

Add the Vite plugin to import generated `.i18n.yaml` files.

```ts
// vite.config.ts
import react from '@vitejs/plugin-react';
import simplei18n from '@simplei18n/core/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), simplei18n()],
});
```

### Configuration

Create `simplei18n.config.ts` in your project root.

```ts
import { defineConfig } from '@simplei18n/core';

export default defineConfig({
  target: {
    include: ['./src/**/*.tsx'],
    outDir: './src/i18n',
    eager: ['en_US'],
  },
  mergeTo: './src/i18n/merged.ts',
  locales: ['en_US', 'ko'],
  defaultLocale: 'en_US',
});
```

### Define Translations

Declare default translations with ``defineI18n(yaml => yaml`...`)`` inside components or modules.
The declarations are extracted by the CLI and dead-code eliminated.

```tsx
import { defineI18n } from '@simplei18n/core';

defineI18n(
  yaml => yaml`
  # scope: common
  hello: 'Hello {name}'
  rich: 'Read the <link>docs</link>'
  item.zero: 'No items'
  item.singular: '{count} item'
  item.plural: '{count} items'
`,
);
```

Supported syntax:

- **Interpolation**: `{name}`  
  Marks values that must be provided when translating the key.
- **Tag**: `<link>...</link>`  
  Marks rich text that can be mapped to a React component or intrinsic element.
- **Pluralization Key**: `key.zero` `key.singular` `key.plural`
  Hints pluralization, which selects key by the `$count` option.
- **Scoped Key**: `# scope: common`
  Prefixes keys in the block with scope.

### Code Generation

Generate or update translation files with the CLI.

```sh
$ pnpm exec simplei18n generate
$ pnpm exec simplei18n generate --watch
```

Running `simplei18n generate` creates this structure.

```txt
<outDir>/
  _locales/
    <locale>.i18n.yaml  # Per-locale translation files
  i18n.d.ts             # Locale key and translation key type declarations
  index.ts              # Locale config with lazy/eager locale imports
<mergeTo> (optional)    # Merged locale config for multiple targets, useful for server-side rendering
```

## Frameworks

### React

In a React client app, pass the generated `i18n/index.ts` config to `createI18nResource` and wrap your app with `I18nProvider`.

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createI18nResource, I18nProvider } from '@simplei18n/core/react';
import i18n from './i18n';
import { App } from './App';

const resource = createI18nResource(i18n);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider lang='ko' resource={resource}>
      <App />
    </I18nProvider>
  </StrictMode>,
);
```

Use `useI18n` or global `<t._>` inside components.

```tsx
import { defineI18n } from '@simplei18n/core';
import { useI18n } from '@simplei18n/core/react';
import type { PropsWithChildren } from 'react';

defineI18n(yaml => yaml`
  # scope: profile
  greeting: 'Hello {name}'
  link: 'Open <strong>{name}</strong>'
`);

const CustomStrong => ({ children }: PropsWithChildren) => (
  <strong className='strong'>{children}</strong>
);

// Using `useI18n`
export const Profile = ({ name }: { name: string }) => {
  const { t, ts, lang } = useI18n();

  return (
    // `ts` translates into string, not ReactNode
    <section title={ts(ts.profile.greeting, { name })}>
      <p>{t(t.profile.link, { name, $tags: { strong: CustomStrong } })}</p>
      <small>{lang}</small>
    </section>
  );
};

// Using `t._`
import { t } from '@simplei18n/core/react';

export const Profile = ({ name }: { name: string }) => (
  <p>
    <t._ name={name} $tags={{ strong: 'strong' }}>{t.profile.link}</t._>
    <t._ name={name} $tags={{ strong: 'strong' }}>
      {t.profile.link}
    </t._>
  </p>
);
```

Unless you are using `eager`, using `t._` or `useI18n` will trigger nearest suspense boundary.
`<I18nLoader />` is available to load the locales in the higher suspense boundary.

### React Server Components

For RSC, `registerI18n` function is available to set the i18n configs.
Also you might want to use `mergeTo` so that the server can read locale data synchronously.

Call `registerI18n` first in the server entry or page, then use `useI18n` or `<t._>`.

```tsx
import { defineI18n } from '@simplei18n/core';
import { registerI18n, t, useI18n } from '@simplei18n/core/react';
import mergedLocales from './_i18n/merged';
import type { LocaleKey } from '@simplei18n/core';

defineI18n(
  yaml => yaml`
  # scope: home
  title: 'simplei18n react-server'
  lead: 'Rendered on the <strong>server</strong> with {library}.'
  currentLocale: 'Current locale: {lang}'
`,
);

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getLang = async (searchParams: PageProps['searchParams']): Promise<LocaleKey> => {
  const params = await searchParams;
  const lang = Array.isArray(params?.lang) ? params.lang[0] : params?.lang;
  return lang === 'ko' || lang === 'en_US' ? lang : 'en_US';
};

export default async function Page({ searchParams }: PageProps) {
  const lang = await getLang(searchParams);
  registerI18n(mergedLocales, lang);

  const { ts } = useI18n();

  return (
    <main>
      <t._>{t.home.title}</t._>
      <small>{ts(ts.home.currentLocale, { lang })}</small>
    </main>
  );
}
```

If Client Components also need translations, add a separate client provider.

```tsx
'use client';

import { createI18nResource, I18nProvider } from '@simplei18n/core/react';
import locales from './_i18n';
import type { PropsWithChildren } from 'react';
import type { LocaleKey } from '@simplei18n/core';

const resource = createI18nResource(locales);

export const AppI18nProvider = ({ lang, children }: PropsWithChildren<{ lang: LocaleKey }>) => (
  <I18nProvider lang={lang} resource={resource}>
    {children}
  </I18nProvider>
);
```
