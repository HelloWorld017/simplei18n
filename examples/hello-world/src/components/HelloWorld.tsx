import {defineI18n, yaml} from 'simplei18n';

defineI18n(yaml`
  # scope: helloworld
  hi: 'Hi'
`);

export const HelloWorld = () => {
};
