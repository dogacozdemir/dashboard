import Link from 'next/link';
import { motion } from 'framer-motion';
import { Compass, ArrowLeft } from 'lucide-react';

// This is a server component — use regular div not motion.div
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07070E]">
      <div className="glass glow-inset rounded-2xl p-8 max-w-md w-full mx-6 text-center space-y-6">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mx-auto">
          <Compass className="w-7 h-7 text-indigo-400" />
        </div>

        <div className="space-y-2">
          <p className="text-5xl font-bold gradient-text-indigo">404</p>
          <h2 className="text-lg font-semibold text-white/80">Page not found</h2>
          <p className="text-sm text-white/40 leading-relaxed">
            This subdomain or page doesn&apos;t exist, or you may not have access.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
