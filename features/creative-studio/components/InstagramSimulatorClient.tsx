'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeCheck,
  BatteryFull,
  Bookmark,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Grid3X3,
  Heart,
  Home,
  Layers,
  Lock,
  Menu,
  MessageCircle,
  PlusSquare,
  Search,
  Signal,
  User,
  Wifi,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';
import type { CreativePost, CreativeSlide, HybridFeedPost, InstagramLiveProfile } from '@/features/creative-studio/types';

const spring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };
const gridTransition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

type Props = {
  posts: HybridFeedPost[];
  liveProfile: InstagramLiveProfile;
  tenantName: string;
  brandLogoUrl?: string | null;
  /** Tenant custom domain — surfaced as the profile bio link. */
  websiteUrl?: string | null;
};

type ProfileTab = 'grid' | 'reels' | 'tagged';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultSimTime(): string {
  return '12:00';
}

function formatMetric(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString();
}

/** Strip protocol/trailing slash for a clean IG-style bio link label. */
function prettyDomain(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function ensureHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Hybrid visibility: live posts by published timestamp; scheduled by schedule date/time. */
function isPostVisibleAtSimulation(post: HybridFeedPost, simDate: string, simTime: string): boolean {
  const sim = simTime.length >= 5 ? simTime.slice(0, 5) : simTime;

  if (post.feedSource === 'live') {
    const sortDate = post.sortAt.slice(0, 10);
    if (simDate < sortDate) return false;
    if (simDate > sortDate) return true;
    const sortTime = post.sortAt.length >= 16 ? post.sortAt.slice(11, 16) : '00:00';
    return sim >= sortTime;
  }

  if (!post.scheduledDate) return false;
  const schedDate = post.scheduledDate.slice(0, 10);
  if (simDate < schedDate) return false;
  if (simDate > schedDate) return true;
  if (!post.scheduledTime) return true;
  const sched = post.scheduledTime.length >= 5 ? post.scheduledTime.slice(0, 5) : post.scheduledTime;
  return sim >= sched;
}

function coverSlide(post: CreativePost): CreativeSlide | null {
  const slides = [...(post.slides ?? [])].sort((a, b) => a.slideIndex - b.slideIndex);
  return slides[0] ?? null;
}

function PostGridThumb({ post }: { post: HybridFeedPost }) {
  const slide = coverSlide(post);
  const src = slide?.thumbnailUrl ?? slide?.url ?? post.posterThumbnailUrl;
  const isVideo = slide?.type === 'video' || post.contentFormat === 'reel';

  return (
    <div className="group relative aspect-square w-full overflow-hidden bg-black/40">
      {src ? (
        isVideo ? (
          <video src={slide?.url ?? src} className="h-full w-full object-cover" muted playsInline />
        ) : (
          <Image
            src={src}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 33vw, 160px"
            unoptimized
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/[0.04]">
          <Grid3X3 className="h-7 w-7 text-white/20 md:h-8 md:w-8" />
        </div>
      )}
      {post.contentFormat === 'carousel' && (post.slides?.length ?? 0) > 1 && (
        <Layers className="absolute top-2 right-2 h-4 w-4 text-white drop-shadow-md md:h-5 md:w-5" strokeWidth={2.5} />
      )}
      {post.contentFormat === 'reel' && (
        <Clapperboard className="absolute top-2 right-2 h-4 w-4 text-white drop-shadow-md md:h-5 md:w-5" strokeWidth={2.5} />
      )}
      {/* Desktop hover overlay — IG-style interaction glyphs (no fabricated counts). */}
      <div className="pointer-events-none absolute inset-0 hidden items-center justify-center gap-5 bg-black/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:flex">
        <span className="flex items-center gap-1.5 text-white">
          <Heart className="h-5 w-5 fill-white" />
        </span>
        <span className="flex items-center gap-1.5 text-white">
          <MessageCircle className="h-5 w-5 fill-white" />
        </span>
      </div>
    </div>
  );
}

function PostDetailModal({
  post,
  onClose,
}: {
  post: HybridFeedPost;
  onClose: () => void;
}) {
  const t = useTranslations('Tenant.instagramSimulator');
  const slides = useMemo(
    () => [...(post.slides ?? [])].sort((a, b) => a.slideIndex - b.slideIndex),
    [post.slides],
  );
  const [idx, setIdx] = useState(0);
  const current = slides[idx] ?? null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        transition={spring}
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full bg-black/50 p-2 text-white/80 hover:text-white"
          aria-label={t('closeModal')}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex min-h-[280px] flex-1 items-center justify-center bg-black md:min-h-[420px]">
          {current ? (
            current.type === 'video' ? (
              <video
                key={current.id}
                src={current.url}
                controls
                className="max-h-[70vh] max-w-full object-contain"
              />
            ) : (
              <div className="relative h-full min-h-[280px] w-full md:min-h-[420px]">
                <Image
                  src={current.url}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="(max-width:768px) 100vw, 50vw"
                  unoptimized
                />
              </div>
            )
          ) : null}

          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIdx((i) => (i - 1 + slides.length) % slides.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"
                aria-label={t('prevSlide')}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setIdx((i) => (i + 1) % slides.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"
                aria-label={t('nextSlide')}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
                {slides.map((_, i) => (
                  <span
                    key={slides[i].id}
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      i === idx ? 'bg-white' : 'bg-white/35',
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex w-full flex-col border-t border-white/10 md:w-[340px] md:border-l md:border-t-0">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-white/90">{post.title}</p>
            <p className="mt-1 text-[11px] text-white/40">
              {post.scheduledDate ? formatDate(post.scheduledDate) : '—'}
              {post.scheduledTime ? ` · ${post.scheduledTime.slice(0, 5)}` : ''}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{t('captionLabel')}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
              {post.caption?.trim() || t('noCaption')}
            </p>
            <div className="mt-4 space-y-1 text-[11px] text-white/35">
              <p>
                {t('formatLabel')}: <span className="text-white/60">{post.contentFormat}</span>
              </p>
              <p>
                {t('slidesLabel')}: <span className="text-white/60">{slides.length}</span>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Empty-state block reused across grid / reels / tagged tabs. */
function TabEmptyState({ title, subtitle, motionKey }: { title: string; subtitle: string; motionKey: string }) {
  return (
    <motion.div
      key={motionKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={gridTransition}
      className="px-6 py-16 text-center md:py-20"
    >
      <p className="text-sm text-white/50 md:text-base">{title}</p>
      <p className="mt-2 text-xs text-white/30 md:text-sm">{subtitle}</p>
    </motion.div>
  );
}

function PostGrid({
  posts,
  motionKey,
  onSelect,
}: {
  posts: HybridFeedPost[];
  motionKey: string;
  onSelect: (post: HybridFeedPost) => void;
}) {
  return (
    <motion.div
      key={motionKey}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={gridTransition}
      className="grid grid-cols-3 gap-[2px] bg-black"
    >
      {posts.map((post, index) => (
        <motion.button
          key={post.id}
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...gridTransition, delay: Math.min(index * 0.03, 0.24) }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(post)}
          className="relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50"
        >
          <PostGridThumb post={post} />
        </motion.button>
      ))}
    </motion.div>
  );
}

export function InstagramSimulatorClient({
  posts,
  liveProfile,
  tenantName,
  brandLogoUrl,
  websiteUrl,
}: Props) {
  const t = useTranslations('Tenant.instagramSimulator');
  const [simDate, setSimDate] = useState(todayIsoDate);
  const [simTime, setSimTime] = useState(defaultSimTime);
  const [selected, setSelected] = useState<HybridFeedPost | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('grid');

  const visiblePosts = useMemo(
    () => posts.filter((p) => isPostVisibleAtSimulation(p, simDate, simTime)),
    [posts, simDate, simTime],
  );

  const visibleReels = useMemo(
    () => visiblePosts.filter((p) => p.contentFormat === 'reel'),
    [visiblePosts],
  );

  /** Up to 5 recent covers surfaced as pseudo story-highlights. */
  const highlights = useMemo(() => visiblePosts.slice(0, 5), [visiblePosts]);

  const gridMotionKey = `${simDate}|${simTime}|${visiblePosts.map((p) => p.id).join(',')}`;
  const reelsMotionKey = `reels|${simDate}|${simTime}|${visibleReels.map((p) => p.id).join(',')}`;

  const displayName = liveProfile.name?.trim() || tenantName;
  const displayHandle = liveProfile.username
    ? `@${liveProfile.username}`
    : `@${tenantName.toLowerCase().replace(/\s+/g, '')}`;
  const bareHandle = displayHandle.replace(/^@/, '');
  const avatarUrl = liveProfile.profilePictureUrl ?? brandLogoUrl ?? null;
  const hasStoryRing = Boolean(avatarUrl);
  const isVerified = liveProfile.connected;
  const bioLink = websiteUrl?.trim() ? websiteUrl.trim() : null;

  const postsStat =
    liveProfile.connected && liveProfile.mediaCount != null
      ? formatMetric(liveProfile.mediaCount)
      : String(visiblePosts.length);

  const bottomNav = [
    { icon: Home, label: t('navHome'), active: true },
    { icon: Search, label: t('navSearch'), active: false },
    { icon: PlusSquare, label: t('navCreate'), active: false },
    { icon: Clapperboard, label: t('navReels'), active: false },
    { icon: User, label: t('navProfile'), active: false },
  ];

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-8 px-2 md:px-4 lg:grid-cols-[1fr_360px]">
      {/* Page header — full width */}
      <div className="col-span-1 space-y-1 lg:col-span-2">
        <h1 className="text-xl font-semibold tracking-tight text-white/90 md:text-2xl">{t('pageTitle')}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-white/40 md:text-base">{t('pageSubtitle')}</p>
      </div>

      {/* Phone mockup — left / center column */}
      <div className="flex w-full justify-center lg:justify-end">
        <div className="relative w-full max-w-[420px] overflow-hidden rounded-[3rem] border-[6px] border-white/10 bg-black shadow-2xl md:max-w-[460px] lg:max-w-[490px]">
          <div
            className="pointer-events-none absolute left-1/2 top-3 z-20 h-7 w-32 -translate-x-1/2 rounded-full bg-black/95"
            aria-hidden
          />

          <div className="bg-[#000] pb-0">
            {/* Status bar */}
            <div className="flex items-center justify-between px-6 pt-3.5 pb-1 text-[12px] font-semibold text-white">
              <span className="tabular-nums">{simTime.slice(0, 5)}</span>
              <div className="flex items-center gap-1.5" aria-hidden>
                <Signal className="h-3.5 w-3.5" />
                <Wifi className="h-3.5 w-3.5" />
                <BatteryFull className="h-4 w-4" />
              </div>
            </div>

            {/* IG top app bar */}
            <div className="flex items-center justify-between px-5 pb-2 pt-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Lock className="h-3.5 w-3.5 text-white/80 shrink-0" aria-hidden />
                <span className="truncate text-base font-semibold text-white">{bareHandle}</span>
                <ChevronDown className="h-4 w-4 text-white/80 shrink-0" aria-hidden />
              </div>
              <div className="flex items-center gap-4 text-white">
                <button type="button" aria-label={t('createAria')} disabled className="opacity-90">
                  <PlusSquare className="h-6 w-6" strokeWidth={1.75} />
                </button>
                <button type="button" aria-label={t('accountMenu')} disabled className="opacity-90">
                  <Menu className="h-6 w-6" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* Profile header */}
            <div className="px-5 pb-3 pt-2 md:px-6">
              <div className="flex items-center gap-5 md:gap-6">
                <div
                  className={cn(
                    'relative shrink-0 rounded-full p-[3px]',
                    hasStoryRing
                      ? 'bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#962fbf]'
                      : 'bg-white/10',
                  )}
                >
                  <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-black bg-gradient-to-br from-purple-500/30 to-amber-500/20 md:h-24 md:w-24">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="96px"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-bold text-white/70 md:text-2xl">
                        {tenantName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 justify-around gap-2 text-center tracking-tight">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold tabular-nums text-white md:text-base">{postsStat}</p>
                    <p className="text-xs text-white/45 md:text-sm">{t('statPosts')}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold tabular-nums text-white md:text-base">
                      {formatMetric(liveProfile.followersCount)}
                    </p>
                    <p className="text-xs text-white/45 md:text-sm">{t('statFollowers')}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold tabular-nums text-white md:text-base">
                      {formatMetric(liveProfile.followsCount)}
                    </p>
                    <p className="text-xs text-white/45 md:text-sm">{t('statFollowing')}</p>
                  </div>
                </div>
              </div>

              {/* Bio block */}
              <div className="mt-3 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold tracking-tight text-white">{displayName}</p>
                  {isVerified && (
                    <BadgeCheck className="h-4 w-4 shrink-0 fill-[#3897f0] text-black" aria-label={t('verified')} />
                  )}
                </div>
                <p className="truncate text-sm text-white/45">{displayHandle}</p>
                {bioLink && (
                  <a
                    href={ensureHref(bioLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('websiteAria')}
                    className="inline-block max-w-full truncate text-sm font-medium text-[#e0f1ff]/90 hover:underline"
                  >
                    {prettyDomain(bioLink)}
                  </a>
                )}
              </div>

              <button
                type="button"
                disabled
                className="mt-4 w-full rounded-lg border border-white/15 bg-white/[0.06] py-2 text-xs font-semibold text-white/80 md:py-2.5 md:text-sm"
              >
                {t('editProfile')}
              </button>
            </div>

            {/* Story highlights */}
            {highlights.length > 0 && (
              <div className="flex gap-4 overflow-x-auto px-5 pb-4 pt-1 scrollbar-thin md:px-6">
                <div className="flex w-16 shrink-0 flex-col items-center gap-1">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 text-white/60">
                    <PlusSquare className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <span className="w-full truncate text-center text-[11px] text-white/55">{t('storyNew')}</span>
                </div>
                {highlights.map((post) => {
                  const cover = coverSlide(post);
                  const src = cover?.thumbnailUrl ?? cover?.url ?? post.posterThumbnailUrl;
                  return (
                    <div key={`hl-${post.id}`} className="flex w-16 shrink-0 flex-col items-center gap-1">
                      <div className="h-16 w-16 overflow-hidden rounded-full border border-white/15 bg-white/[0.04]">
                        {src ? (
                          <Image
                            src={src}
                            alt=""
                            width={64}
                            height={64}
                            className="h-full w-full object-cover"
                            sizes="64px"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Grid3X3 className="h-5 w-5 text-white/25" />
                          </div>
                        )}
                      </div>
                      <span className="w-full truncate text-center text-[11px] text-white/55">{post.title}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab strip — grid / reels / tagged */}
            <div className="flex border-y border-white/10">
              {(
                [
                  { id: 'grid' as const, icon: Grid3X3, label: t('tabGrid') },
                  { id: 'reels' as const, icon: Clapperboard, label: t('tabReels') },
                  { id: 'tagged' as const, icon: Bookmark, label: t('tabTagged') },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  aria-label={label}
                  aria-current={activeTab === id ? 'page' : undefined}
                  className={cn(
                    'flex flex-1 items-center justify-center py-3 transition-colors md:py-3.5',
                    activeTab === id
                      ? 'border-b-2 border-white text-white'
                      : 'border-b-2 border-transparent text-white/35 hover:text-white/55',
                  )}
                >
                  <Icon className="h-5 w-5 md:h-[22px] md:w-[22px]" strokeWidth={activeTab === id ? 2.25 : 1.75} />
                </button>
              ))}
            </div>

            {/* Grid / tab content */}
            <AnimatePresence mode="wait">
              {activeTab === 'tagged' ? (
                <TabEmptyState
                  key="tab-tagged"
                  motionKey="tab-tagged"
                  title={t('taggedEmptyTitle')}
                  subtitle={t('taggedEmptySubtitle')}
                />
              ) : activeTab === 'reels' ? (
                visibleReels.length === 0 ? (
                  <TabEmptyState
                    key={`reels-empty-${reelsMotionKey}`}
                    motionKey={`reels-empty-${reelsMotionKey}`}
                    title={t('reelsEmptyTitle')}
                    subtitle={t('reelsEmptySubtitle')}
                  />
                ) : (
                  <PostGrid posts={visibleReels} motionKey={reelsMotionKey} onSelect={setSelected} />
                )
              ) : visiblePosts.length === 0 ? (
                <TabEmptyState
                  key={`empty-${gridMotionKey}`}
                  motionKey={`empty-${gridMotionKey}`}
                  title={t('emptyGridTitle')}
                  subtitle={t('emptyGridSubtitle')}
                />
              ) : (
                <PostGrid posts={visiblePosts} motionKey={gridMotionKey} onSelect={setSelected} />
              )}
            </AnimatePresence>

            {/* Bottom navigation bar */}
            <div className="mt-1 flex items-center justify-around border-t border-white/10 px-4 py-3">
              {bottomNav.map(({ icon: Icon, label, active }) => (
                <span key={label} aria-label={label} className={active ? 'text-white' : 'text-white/45'}>
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline controls — right column, sticky on desktop */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl md:p-6"
        >
          <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35 md:text-xs">
            <CalendarClock className="h-4 w-4" />
            {t('timelineLabel')}
          </div>
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs text-white/45 md:text-sm">{t('simDate')}</span>
              <input
                type="date"
                value={simDate}
                onChange={(e) => setSimDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/85 outline-none transition-colors focus:border-white/25 md:text-base"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-white/45 md:text-sm">{t('simTime')}</span>
              <input
                type="time"
                value={simTime}
                onChange={(e) => setSimTime(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/85 outline-none transition-colors focus:border-white/25 md:text-base"
              />
            </label>
          </div>
          <motion.p
            key={visiblePosts.length}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="mt-4 text-xs leading-relaxed text-white/40 md:text-sm"
          >
            {t('timelineHint', { count: visiblePosts.length })}
          </motion.p>
        </div>
      </div>

      <AnimatePresence>
        {selected ? <PostDetailModal post={selected} onClose={() => setSelected(null)} /> : null}
      </AnimatePresence>
    </div>
  );
}
