import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from the domain root (Firebase Hosting), so deep links like /auth/action still find /assets.
  base: '/',
  server: { port: 5173, open: false },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
