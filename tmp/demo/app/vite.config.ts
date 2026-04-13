import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tanstack')) {
              return 'tanstack-vendor';
            }

            if (id.includes('antd') || id.includes('@ant-design')) {
              return 'antd-vendor';
            }

            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }
          }

          return undefined;
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3200,
    strictPort: true
  },
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
