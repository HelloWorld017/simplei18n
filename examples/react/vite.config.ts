import react from '@vitejs/plugin-react';
import simplei18n from 'simplei18n/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), simplei18n()],
});
