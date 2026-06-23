import { defineI18n } from '@simplei18n/core';
import { t } from '@simplei18n/core/react';

defineI18n(
  yaml => yaml`
    # scope: helloworld
    hi: 'Hi'
    hello: 'Hello updated'
    such.wow: 'Such updated {wow}'
    such.wow2: 'Such <b>{wow}</b>'
  `,
);

export const HelloWorld = () => (
  <>
    <t._ wow='wow'>{t.helloworld.such.wow}</t._>
    <t._ wow='wow' $tags={{ b: 'b' }}>
      {t.helloworld.such.wow2}
    </t._>
    <t._>{t.helloworld.hi}</t._>
    <t._>{t.helloworld.hello}</t._>
  </>
);
