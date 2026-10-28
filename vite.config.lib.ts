import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

// Library packaging mode for @folio/engine
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FolioEngine',
      fileName: (format) => `folio.${format === 'es' ? 'js' : 'umd.cjs'}`,
      cssFileName: 'style',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // Strictly externalize React runtime to prevent dual-React issues
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
      },
    },
  },
});
