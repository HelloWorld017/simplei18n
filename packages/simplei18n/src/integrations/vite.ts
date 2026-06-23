import { parse } from '../parser';

const load = (text: string): string => {
  const i18n = parse(text);
  return [`const i18n = ${JSON.stringify(i18n)};`, 'export default i18n;'].join('\n');
};

const viteSimpleI18n = () => ({
  name: 'vite-simplei18n-plugin',
  transform(src: string, id: string) {
    if (!/.i18n.ya?ml$/.test(id)) {
      return undefined;
    }

    return load(src);
  },
});

export default viteSimpleI18n;
