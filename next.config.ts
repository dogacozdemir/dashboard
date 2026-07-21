import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
  // PDF generation reads the embedded Unicode fonts from disk at runtime; make sure
  // they are traced into the serverless bundle (otherwise Turkish falls back to ASCII).
  outputFileTracingIncludes: {
    '/api/**': ['./assets/fonts/**'],
    '/board-report': ['./assets/fonts/**'],
  },
};

export default withNextIntl(nextConfig);
