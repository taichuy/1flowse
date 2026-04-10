import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@1flowse/shared-types': fileURLToPath(
        new URL('../packages/shared-types/src/index.ts', import.meta.url)
      ),
      '@1flowse/api-client': fileURLToPath(
        new URL('../packages/api-client/src/index.ts', import.meta.url)
      ),
      '@1flowse/ui': fileURLToPath(
        new URL('../packages/ui/src/index.tsx', import.meta.url)
      ),
      '@1flowse/flow-schema': fileURLToPath(
        new URL('../packages/flow-schema/src/index.ts', import.meta.url)
      ),
      '@1flowse/page-protocol': fileURLToPath(
        new URL('../packages/page-protocol/src/index.ts', import.meta.url)
      ),
      '@1flowse/page-runtime': fileURLToPath(
        new URL('../packages/page-runtime/src/index.ts', import.meta.url)
      ),
      '@1flowse/embed-sdk': fileURLToPath(
        new URL('../packages/embed-sdk/src/index.ts', import.meta.url)
      )
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts'
  }
});
