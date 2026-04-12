import react from '../../web/node_modules/@vitejs/plugin-react/dist/index.js';
import { defineConfig } from '../../web/node_modules/vite/dist/node/index.js';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', '@tanstack/react-router', 'zustand'],
          antd: ['antd']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3200,
    strictPort: true
  },
  preview: {
    host: '0.0.0.0',
    port: 3200,
    strictPort: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/_tests/setup.ts'
  }
});
