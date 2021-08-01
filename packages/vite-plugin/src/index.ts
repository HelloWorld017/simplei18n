import { load } from '@simplei18n/parser';

const viteSimpleI18n = () => ({
	name: '@simplei18n/vite-plugin',

	transform(src: string, id: string) {
		if (!id.endsWith('.i18n.yml')) {
			return;
		}
		
		return load(src);
	}
});

export default viteSimpleI18n;
