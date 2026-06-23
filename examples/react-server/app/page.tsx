import { defineI18n, LocaleKey } from 'simplei18n';
import { registerI18n, t, useI18n } from 'simplei18n/react';
import mergedLocales from './_i18n/merged';
import { ClientCounter } from './client-counter';
import { AppI18nProvider } from './i18n-provider';

defineI18n(yaml => yaml`
  # scope: home
  title: 'simplei18n react-server'
  lead: 'This text is rendered on the <strong>server</strong> with {library}.'
  currentLocale: 'Current locale: {lang}'
  clientTitle: 'Client component'
  clientCount: 'Client clicks'
  clientIncrement: 'Increment on client'
  switchEnglish: 'English'
  switchKorean: 'Korean'
`);

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getLang = async (searchParams: PageProps['searchParams']): Promise<LocaleKey> => {
  const params = await searchParams;
  const lang = Array.isArray(params?.lang) ? params.lang[0] : params?.lang;
  return lang === 'ko' || lang === 'en_US' ? lang : 'en_US';
};

const LocaleBadge = () => {
  const { lang, ts } = useI18n();

  return <p className='locale'>{ts(ts.home.currentLocale, { lang })}</p>;
};

export default async function Page({ searchParams }: PageProps) {
  const lang = await getLang(searchParams);
  registerI18n(mergedLocales, lang);

  const { ts } = useI18n();

  return (
    <main>
      <section className='hero'>
        <p className='eyebrow'>React Server Components + vinext</p>
        <h1>
          <t._>{t.home.title}</t._>
        </h1>
        <p className='lead'>
          <t._ library='simplei18n' $tags={{ strong: 'strong' }}>
            {t.home.lead}
          </t._>
        </p>
        <LocaleBadge />
        <AppI18nProvider lang={lang}>
          <ClientCounter
            title={ts(ts.home.clientTitle)}
            countLabel={ts(ts.home.clientCount)}
            incrementLabel={ts(ts.home.clientIncrement)}
          />
        </AppI18nProvider>
        <nav aria-label='Language switcher'>
          <a href='/?lang=en_US'>
            <t._>{t.home.switchEnglish}</t._>
          </a>
          <a href='/?lang=ko'>
            <t._>{t.home.switchKorean}</t._>
          </a>
        </nav>
      </section>
    </main>
  );
}
