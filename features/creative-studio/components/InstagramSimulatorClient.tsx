'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeCheck,
  BatteryFull,
  Bookmark,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  Clapperboard,
  Grid3X3,
  Heart,
  Home,
  Layers,
  Lock,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PlusSquare,
  Search,
  Send,
  Signal,
  User,
  Wifi,
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

/**
 * Poster frame for a video that has no thumbnail image. `#t=0.1` makes the browser
 * seek to the first frame and paint it, and `preload="metadata"` loads only that —
 * a thumbnail-like still without downloading the whole video.
 */
function VideoPosterFrame({ url, className }: { url: string; className?: string }) {
  return (
    <video
      src={`${url}#t=0.1`}
      preload="metadata"
      muted
      playsInline
      // eslint-disable-next-line jsx-a11y/media-has-caption
      className={className}
    />
  );
}

/**
 * A stored thumbnail sometimes points at the video file itself (or the slide is
 * typed 'image' while holding an .mp4). Either way the URL must never reach an
 * <img>, which renders it as a permanently blank tile.
 */
function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0].toLowerCase();
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/.test(path);
}

/**
 * Picks what a square tile should show. Prefers a poster image (real IG never
 * plays video in the grid) and only falls back to a non-preloading <video>.
 * Shared by the grid and the highlights row so the two can't drift apart.
 */
function resolveTileMedia(post: HybridFeedPost): { poster: string | null; videoUrl: string | null } {
  const slide = coverSlide(post);
  const candidate =
    slide?.thumbnailUrl ?? post.posterThumbnailUrl ?? (slide?.type === 'image' ? slide?.url : null) ?? null;

  const poster = isVideoUrl(candidate) ? null : candidate;
  if (poster) return { poster, videoUrl: null };

  // Either the slide is typed video, or a thumbnail was stored pointing at the
  // video file itself — both must go through <video>, never <img>.
  const videoUrl = isVideoUrl(candidate)
    ? candidate
    : slide?.type === 'video' || isVideoUrl(slide?.url)
      ? slide?.url ?? null
      : null;

  return { poster: null, videoUrl };
}

function PostGridThumb({ post }: { post: HybridFeedPost }) {
  const { poster, videoUrl } = resolveTileMedia(post);

  return (
    <div className="group relative aspect-square w-full overflow-hidden bg-black/40">
      {poster ? (
        <Image
          src={poster}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 33vw, 160px"
          unoptimized
        />
      ) : videoUrl ? (
        <VideoPosterFrame url={videoUrl} className="h-full w-full object-cover" />
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

type FeedProfile = {
  handle: string;
  avatarUrl: string | null;
  verified: boolean;
  tenantInitial: string;
};

function FeedPostAvatar({ profile }: { profile: FeedProfile }) {
  return (
    <div className="relative h-8 w-8 shrink-0 rounded-full bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#962fbf] p-[2px]">
      <div className="relative h-full w-full overflow-hidden rounded-full border border-black bg-white/10">
        {profile.avatarUrl ? (
          <Image src={profile.avatarUrl} alt="" fill className="object-cover" sizes="32px" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white/70">
            {profile.tenantInitial}
          </div>
        )}
      </div>
    </div>
  );
}

/** A single Instagram-style feed post: header, swipeable media, action row, caption. */
function FeedPostCard({
  post,
  profile,
  liked,
  onToggleLike,
}: {
  post: HybridFeedPost;
  profile: FeedProfile;
  liked: boolean;
  onToggleLike: () => void;
}) {
  const t = useTranslations('Tenant.instagramSimulator');
  const slides = useMemo(
    () => [...(post.slides ?? [])].sort((a, b) => a.slideIndex - b.slideIndex),
    [post.slides],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [pop, setPop] = useState(false);
  const lastTap = useRef(0);

  function syncIdx() {
    const el = scrollRef.current;
    if (!el || slides.length < 2) return;
    const w = el.clientWidth;
    if (w < 1) return;
    setIdx(Math.max(0, Math.min(Math.round(el.scrollLeft / w), slides.length - 1)));
  }

  function doubleTapLike() {
    if (!liked) onToggleLike();
    setPop(true);
    window.setTimeout(() => setPop(false), 750);
  }

  function onMediaTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      doubleTapLike();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  return (
    <article data-post-id={post.id} className="border-b border-white/10">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <FeedPostAvatar profile={profile} />
        <span className="flex items-center gap-1 text-sm font-semibold text-white">
          {profile.handle}
          {profile.verified && <BadgeCheck className="h-3.5 w-3.5 fill-[#3897f0] text-black" aria-hidden />}
        </span>
        <MoreHorizontal className="ml-auto h-5 w-5 text-white/70" aria-hidden />
      </div>

      {/* Media — swipeable carousel + double-tap to like */}
      <div className="relative select-none bg-black" onClick={onMediaTap}>
        <div
          ref={scrollRef}
          onScroll={syncIdx}
          className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto scrollbar-none bg-black"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {slides.length === 0 ? (
            <div className="flex aspect-square w-full items-center justify-center bg-white/[0.04]">
              <Grid3X3 className="h-10 w-10 text-white/20" />
            </div>
          ) : (
            slides.map((slide) => (
              <div key={slide.id} className="relative aspect-square w-full shrink-0 snap-center snap-always bg-black">
                {slide.type === 'video' ? (
                  <video
                    src={`${slide.url}#t=0.1`}
                    controls
                    playsInline
                    preload="metadata"
                    poster={slide.thumbnailUrl ?? undefined}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Image src={slide.thumbnailUrl ?? slide.url} alt="" fill className="object-cover" sizes="490px" unoptimized />
                )}
              </div>
            ))
          )}
        </div>

        {slides.length > 1 && (
          <div className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
            {idx + 1}/{slides.length}
          </div>
        )}

        <AnimatePresence>
          {pop && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.15, 1], opacity: [0, 1, 0.85] }}
              exit={{ opacity: 0, scale: 1.25 }}
              transition={{ duration: 0.5 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <Heart className="h-24 w-24 fill-white text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-4 px-3 pt-3">
        <button type="button" onClick={onToggleLike} aria-label={t('likeAria')} className="press-scale">
          <Heart
            className={cn('h-6 w-6', liked ? 'fill-[#ed4956] text-[#ed4956]' : 'text-white')}
            strokeWidth={liked ? 0 : 1.9}
          />
        </button>
        <MessageCircle className="h-6 w-6 text-white" strokeWidth={1.9} aria-hidden />
        <Send className="h-6 w-6 text-white" strokeWidth={1.9} aria-hidden />
        <Bookmark className="ml-auto h-6 w-6 text-white" strokeWidth={1.9} aria-hidden />
      </div>

      {/* Carousel dots */}
      {slides.length > 1 && (
        <div className="flex justify-center gap-1 pt-2">
          {slides.map((s, i) => (
            <span key={s.id} className={cn('h-1.5 w-1.5 rounded-full', i === idx ? 'bg-[#3897f0]' : 'bg-white/25')} />
          ))}
        </div>
      )}

      {/* Caption */}
      <div className="space-y-1 px-3 pb-3 pt-2">
        <p className="text-sm leading-relaxed">
          <span className="font-semibold text-white">{profile.handle}</span>{' '}
          <span className="whitespace-pre-wrap text-white/75">{post.caption?.trim() || post.title}</span>
        </p>
        <p className="text-[10px] uppercase tracking-wide text-white/30">
          {post.scheduledDate ? formatDate(post.scheduledDate) : '—'}
          {post.scheduledTime ? ` · ${post.scheduledTime.slice(0, 5)}` : ''}
        </p>
      </div>
    </article>
  );
}

/** In-phone feed: tap a grid post → scroll through all posts starting at that one. */
function InPhoneFeedView({
  posts,
  startId,
  profile,
  onBack,
}: {
  posts: HybridFeedPost[];
  startId: string;
  profile: FeedProfile;
  onBack: () => void;
}) {
  const t = useTranslations('Tenant.instagramSimulator');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());

  useLayoutEffect(() => {
    const region = scrollRef.current;
    if (!region) return;
    const target = region.querySelector(`[data-post-id="${CSS.escape(startId)}"]`) as HTMLElement | null;
    if (target) region.scrollTop = target.offsetTop;
  }, [startId]);

  function toggle(id: string) {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 14 }}
      transition={gridTransition}
      className="flex h-full flex-col bg-black"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-2.5">
        <button type="button" onClick={onBack} aria-label={t('backToGrid')} className="press-scale text-white">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <span className="text-base font-semibold text-white">{t('postsHeader')}</span>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-none">
        {posts.map((p) => (
          <FeedPostCard
            key={p.id}
            post={p}
            profile={profile}
            liked={liked.has(p.id)}
            onToggleLike={() => toggle(p.id)}
          />
        ))}
      </div>
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

  const feedProfile: FeedProfile = {
    handle: bareHandle,
    avatarUrl,
    verified: isVerified,
    tenantInitial: tenantName.slice(0, 1).toUpperCase(),
  };

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
        <div className="relative flex w-full max-w-[420px] max-h-[min(88vh,780px)] flex-col overflow-hidden rounded-[3rem] border-[6px] border-white/10 bg-black shadow-2xl md:max-w-[460px] lg:max-w-[490px]">
          <div
            className="pointer-events-none absolute left-1/2 top-3 z-20 h-7 w-32 -translate-x-1/2 rounded-full bg-black/95"
            aria-hidden
          />

          <div className="flex min-h-0 flex-1 flex-col bg-[#000]">
            {/* Status bar */}
            <div className="flex shrink-0 items-center justify-between px-6 pt-3.5 pb-1 text-[12px] font-semibold text-white">
              <span className="tabular-nums">{simTime.slice(0, 5)}</span>
              <div className="flex items-center gap-1.5" aria-hidden>
                <Signal className="h-3.5 w-3.5" />
                <Wifi className="h-3.5 w-3.5" />
                <BatteryFull className="h-4 w-4" />
              </div>
            </div>

            {/* IG top app bar */}
            <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-2">
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

            {!selected && (
              <>
            {/* Profile header */}
            <div className="shrink-0 px-5 pb-3 pt-2 md:px-6">
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
                  const { poster: hlPoster, videoUrl: hlVideo } = resolveTileMedia(post);
                  return (
                    <div key={`hl-${post.id}`} className="flex w-16 shrink-0 flex-col items-center gap-1">
                      <div className="h-16 w-16 overflow-hidden rounded-full border border-white/15 bg-white/[0.04]">
                        {hlPoster ? (
                          <Image
                            src={hlPoster}
                            alt=""
                            width={64}
                            height={64}
                            className="h-full w-full object-cover"
                            sizes="64px"
                            unoptimized
                          />
                        ) : hlVideo ? (
                          <VideoPosterFrame url={hlVideo} className="h-full w-full object-cover" />
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
            <div className="flex shrink-0 border-y border-white/10">
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

              </>
            )}

            {/* Scrollable content — grid/reels or in-phone post viewer */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
            <AnimatePresence mode="wait">
              {selected ? (
                <InPhoneFeedView
                  key={`feed-${selected.id}`}
                  posts={activeTab === 'reels' ? visibleReels : visiblePosts}
                  startId={selected.id}
                  profile={feedProfile}
                  onBack={() => setSelected(null)}
                />
              ) : activeTab === 'tagged' ? (
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
            </div>

            {/* Bottom navigation bar */}
            <div className="mt-auto flex shrink-0 items-center justify-around border-t border-white/10 px-4 py-3">
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
    </div>
  );
}
