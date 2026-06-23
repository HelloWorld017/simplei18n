import simplei18n from 'simplei18n/vite';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [simplei18n(), vinext()],
});
