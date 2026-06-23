import simplei18n from '@simplei18n/core/vite';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [simplei18n(), vinext()],
});
