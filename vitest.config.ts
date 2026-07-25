import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // Next.js marker package with no Node entry point; a no-op in tests.
      'server-only': new URL('./tests/stubs/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Server actions and route handlers pull in Next/Supabase singletons; unit
    // tests target pure logic modules instead.
    exclude: ['node_modules/**', '.next/**', 'monoAI/**'],
  },
});
