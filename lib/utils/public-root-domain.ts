/**
 * Canonical public host for tenant subdomains.
 * Production: madmonos.com → retroline.madmonos.com
 * Local dev:  lvh.me:3000 → retroline.lvh.me:3000
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function isLocalDevHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return LOCAL_HOSTS.has(h) || h.endsWith('.lvh.me') || h === 'lvh.me';
}

/** e.g. retroline.madmonos.com → madmonos.com, admin.lvh.me → lvh.me */
export function inferRootHostFromHostname(hostname: string): string {
  const host = hostname.split(':')[0].toLowerCase();

  if (isLocalDevHostname(host)) {
    return host.endsWith('.lvh.me') ? 'lvh.me' : host;
  }

  const segments = host.split('.');
  if (segments.length >= 2) {
    return segments.slice(-2).join('.');
  }

  return host;
}

/** Env-based root — used when no Host header is available (build time, scripts). */
export function getPublicRootDomainParts(): { host: string; port: string } {
  const raw = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'lvh.me:3000').trim().toLowerCase();

  const colon = raw.lastIndexOf(':');
  if (colon > -1 && /^\d+$/.test(raw.slice(colon + 1))) {
    return { host: raw.slice(0, colon), port: raw.slice(colon) };
  }
  return { host: raw, port: '' };
}

/** Root domain derived from an incoming Host header — always wins over env at runtime. */
export function getRootDomainPartsFromHost(hostHeader: string): { host: string; port: string } {
  const trimmed = hostHeader.trim();
  const colon = trimmed.lastIndexOf(':');
  const hasPort = colon > -1 && /^\d+$/.test(trimmed.slice(colon + 1));
  const hostname = (hasPort ? trimmed.slice(0, colon) : trimmed.split(':')[0]).toLowerCase();
  const port = hasPort ? trimmed.slice(colon) : '';

  return { host: inferRootHostFromHostname(hostname), port };
}

/** Browser URL building — always derived from the current hostname, never stale env. */
export function getEffectivePublicRootDomainParts(): { host: string; port: string } {
  if (typeof window === 'undefined') {
    return getPublicRootDomainParts();
  }

  const hostname = window.location.hostname.toLowerCase();
  const browserPort = window.location.port ? `:${window.location.port}` : '';

  return {
    host: inferRootHostFromHostname(hostname),
    port: browserPort,
  };
}
