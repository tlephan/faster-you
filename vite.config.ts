import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Use the browser entry (no node:fs/node:crypto imports)
      'sql.js': path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm-browser.js'),
    },
  },
  build: {
    outDir: 'dist',
    // Copy neutralino.js client lib into build output
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  optimizeDeps: {
    include: ['sql.js'],
  },
  server: {
    port: 3000,
  },
});
