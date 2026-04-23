import type { RealtimeChannel, RealtimeChannelOptions } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from './client';

interface RealtimeTokenResponse {
  token: string;
  expiresIn: number;
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function ensureRealtimeAuth(): Promise<void> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 20_000) {
    return;
  }

  const res = await fetch('/api/realtime-token', {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to get realtime auth token');
  }

  const data = (await res.json()) as RealtimeTokenResponse;
  cachedToken = data.token;
  tokenExpiresAt = now + data.expiresIn * 1000;

  const supabase = createSupabaseBrowserClient();
  supabase.realtime.setAuth(cachedToken);
}

export async function subscribeWithRealtimeAuth(
  channelName: string,
  setup: (channel: RealtimeChannel) => RealtimeChannel,
  options?: RealtimeChannelOptions
): Promise<RealtimeChannel> {
  await ensureRealtimeAuth();
  const supabase = createSupabaseBrowserClient();
  const channel = setup(supabase.channel(channelName, options));
  channel.subscribe();
  return channel;
}
