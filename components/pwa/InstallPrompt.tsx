'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Share, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'madmonos.installPrompt.dismissed.v1';
/** Shown at most once per browser session (so it never nags on every navigation). */
const SESSION_KEY = 'madmonos.installPrompt.session.v1';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;
}

export function InstallPrompt() {
  const t = useTranslations('Pwa');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    } catch {
      return;
    }

    const markShownThisSession = () => {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        // ignore
      }
    };

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setOpen(true);
      markShownThisSession();
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS never fires beforeinstallprompt — offer manual A2HS guidance instead.
    if (isIOS()) {
      setShowIos(true);
      setOpen(true);
      markShownThisSession();
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    dismiss();
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="fixed inset-x-0 bottom-24 z-[120] mx-auto w-[calc(100%-2rem)] max-w-sm md:bottom-6"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        role="dialog"
        aria-label={showIos ? t('iosTitle') : t('installTitle')}
      >
        <div
          className="relative flex items-start gap-3 rounded-3xl border border-white/[0.12] p-4"
          style={{
            background: 'rgba(22, 10, 22, 0.82)',
            backdropFilter: 'blur(48px) saturate(180%)',
            WebkitBackdropFilter: 'blur(48px) saturate(180%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 24px 60px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ background: 'linear-gradient(145deg, rgba(156,112,178,0.95), rgba(190,160,66,0.95))' }}
          >
            {showIos ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white/90">
              {showIos ? t('iosTitle') : t('installTitle')}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/50">
              {showIos ? t('iosBody') : t('installBody')}
            </p>

            {!showIos && (
              <button
                type="button"
                onClick={install}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9c70b2] to-[#bea042] px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-[#9c70b2]/25 transition-all hover:from-[#b48dc8] hover:to-[#d4b44c]"
              >
                <Download className="h-3.5 w-3.5" />
                {t('installCta')}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label={t('dismiss')}
            className="shrink-0 rounded-xl p-1.5 text-white/35 transition-colors hover:text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
