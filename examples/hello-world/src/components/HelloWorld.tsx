import {defineI18n, yaml} from 'simplei18n';
import {t} from 'simplei18n/react';

defineI18n(yaml`
  # scope: helloworld
  hi: 'Hi'
  hello: 'Hello'
  such.wow: 'Such {wow}'
  such.wow2: 'Such <b>{wow}</b>'
`);

export const HelloWorld = () => (
  <>
    <t._ wow="wow">{t.helloworld.such.wow}</t._>
    <t._ wow="wow" $tags={{ b: 'b' }}>
      {t.helloworld.such.wow2}
    </t._>
    <t._>{t.helloworld.hi}</t._>
    <t._>{t.helloworld.hello}</t._>
  </>
);
