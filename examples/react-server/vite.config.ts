import simplei18n from 'simplei18n/vite';
import { defineConfig } from 'vite';
import vinext from 'vinext';

export default defineConfig({
  plugins: [simplei18n(), vinext()],
});
