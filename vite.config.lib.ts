import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { builtinModules } from 'node:module';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((mod) => `node:${mod}`),
]);

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        folio: resolve(__dirname, 'src/index.ts'),
        edge: resolve(__dirname, 'src/edge.ts'),
        diagnostics: resolve(__dirname, 'src/diagnostics.ts'),
        'migration-doctor': resolve(__dirname, 'src/diagnostics/migrationDoctor.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: (id) =>
        id === 'react' ||
        id === 'react-dom' ||
        id === 'react/jsx-runtime' ||
        NODE_BUILTINS.has(id),
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'style.css';
          return assetInfo.name || '';
        },
      },
    },
  },
});
