import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/integrations/react.tsx',
    './src/integrations/vite.ts',
    './bin/cli.ts'
  ],
});
