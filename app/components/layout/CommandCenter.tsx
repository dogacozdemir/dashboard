'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Command,
  BarChart3,
  Clapperboard,
  Globe,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { sessionHasPermission } from '@/lib/auth/session-capabilities';
import type { PermissionSlug, SessionUser } from '@/types/user';
import { COMMAND_NAV, COMMAND_QUICK } from '@/features/command-center/registry';
import {
  searchCommandData,
  interpretNaturalLanguageCommand,
  syncAllConnectedPlatformsAction,
  type CommandDataRow,
} from '@/features/command-center/actions/commandCenterActions';
import { getAdminRolesUrl } from '@/lib/utils/tenant-urls';

const OPEN_EVENT = 'madmonos:command-open';

export type CommandCenterProps = {
  companyId: string;
  user: SessionUser;
};

type FlatItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void | Promise<void>;
};

function norm(s: string): string {
  return s.toLowerCase().trim();
}

function matchesQuery(q: string, title: string, keywords: string[]): boolean {
  if (!q) return true;
  const n = norm(q);
  if (norm(title).includes(n)) return true;
  return keywords.some((k) => k.includes(n) || n.includes(k));
}

function hasPerm(user: SessionUser, slug?: PermissionSlug): boolean {
  if (!slug) return true;
  return sessionHasPermission(user, slug);
}

function looksLikeNl(q: string): boolean {
  const t = q.trim();
  if (t.length < 6 && !/\?/.test(t)) return false;
  return (
    /\?/.test(t) ||
    /^(what|how|why|ne |nasıl|neden|durum|göster|check)/i.test(t) ||
    t.length > 36
  );
}

export function CommandCenter({ companyId, user }: CommandCenterProps) {
  const tNav = useTranslations('Common.commandNav');
  const tQuick = useTranslations('Common.commandQuick');
  const tCom = useTranslations('Common');
  const tPalette = useTranslations('Common.commandPalette');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [dataHits, setDataHits] = useState<CommandDataRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState<{ href: string; spotlight: string | null; label: string } | null>(
    null
  );
  const syncLock = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dataTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navigate = useCallback(
    (path: string, spotlight?: string | null) => {
      setOpen(false);
      setQuery('');
      if (spotlight) {
        router.push(`${path}?focus=${encodeURIComponent(spotlight)}`);
      } else {
        router.push(path);
      }
    },
    [router]
  );

  const navItems = useMemo(() => {
    const q = query.trim();
    return COMMAND_NAV.filter((e) => hasPerm(user, e.require)).filter((e) =>
      matchesQuery(q, tNav(e.titleKey), e.keywords)
    );
  }, [query, user, tNav]);

  const quickItems = useMemo(() => {
    const q = query.trim();
    return COMMAND_QUICK.filter((e) => {
      if (e.superAdminOnly && user.role !== 'super_admin') return false;
      if (e.require && !hasPerm(user, e.require)) return false;
      return matchesQuery(q, tQuick(e.titleKey), e.keywords);
    });
  }, [query, user, tQuick]);

  const flatItems: FlatItem[] = useMemo(() => {
    const rows: FlatItem[] = [];

    if (aiHint) {
      rows.push({
        id: 'ai-hint',
        title: aiHint.label,
        subtitle: tPalette('aiHintSubtitle'),
        icon: Sparkles,
        onSelect: () => navigate(aiHint.href, aiHint.spotlight),
      });
    }

    for (const e of navItems) {
      const Icon = e.icon;
      rows.push({
        id: e.id,
        title: tNav(e.titleKey),
        subtitle: tCom('navigationSubtitle'),
        icon: Icon,
        onSelect: () => navigate(e.href),
      });
    }

    for (const e of quickItems) {
      const Icon = e.icon;
      if (e.action === 'sync_all') {
        rows.push({
          id: e.id,
          title: tQuick(e.titleKey),
          subtitle: tCom('quickSubtitle'),
          icon: Icon,
          onSelect: async () => {
            if (syncLock.current) return;
            syncLock.current = true;
            try {
              const r = await syncAllConnectedPlatformsAction(companyId);
              if (!r.ok) console.warn(r.error);
              router.refresh();
            } finally {
              syncLock.current = false;
              setOpen(false);
              setQuery('');
            }
          },
        });
        continue;
      }
      if (e.externalHref === '__ADMIN_ROLES__') {
        rows.push({
          id: e.id,
          title: tQuick(e.titleKey),
          subtitle: tCom('quickSubtitle'),
          icon: Icon,
          onSelect: () => {
            window.location.href = getAdminRolesUrl();
          },
        });
        continue;
      }
      if (e.href) {
        rows.push({
          id: e.id,
          title: tQuick(e.titleKey),
          subtitle: tCom('quickSubtitle'),
          icon: Icon,
          onSelect: () => navigate(e.href!),
        });
      }
    }

    for (const d of dataHits) {
      const Icon = d.source === 'campaign' ? BarChart3 : d.source === 'creative' ? Clapperboard : Globe;
      rows.push({
        id: `data-${d.source}-${d.id}`,
        title: d.title,
        subtitle: d.subtitle,
        icon: Icon,
        onSelect: () => navigate(d.href),
      });
    }

    return rows;
  }, [
    navItems,
    quickItems,
    dataHits,
    aiHint,
    navigate,
    companyId,
    router,
    tNav,
    tQuick,
    tCom,
    tPalette,
  ]);

  useEffect(() => {
    setSelected(0);
  }, [query, flatItems.length]);

  useEffect(() => {
    if (selected >= flatItems.length) setSelected(Math.max(0, flatItems.length - 1));
  }, [flatItems.length, selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDataHits([]);
      setAiHint(null);
    }
  }, [open]);

  useEffect(() => {
    if (dataTimer.current) clearTimeout(dataTimer.current);
    const q = query.trim();
    if (q.length < 2 || !open) {
      setDataHits([]);
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    dataTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const rows = await searchCommandData(companyId, q);
          setDataHits(rows);
        } catch {
          setDataHits([]);
        } finally {
          setDataLoading(false);
        }
      })();
    }, 320);
    return () => {
      if (dataTimer.current) clearTimeout(dataTimer.current);
    };
  }, [query, companyId, open]);

  useEffect(() => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    const q = query.trim();
    if (!open || !looksLikeNl(q)) {
      setAiHint(null);
      setAiLoading(false);
      return;
    }
    setAiLoading(true);
    aiTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await interpretNaturalLanguageCommand(companyId, q);
          setAiHint(res);
        } catch {
          setAiHint(null);
        } finally {
          setAiLoading(false);
        }
      })();
    }, 520);
    return () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
    };
  }, [query, companyId, open]);

  useEffect(() => {
    if (!open) return;
    const onTrap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((i) => Math.min(flatItems.length - 1, i + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter' && flatItems[selected]) {
        e.preventDefault();
        void flatItems[selected].onSelect();
      }
    };
    window.addEventListener('keydown', onTrap);
    return () => window.removeEventListener('keydown', onTrap);
  }, [open, flatItems, selected]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const palette = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            key="cmd-backdrop"
            aria-label={tPalette('ariaClose')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[300] bg-[#050308]/55 backdrop-blur-[8px] border-0 p-0 w-full cursor-default"
            onClick={() => setOpen(false)}
          />
          <motion.div
            key="cmd-panel"
            role="dialog"
            aria-modal="true"
            aria-label={tPalette('ariaDialog')}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.9 }}
            className="fixed left-1/2 top-[min(22vh,140px)] z-[310] w-[min(92vw,560px)] -translate-x-1/2 rounded-[2rem] border border-white/10 overflow-hidden"
            style={{
              background: 'rgba(16, 8, 18, 0.78)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              boxShadow:
                '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 24px 80px rgba(0,0,0,0.55), 0 0 120px rgba(156,112,178,0.12)',
            }}
          >
            <div
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#bea042]/40 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[85%] -translate-x-1/2 rounded-full opacity-50"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(190,160,66,0.22) 0%, rgba(156,112,178,0.15) 45%, transparent 70%)',
                filter: 'blur(28px)',
              }}
            />

            <div className="relative p-4 md:p-5 space-y-3">
              <div
                className="flex items-center gap-3 rounded-2xl border border-white/[0.08] px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <Search className="w-4 h-4 text-[#bea042]/70 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tPalette('placeholder')}
                  className="flex-1 bg-transparent text-sm text-white/90 placeholder-white/30 outline-none"
                />
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-white/25 shrink-0">
                  <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08]">
                    <Command className="w-3 h-3 inline" />
                  </kbd>
                  <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08]">K</kbd>
                </div>
              </div>

              {(dataLoading || aiLoading) && (
                <div className="flex items-center gap-2 text-[11px] text-white/35 px-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#bea042]/80" />
                  {aiLoading ? tPalette('loadingAi') : tPalette('loadingData')}
                </div>
              )}

              <div className="max-h-[min(52vh,420px)] overflow-y-auto scrollbar-thin pr-1 space-y-1">
                {flatItems.length === 0 ? (
                  <p className="text-xs text-white/30 text-center py-10">{tPalette('empty')}</p>
                ) : (
                  flatItems.map((item, idx) => {
                    const Icon = item.icon;
                    const active = idx === selected;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setSelected(idx)}
                        onClick={() => void item.onSelect()}
                        className={cn(
                          'w-full flex items-start gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200',
                          active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                        )}
                        style={
                          active
                            ? {
                                boxShadow:
                                  '0 0 0 1px rgba(190,160,66,0.42), 0 0 0 1px rgba(156,112,178,0.22), 0 0 32px rgba(190,160,66,0.14), inset 0 1px 0 rgba(255,255,255,0.07)',
                                background:
                                  'linear-gradient(135deg, rgba(190,160,66,0.1), rgba(156,112,178,0.06))',
                              }
                            : undefined
                        }
                      >
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                            active
                              ? 'border-[#bea042]/35 bg-[#bea042]/10 text-[#e8d48a]'
                              : 'border-white/[0.08] bg-white/[0.04] text-white/45'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white/88 leading-snug truncate">{item.title}</p>
                          <p className="text-[11px] text-white/35 mt-0.5 truncate">{item.subtitle}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <p className="text-[10px] text-white/25 text-center pt-1">{tPalette('footerHint')}</p>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  return mounted ? createPortal(palette, document.body) : null;
}
