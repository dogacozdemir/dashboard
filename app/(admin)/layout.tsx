import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import Link from 'next/link';
import { Zap, LayoutDashboard, Globe, Upload, Settings } from 'lucide-react';
import type { SessionUser } from '@/types/user';

const adminNav = [
  { href: '/tenants',    label: 'Tenants',    icon: LayoutDashboard },
  { href: '/subdomains', label: 'Subdomains', icon: Globe },
  { href: '/uploads',    label: 'Uploads',    icon: Upload },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;

  if (!session || user?.role !== 'admin') {
    redirect('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#07070E]">
      {/* Admin sidebar */}
      <aside className="w-56 flex flex-col h-screen border-r border-white/[0.06] bg-[#0F0F1A] shrink-0">
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06]">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm text-white/90">Admin</span>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">God Mode</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {adminNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/[0.06]">
          <p className="text-[10px] text-white/20 truncate">{user?.email}</p>
          <p className="text-[10px] text-red-400/60 uppercase tracking-wider mt-0.5">Admin Access</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-6 h-16 border-b border-white/[0.06] shrink-0">
          <p className="text-xs text-white/30">
            <span className="text-red-400/70">● LIVE</span>
            &nbsp;·&nbsp;Madmonos Control Center
          </p>
          <button className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors">
            <Settings className="w-3.5 h-3.5" />
            Platform Settings
          </button>
        </header>
        <main className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
