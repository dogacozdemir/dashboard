import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  BarChart3,
  Clapperboard,
  Globe,
  Shield,
  MessageSquare,
  Brain,
  CalendarDays,
  UsersRound,
  Upload,
  RefreshCw,
  Sparkles,
  UserCircle,
} from 'lucide-react';
import type { PermissionSlug } from '@/types/user';

/** Keys under `Common.commandNav` in messages/*.json */
export type CommandNavTitleKey =
  | 'dashboardOverview'
  | 'performanceHub'
  | 'creativeStudio'
  | 'seoGeoReport'
  | 'brandVault'
  | 'teamChat'
  | 'monoAi'
  | 'opsCalendar'
  | 'teamManagement'
  | 'profileSettings';

/** Keys under `Common.commandQuick` */
export type CommandQuickTitleKey =
  | 'uploadCreative'
  | 'syncConnected'
  | 'manageRolesPlatform';

export type NavEntry = {
  id: string;
  href: string;
  titleKey: CommandNavTitleKey;
  icon: LucideIcon;
  keywords: string[];
  require?: PermissionSlug;
};

export const COMMAND_NAV: NavEntry[] = [
  {
    id: 'nav-dashboard',
    href: '/dashboard',
    titleKey: 'dashboardOverview',
    icon: LayoutDashboard,
    keywords: ['overview', 'ana', 'pano', 'dashboard', 'özet'],
  },
  {
    id: 'nav-performance',
    href: '/performance',
    titleKey: 'performanceHub',
    icon: BarChart3,
    keywords: ['performans', 'performance', 'roas', 'reklam', 'ads', 'hub', 'metrik', 'live'],
  },
  {
    id: 'nav-creative',
    href: '/creative',
    titleKey: 'creativeStudio',
    icon: Clapperboard,
    keywords: ['kreatif', 'creative', 'stüdyo', 'onay', 'video', 'görsel'],
  },
  {
    id: 'nav-strategy',
    href: '/strategy',
    titleKey: 'seoGeoReport',
    icon: Globe,
    keywords: ['seo', 'geo', 'strateji', 'arama', 'gsc', 'rapor', 'keyword'],
  },
  {
    id: 'nav-brand',
    href: '/brand-vault',
    titleKey: 'brandVault',
    icon: Shield,
    keywords: ['brand', 'marka', 'vault', 'kilitle'],
  },
  {
    id: 'nav-chat',
    href: '/chat',
    titleKey: 'teamChat',
    icon: MessageSquare,
    keywords: ['chat', 'sohbet', 'mesaj', 'ekip'],
  },
  {
    id: 'nav-mono',
    href: '/mono-ai',
    titleKey: 'monoAi',
    icon: Brain,
    keywords: ['mono', 'ai', 'asistan', 'deepseek'],
  },
  {
    id: 'nav-calendar',
    href: '/calendar',
    titleKey: 'opsCalendar',
    icon: CalendarDays,
    keywords: ['takvim', 'calendar', 'ops', 'etkinlik'],
  },
  {
    id: 'nav-team',
    href: '/settings/team',
    titleKey: 'teamManagement',
    icon: UsersRound,
    keywords: ['ekip', 'kullanıcı', 'davet', 'team', 'rol', 'yönetim', 'settings'],
    require: 'management.users',
  },
  {
    id: 'nav-profile',
    href: '/profile',
    titleKey: 'profileSettings',
    icon: UserCircle,
    keywords: ['profil', 'profile', 'hesap', 'ayar'],
  },
];

export type QuickEntry = {
  id: string;
  titleKey: CommandQuickTitleKey;
  icon: LucideIcon;
  keywords: string[];
  require?: PermissionSlug;
  href?: string;
  externalHref?: string;
  superAdminOnly?: boolean;
  action?: 'sync_all';
};

export const COMMAND_QUICK: QuickEntry[] = [
  {
    id: 'quick-upload',
    titleKey: 'uploadCreative',
    icon: Upload,
    keywords: ['yükle', 'upload', 'kreatif', 'yeni', 'asset'],
    href: '/creative',
    require: 'creative.upload',
  },
  {
    id: 'quick-sync',
    titleKey: 'syncConnected',
    icon: RefreshCw,
    keywords: ['sync', 'senkron', 'yenile', 'veri', 'çek'],
    action: 'sync_all',
    require: 'integrations.manage',
  },
  {
    id: 'quick-roles',
    titleKey: 'manageRolesPlatform',
    icon: Sparkles,
    keywords: ['rol', 'role', 'architect', 'rbac', 'izin', 'permission'],
    externalHref: '__ADMIN_ROLES__',
    superAdminOnly: true,
  },
];
