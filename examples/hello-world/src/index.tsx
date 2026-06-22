import { HelloWorld } from "./components/HelloWorld";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createI18nResource, I18nProvider } from "simplei18n/react";
import i18n from "./i18n";

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root container #root not found.');
}

const resource = createI18nResource(i18n);
createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider lang="ko" resource={resource}>
      <HelloWorld />
    </I18nProvider>
  </StrictMode>
);
