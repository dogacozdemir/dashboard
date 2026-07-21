'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, Mail, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { updateNotificationPrefs } from '../actions/profileActions';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const EMAIL_KEYS = ['emailCreativeReview', 'emailWeeklyDigest', 'emailAnomaly'] as const;
type EmailKey = (typeof EMAIL_KEYS)[number];
type PushState = 'unsupported' | 'unconfigured' | 'off' | 'on' | 'busy';

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40',
        on ? 'bg-gradient-to-r from-[#9c70b2] to-[#bea042]' : 'bg-white/12',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
          on ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function NotificationSettings({ initialPrefs }: { initialPrefs: Record<string, unknown> }) {
  const t = useTranslations('Features.Profile.notifications');
  const [prefs, setPrefs] = useState<Record<EmailKey, boolean>>(() => {
    const p = {} as Record<EmailKey, boolean>;
    for (const k of EMAIL_KEYS) p[k] = initialPrefs[k] !== false; // opt-out default
    return p;
  });
  const [, startTransition] = useTransition();
  const [push, setPush] = useState<PushState>('busy');

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!vapid || process.env.NODE_ENV !== 'production') {
      setPush('unconfigured');
      return;
    }
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPush('unsupported');
      return;
    }
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setPush(sub ? 'on' : 'off');
      })
      .catch(() => {
        if (!cancelled) setPush('off');
      });
    return () => {
      cancelled = true;
    };
  }, [vapid]);

  function toggleEmail(key: EmailKey) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    startTransition(() => {
      void updateNotificationPrefs({ [key]: next[key] });
    });
  }

  async function togglePush() {
    if (!vapid || push === 'busy' || push === 'unsupported' || push === 'unconfigured') return;
    setPush('busy');
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setPush('off');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setPush('off');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as unknown as BufferSource,
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setPush('on');
    } catch {
      setPush('off');
    }
  }

  return (
    <div className="glass rounded-2xl p-5 border border-white/[0.06] space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-white/50" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/80">{t('heading')}</p>
          <p className="text-xs text-white/40 mt-0.5">{t('subtitle')}</p>
        </div>
      </div>

      <div className="space-y-3">
        {EMAIL_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <Mail className="w-4 h-4 text-white/30 shrink-0" />
              <span className="text-sm text-white/70 truncate">{t(key)}</span>
            </div>
            <Toggle on={prefs[key]} onClick={() => toggleEmail(key)} />
          </div>
        ))}

        {/* Web Push */}
        <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bell className="w-4 h-4 text-white/30 shrink-0" />
            <div className="min-w-0">
              <span className="text-sm text-white/70 block truncate">{t('push')}</span>
              {(push === 'unsupported' || push === 'unconfigured') && (
                <span className="text-[11px] text-white/30">{t('pushUnavailable')}</span>
              )}
            </div>
          </div>
          {push === 'busy' ? (
            <Loader2 className="w-4 h-4 animate-spin text-white/40" />
          ) : (
            <Toggle
              on={push === 'on'}
              onClick={togglePush}
              disabled={push === 'unsupported' || push === 'unconfigured'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
