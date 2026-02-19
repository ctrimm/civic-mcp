import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Entry points for pages not managed by CRXJS
      // (CRXJS handles content_scripts and background automatically)
    },
  },
  resolve: {
    alias: {
      '@civic-mcp/sdk': new URL('../../packages/sdk/src/index.ts', import.meta.url).pathname,
    },
  },
});
