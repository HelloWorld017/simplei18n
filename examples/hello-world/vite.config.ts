import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import simplei18n from 'simplei18n/vite';

export default defineConfig({
  plugins: [react(), simplei18n()],
});
