import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Server actions and route handlers pull in Next/Supabase singletons; unit
    // tests target pure logic modules instead.
    exclude: ['node_modules/**', '.next/**', 'monoAI/**'],
  },
});
