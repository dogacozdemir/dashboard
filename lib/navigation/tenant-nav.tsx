import {
  LayoutDashboard,
  BarChart3,
  Clapperboard,
  Globe,
  Shield,
  MessageSquare,
  CalendarDays,
  Brain,
  Trophy,
  FileText,
} from 'lucide-react';

/** Instagram glyph (lucide has no first-party IG icon). */
export function InstagramNavIcon({
  className,
  strokeWidth = 2,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export type TenantNavLabelKey =
  | 'overview'
  | 'performanceHub'
  | 'creativeStudio'
  | 'seoGeo'
  | 'brandVault'
  | 'chat'
  | 'monoAi'
  | 'masteryHall'
  | 'opsCalendar'
  | 'instagramPreview'
  | 'boardReport';

/** Short labels shown under mobile-dock bar icons (Dashboard.mobileNav namespace). */
export type TenantNavShortKey = 'home' | 'performance' | 'creative' | 'chat';

/** Where an item sits in the mobile dock: primary bar (left/right) or the gem stack. */
export type MobileSlot = 'left' | 'right' | 'stack';

export interface TenantNavItem {
  href: string;
  labelKey: TenantNavLabelKey;
  shortLabelKey?: TenantNavShortKey;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badgeKey?: 'badgeLive' | 'badgeAi';
  color?: string;
  mobile: MobileSlot;
}

/**
 * Single source of truth for tenant navigation.
 * Both the desktop Sidebar and the mobile dock derive from this list, so a new
 * page can never again exist on desktop but be missing on mobile.
 */
export const TENANT_NAV: TenantNavItem[] = [
  { href: '/dashboard', labelKey: 'overview', shortLabelKey: 'home', icon: LayoutDashboard, mobile: 'left' },
  { href: '/mastery', labelKey: 'masteryHall', icon: Trophy, color: 'amber', mobile: 'stack' },
  { href: '/performance', labelKey: 'performanceHub', shortLabelKey: 'performance', icon: BarChart3, badgeKey: 'badgeLive', color: 'cyan', mobile: 'left' },
  { href: '/creative', labelKey: 'creativeStudio', shortLabelKey: 'creative', icon: Clapperboard, color: 'violet', mobile: 'right' },
  { href: '/instagram', labelKey: 'instagramPreview', icon: InstagramNavIcon, color: 'pink', mobile: 'stack' },
  { href: '/strategy', labelKey: 'seoGeo', icon: Globe, color: 'emerald', mobile: 'stack' },
  { href: '/brand-vault', labelKey: 'brandVault', icon: Shield, mobile: 'stack' },
  { href: '/chat', labelKey: 'chat', shortLabelKey: 'chat', icon: MessageSquare, mobile: 'right' },
  { href: '/mono-ai', labelKey: 'monoAi', icon: Brain, badgeKey: 'badgeAi', color: 'indigo', mobile: 'stack' },
  { href: '/board-report', labelKey: 'boardReport', icon: FileText, color: 'gold', mobile: 'stack' },
  { href: '/calendar', labelKey: 'opsCalendar', icon: CalendarDays, mobile: 'stack' },
];

export const TENANT_NAV_LEFT = TENANT_NAV.filter((i) => i.mobile === 'left');
export const TENANT_NAV_RIGHT = TENANT_NAV.filter((i) => i.mobile === 'right');
export const TENANT_NAV_STACK = TENANT_NAV.filter((i) => i.mobile === 'stack');
