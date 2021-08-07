# simplei18n
> Yet another simple, minimal i18n library

## Usage
### Bundler
You should add the `simplei18n` plugin in your bundler.

```ts
/* vite.config.js */
import simplei18n from '@simplei18n/vite-plugin';

export default {
	// ...some other configs
	plugins: [
		// ...other plugins
		simplei18n()
	]
};
```

It will transpile your `.i18n.yml` files into the simplei18n format.

### Translation
Then, you can start write your translation files.
The translation files should end with `.i18n.yml`

```yaml
// Component.i18n.yml
en:
  someName: >
    You can use {interpolation} and <tagname>tags, or <tag2>nested tags (+ {interpolation2})</tag2></tagname>.
  pluralization:
    singular: 'AAA',
    plural: 'AAAs',

ko:
  someName: >
    {interpolation}과 <tagname>태그, 또는 <tag2>겹쳐진 태그 (+ {interpolation2})</tag2></tagname>를 사용하실 수 있습니다.
  pluralization: 'AAA'
```

### React
Once you have set up your bundler, you can use the simplei18n.

```tsx
import { I18nContext, useI18n } from '@simplei18n/react';
import GlobalI18n from './Global.i18n.yml';
import MyComponentI18n from './MyComponent.i18n.yml';

const TagComponent = ({ children: ReactNode }): JSX.Element => {
	<span className="tag">{ children }</span>
};

const MyComponent = (): JSX.Element => {
	const { t } = useI18n(MyComponentI18n);
	return (
		<span>
			{
				t('someName', {
					interpolation: 'Interpolation',
					interpolation2: 'Interp',
					tagname: TagComponent,
					tag2: TagComponent
				})
			}

			{
				t('pluralization', { $count: 2 })
			}
		</span>
	);
};

const MyComponentWithGlobalI18n = (): JSX.Element => {
	const { t } = useI18n();
	return (
		<span> { t('someNamespace.MyComponent:aaa') } </span>
	)
};

render(
	<I18nContext value={{ lang: 'ko', i18n: GlobalI18n }}>
		<MyComponent />
		<MyComponentWithGlobalI18n />
	</I18nContext>
);
```
