import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@testing-library/react': fileURLToPath(new URL('./tests/helpers/testing-library-shim.tsx', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    fileParallelism: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
