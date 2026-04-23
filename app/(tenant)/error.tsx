'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TenantError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[TenantError]', error.message);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[40vh] gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20">
        <AlertTriangle className="w-5 h-5 text-red-400" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-white/70">Failed to load this section</p>
        <p className="text-xs text-white/30">{error.message}</p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        Retry
      </button>
    </div>
  );
}
