'use server';

import { unstable_noStore } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantAction } from '@/lib/auth/tenant-guard';
import { decryptToken, unpackToken } from '@/lib/utils/crypto';
import { fetchInstagramFeedPosts } from '@/features/creative-studio/actions/fetchAssets';
import type {
  CreativeContentFormat,
  HybridFeedPost,
  InstagramLiveProfile,
} from '@/features/creative-studio/types';

const GRAPH_VERSION = 'v20.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

type TokenRow = {
  access_token: string;
  iv?: string | null;
};

type PublishingRow = {
  instagram_business_account_id: string | null;
  page_access_token: string | null;
  token_iv: string | null;
};

type MetaProfileResponse = {
  username?: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  error?: { message: string; code?: number };
};

type MetaMediaItem = {
  id: string;
  media_url?: string;
  thumbnail_url?: string;
  media_type?: string;
  caption?: string;
  timestamp?: string;
};

type MetaMediaResponse = {
  data?: MetaMediaItem[];
  error?: { message: string; code?: number };
};

const EMPTY_PROFILE: InstagramLiveProfile = {
  connected: false,
  username: null,
  name: null,
  profilePictureUrl: null,
  followersCount: null,
  followsCount: null,
  mediaCount: null,
};

function decryptPackedToken(packed: string): string {
  return decryptToken(unpackToken(packed));
}

function decryptAccessToken(account: TokenRow): string {
  try {
    const stored = JSON.parse(account.access_token) as {
      encrypted: string;
      iv: string;
      authTag: string;
    };
    if (stored.encrypted && stored.iv && stored.authTag) {
      return decryptToken(stored);
    }
  } catch {
    /* fall through */
  }
  return decryptPackedToken(account.access_token);
}

async function resolveIgCredentials(
  tenantId: string,
): Promise<{ igUserId: string; accessToken: string } | null> {
  const supabase = await createSupabaseServerClient();

  const { data: publishing } = await supabase
    .from('meta_publishing_accounts')
    .select('instagram_business_account_id, page_access_token, token_iv')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const pub = publishing as PublishingRow | null;
  if (pub?.instagram_business_account_id && pub.page_access_token) {
    try {
      const accessToken = decryptPackedToken(pub.page_access_token);
      return { igUserId: pub.instagram_business_account_id, accessToken };
    } catch (e) {
      console.error('[fetchInstagramLiveProfileAndFeed] publishing token decrypt', e);
    }
  }

  const { data: adAccount } = await supabase
    .from('ad_accounts')
    .select('access_token, iv')
    .eq('tenant_id', tenantId)
    .eq('platform', 'meta')
    .eq('is_active', true)
    .maybeSingle();

  if (!adAccount?.access_token) return null;

  let userToken: string;
  try {
    userToken = decryptAccessToken(adAccount as TokenRow);
  } catch (e) {
    console.error('[fetchInstagramLiveProfileAndFeed] ad_accounts token decrypt', e);
    return null;
  }

  try {
    const pagesUrl = new URL(`${GRAPH_BASE}/me/accounts`);
    pagesUrl.searchParams.set(
      'fields',
      'access_token,instagram_business_account{id,username}',
    );
    pagesUrl.searchParams.set('limit', '50');
    pagesUrl.searchParams.set('access_token', userToken);

    const pagesRes = await fetch(pagesUrl.toString(), { next: { revalidate: 0 } });
    const pagesJson = (await pagesRes.json()) as {
      data?: Array<{
        access_token?: string;
        instagram_business_account?: { id: string; username?: string };
      }>;
      error?: { message: string };
    };

    if (!pagesRes.ok || pagesJson.error) {
      console.error('[fetchInstagramLiveProfileAndFeed] pages discovery', pagesJson.error?.message);
      return null;
    }

    const pageWithIg = (pagesJson.data ?? []).find((p) => p.instagram_business_account?.id);
    if (!pageWithIg?.instagram_business_account?.id) return null;

    const pageToken = pageWithIg.access_token ?? userToken;
    return {
      igUserId: pageWithIg.instagram_business_account.id,
      accessToken: pageToken,
    };
  } catch (e) {
    console.error('[fetchInstagramLiveProfileAndFeed] pages discovery', e);
    return null;
  }
}

function mapMediaTypeToFormat(mediaType?: string): CreativeContentFormat {
  if (mediaType === 'VIDEO') return 'reel';
  if (mediaType === 'CAROUSEL_ALBUM') return 'carousel';
  return 'feed_post';
}

function mapMetaMediaToHybridPost(item: MetaMediaItem): HybridFeedPost {
  const timestamp = item.timestamp ?? new Date().toISOString();
  const mediaType = item.media_type ?? 'IMAGE';
  const contentFormat = mapMediaTypeToFormat(mediaType);
  const primaryUrl = item.media_url ?? item.thumbnail_url ?? '';
  const thumb = item.thumbnail_url ?? item.media_url ?? null;

  return {
    id: `meta-live-${item.id}`,
    title: (item.caption?.trim().slice(0, 80) || 'Instagram post').replace(/\n/g, ' '),
    caption: item.caption ?? null,
    platform: 'instagram',
    contentFormat,
    status: 'approved',
    scheduledDate: timestamp.slice(0, 10),
    scheduledTime: timestamp.length >= 16 ? timestamp.slice(11, 16) : null,
    socialPostEventId: null,
    posterThumbnailUrl: thumb,
    uploadedBy: 'meta-graph',
    createdAt: timestamp,
    slides: [
      {
        id: `meta-live-slide-${item.id}`,
        slideIndex: 0,
        title: 'Live media',
        url: primaryUrl,
        thumbnailUrl: thumb,
        type: mediaType === 'VIDEO' ? 'video' : 'image',
        createdAt: timestamp,
      },
    ],
    feedSource: 'live',
    sortAt: timestamp,
  };
}

function mapScheduledToHybrid(post: Awaited<ReturnType<typeof fetchInstagramFeedPosts>>[number]): HybridFeedPost {
  const date = post.scheduledDate ?? post.createdAt.slice(0, 10);
  const time = post.scheduledTime?.slice(0, 5) ?? '12:00';
  const sortAt = `${date}T${time}:00.000Z`;

  return {
    ...post,
    feedSource: 'scheduled',
    sortAt,
  };
}

/**
 * Fetches live Instagram Business profile + recent media from Meta Graph API.
 * Gracefully returns empty profile when token or IG account is unavailable.
 */
export async function fetchInstagramLiveProfileAndFeed(companyId: string): Promise<{
  liveProfileData: InstagramLiveProfile;
  livePosts: HybridFeedPost[];
}> {
  unstable_noStore();
  const tenantId = await requireTenantAction(companyId);

  const creds = await resolveIgCredentials(tenantId);
  if (!creds) {
    return { liveProfileData: { ...EMPTY_PROFILE }, livePosts: [] };
  }

  const { igUserId, accessToken } = creds;

  try {
    const profileUrl = new URL(`${GRAPH_BASE}/${igUserId}`);
    profileUrl.searchParams.set(
      'fields',
      'username,name,profile_picture_url,followers_count,follows_count,media_count',
    );
    profileUrl.searchParams.set('access_token', accessToken);

    const mediaUrl = new URL(`${GRAPH_BASE}/${igUserId}/media`);
    mediaUrl.searchParams.set(
      'fields',
      'id,media_url,thumbnail_url,media_type,caption,timestamp',
    );
    mediaUrl.searchParams.set('limit', '24');
    mediaUrl.searchParams.set('access_token', accessToken);

    const [profileRes, mediaRes] = await Promise.all([
      fetch(profileUrl.toString(), { next: { revalidate: 0 } }),
      fetch(mediaUrl.toString(), { next: { revalidate: 0 } }),
    ]);

    const profileJson = (await profileRes.json()) as MetaProfileResponse;
    const mediaJson = (await mediaRes.json()) as MetaMediaResponse;

    if (!profileRes.ok || profileJson.error) {
      console.error('[fetchInstagramLiveProfileAndFeed] profile', profileJson.error?.message);
      return { liveProfileData: { ...EMPTY_PROFILE }, livePosts: [] };
    }

    if (!mediaRes.ok || mediaJson.error) {
      console.error('[fetchInstagramLiveProfileAndFeed] media', mediaJson.error?.message);
    }

    const liveProfileData: InstagramLiveProfile = {
      connected: true,
      username: profileJson.username ?? null,
      name: profileJson.name ?? null,
      profilePictureUrl: profileJson.profile_picture_url ?? null,
      followersCount:
        typeof profileJson.followers_count === 'number' ? profileJson.followers_count : null,
      followsCount:
        typeof profileJson.follows_count === 'number' ? profileJson.follows_count : null,
      mediaCount: typeof profileJson.media_count === 'number' ? profileJson.media_count : null,
    };

    const livePosts = (mediaJson.data ?? []).map(mapMetaMediaToHybridPost);

    return { liveProfileData, livePosts };
  } catch (e) {
    console.error('[fetchInstagramLiveProfileAndFeed]', e);
    return { liveProfileData: { ...EMPTY_PROFILE }, livePosts: [] };
  }
}

/** Merges Meta live feed with scheduled/approved local creatives for the simulator. */
export async function fetchInstagramHybridSimulatorData(companyId: string): Promise<{
  liveProfileData: InstagramLiveProfile;
  hybridFeedPosts: HybridFeedPost[];
}> {
  unstable_noStore();
  await requireTenantAction(companyId);

  const [{ liveProfileData, livePosts }, scheduledPosts] = await Promise.all([
    fetchInstagramLiveProfileAndFeed(companyId),
    fetchInstagramFeedPosts(companyId),
  ]);

  const scheduledHybrid = scheduledPosts.map(mapScheduledToHybrid);

  const hybridFeedPosts = [...livePosts, ...scheduledHybrid].sort((a, b) => {
    const cmp = a.sortAt.localeCompare(b.sortAt);
    if (cmp !== 0) return cmp;
    return a.id.localeCompare(b.id);
  });

  return { liveProfileData, hybridFeedPosts };
}
