import { createHmac, timingSafeEqual } from 'crypto';
import type { OAuthState } from '@/features/oauth/types';

/**
 * Tamper-proof OAuth `state`: `base64url(JSON).base64url(HMAC-SHA256)`.
 *
 * The callback trusts `state.tenantId` to decide which tenant an ad-account
 * token is written to. Without a signature, a user could forge the state and
 * inject their tokens into another tenant. Signing with AUTH_SECRET makes the
 * payload unforgeable; the callback still re-checks the session tenant as
 * defense-in-depth.
 */

function stateSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET (or NEXTAUTH_SECRET) is required to sign OAuth state.');
  }
  return secret;
}

function sign(payloadB64: string): string {
  return createHmac('sha256', stateSecret()).update(payloadB64).digest('base64url');
}

export function signOAuthState(state: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Returns the parsed state only when the signature verifies; otherwise null. */
export function verifyOAuthState(token: string | null | undefined): OAuthState | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = sign(payload);

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as OAuthState;
    if (!parsed || typeof parsed.tenantId !== 'string' || typeof parsed.returnTo !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
