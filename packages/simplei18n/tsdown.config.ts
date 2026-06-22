import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'react-client': './src/integrations/react.tsx',
    'react-server': './src/integrations/react-server.tsx',
    'vite': './src/integrations/vite.ts',
    'cli': './bin/cli.ts',
  },
});
