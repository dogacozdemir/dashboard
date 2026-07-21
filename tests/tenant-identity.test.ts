import { describe, it, expect } from 'vitest';
import { normalizeTenantSlug, tenantSlugIssue } from '@/features/admin/lib/tenant-slug';
import { normalizeCustomDomainInput, customDomainIssue } from '@/features/admin/lib/custom-domain';
import { SUPPORTED_CURRENCIES, isSupportedCurrency } from '@/features/admin/lib/currencies';

describe('normalizeTenantSlug', () => {
  it('lowercases and hyphenates whitespace', () => {
    expect(normalizeTenantSlug('  Lux Cosmetics  ')).toBe('lux-cosmetics');
  });

  it('drops characters that cannot appear in a subdomain', () => {
    expect(normalizeTenantSlug('Açık/Marka!')).toBe('akmarka');
  });

  it('collapses repeated hyphens and trims edge hyphens', () => {
    expect(normalizeTenantSlug('--a---b--')).toBe('a-b');
  });
});

describe('tenantSlugIssue', () => {
  it('accepts a well-formed slug', () => {
    expect(tenantSlugIssue('retroline')).toBeNull();
  });

  it('rejects an empty slug as required', () => {
    expect(tenantSlugIssue('')).toBe('required');
  });

  it('rejects slugs that do not start with a letter', () => {
    expect(tenantSlugIssue('1brand')).toBe('invalid');
    expect(tenantSlugIssue('-brand')).toBe('invalid');
  });

  it('rejects a single character as too short', () => {
    expect(tenantSlugIssue('a')).toBe('invalid');
  });

  it('guards the reserved subdomains that would shadow the platform', () => {
    for (const reserved of ['admin', 'www', 'api', 'localhost']) {
      expect(tenantSlugIssue(reserved)).toBe('reserved');
    }
  });
});

describe('normalizeCustomDomainInput', () => {
  it('strips scheme, path and port down to a bare hostname', () => {
    expect(normalizeCustomDomainInput('https://Panel.Marka.com:8443/dashboard')).toBe('panel.marka.com');
  });

  it('leaves an already-bare hostname untouched', () => {
    expect(normalizeCustomDomainInput('panel.marka.com')).toBe('panel.marka.com');
  });
});

describe('customDomainIssue', () => {
  it('treats an empty value as "not set", not invalid', () => {
    expect(customDomainIssue('')).toBeNull();
  });

  it('accepts a normal multi-label hostname', () => {
    expect(customDomainIssue('panel.marka.com')).toBeNull();
  });

  it('rejects a single label with no dot', () => {
    expect(customDomainIssue('localhost')).toBe('invalid');
  });

  it('rejects hostnames with a leading or trailing hyphen in a label', () => {
    expect(customDomainIssue('-bad.com')).toBe('invalid');
    expect(customDomainIssue('bad-.com')).toBe('invalid');
  });
});

describe('supported currencies', () => {
  it('offers exactly the codes the admin picker renders', () => {
    expect([...SUPPORTED_CURRENCIES]).toEqual(['TRY', 'USD', 'EUR', 'GBP']);
  });

  it('gates the update action against anything else', () => {
    expect(isSupportedCurrency('TRY')).toBe(true);
    expect(isSupportedCurrency('BTC')).toBe(false);
    // The action uppercases before checking — lowercase must not slip through here.
    expect(isSupportedCurrency('try')).toBe(false);
  });
});
