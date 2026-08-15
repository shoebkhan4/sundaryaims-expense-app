import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  // pdf.js 4 ships top-level await, which the default target rejects. Safari 15+
  // and every browser this app targets support it.
  build: {
    target: 'es2022'
  },
  esbuild: {
    target: 'es2022'
  },
  // Dependency pre-bundling has its own target, and pdf.js is pre-bundled.
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022'
    }
  },
  server: {
    port: 5173,
    host: true
  }
});
