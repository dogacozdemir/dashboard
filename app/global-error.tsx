'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

/**
 * Root-level error boundary: catches crashes in app/layout.tsx itself.
 * Must be a fully self-contained client component — cannot use providers.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error.message, error.digest);
  }, [error]);

  return (
    <html lang="en" className="h-full dark">
      <body className="h-full bg-[#07070E] antialiased">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div
            className="w-full max-w-sm rounded-[2rem] p-8 text-center"
            style={{
              background: 'rgba(22, 11, 22, 0.88)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 32px 80px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(60px)',
            }}
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
              <AlertTriangle className="h-7 w-7 text-red-400" />
            </div>

            <h1 className="mb-2 text-lg font-semibold text-white/90">
              Something went wrong
            </h1>
            <p className="mb-1 text-sm leading-relaxed text-white/40">
              An unexpected error occurred. Our engineering team has been notified.
            </p>
            {error.digest && (
              <p className="mb-5 font-mono text-[10px] text-white/20">
                Ref: {error.digest}
              </p>
            )}

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.assign('/dashboard')}
                className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2 text-sm text-white/50 transition hover:bg-white/[0.07] hover:text-white/70"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Dashboard
              </button>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
