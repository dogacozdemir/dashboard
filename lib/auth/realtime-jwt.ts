import { createHmac } from 'crypto';

interface RealtimeTokenPayload {
  sub: string;
  role: 'authenticated';
  tenant_id: string;
  exp: number;
  iat: number;
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function signRealtimeJwt(payload: RealtimeTokenPayload): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is required for realtime token signing');
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64Url(signature)}`;
}

export function buildRealtimeToken(userId: string, tenantId: string, ttlSeconds = 60 * 10): string {
  const now = Math.floor(Date.now() / 1000);
  return signRealtimeJwt({
    sub: userId,
    role: 'authenticated',
    tenant_id: tenantId,
    iat: now,
    exp: now + ttlSeconds,
  });
}
