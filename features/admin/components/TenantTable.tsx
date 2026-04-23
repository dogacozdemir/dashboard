'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Users, BarChart3, Image, MoreVertical, CheckCircle2, XCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlassCard } from '@/components/shared/GlassCard';
import { formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { TenantWithStats } from '../types';

const planColors: Record<string, string> = {
  starter:    'bg-white/5 text-white/40 border-white/10',
  growth:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  enterprise: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

interface TenantTableProps {
  tenants: TenantWithStats[];
}

export function TenantTable({ tenants }: TenantTableProps) {
  const [search, setSearch] = useState('');

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <GlassCard padding="none">
      {/* Table header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div>
          <h3 className="text-sm font-semibold text-white/80">All Tenants</h3>
          <p className="text-xs text-white/30 mt-0.5">{tenants.length} brands on platform</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tenants..."
          className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/80 placeholder-white/20 text-xs outline-none focus:border-indigo-500/40 w-48 transition-all"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.04]">
              {['Brand', 'Subdomain', 'Plan', 'Users', 'Campaigns', 'Assets', 'Status', 'Last Active', ''].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((tenant, i) => (
              <motion.tr
                key={tenant.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-white/80">{tenant.name}</p>
                    <p className="text-[11px] text-white/30">{tenant.slug}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <a
                    href={`https://${tenant.slug}.madmonos.com`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {tenant.custom_domain ?? `${tenant.slug}.madmonos.com`}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize',
                    planColors[tenant.plan]
                  )}>
                    {tenant.plan}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-white/60">
                    <Users className="w-3 h-3 text-white/25" />
                    {tenant.userCount}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-white/60">
                    <BarChart3 className="w-3 h-3 text-white/25" />
                    {tenant.campaignCount}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-white/60">
                    <Image className="w-3 h-3 text-white/25" />
                    {tenant.assetCount}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {tenant.is_active ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-white/30">
                      <XCircle className="w-3.5 h-3.5" />
                      Inactive
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-xs text-white/25 whitespace-nowrap">
                  {tenant.lastActivity ? formatRelativeTime(tenant.lastActivity) : 'Never'}
                </td>
                <td className="px-6 py-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="text-white/25 hover:text-white/60 transition-colors outline-none cursor-pointer">
                      <MoreVertical className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-[#161625] border-white/[0.08] text-white/80 text-xs"
                    >
                      <DropdownMenuItem className="hover:bg-white/[0.06] cursor-pointer">
                        View Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem className="hover:bg-white/[0.06] cursor-pointer">
                        Edit Tenant
                      </DropdownMenuItem>
                      <DropdownMenuItem className={cn(
                        'cursor-pointer',
                        tenant.is_active
                          ? 'text-amber-400 hover:bg-amber-500/10'
                          : 'text-emerald-400 hover:bg-emerald-500/10'
                      )}>
                        {tenant.is_active ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
