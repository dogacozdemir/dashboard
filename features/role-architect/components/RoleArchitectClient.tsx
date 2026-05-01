'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Reorder } from 'framer-motion';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  Loader2,
  Plus,
  Shield,
  Trash2,
  Building2,
  Layers,
  Lock,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PermissionRow, RoleRow, TenantMini } from '@/features/role-architect/actions/roleArchitectActions';
import {
  createRole,
  deleteRole,
  fetchDenialIds,
  fetchRoleArchitectBootstrap,
  fetchRolePermissionIds,
  reorderRoles,
  setRolePermission,
  setTenantDenial,
} from '@/features/role-architect/actions/roleArchitectActions';
import { cn } from '@/lib/utils/cn';

const spring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };

interface Bootstrap {
  roles: RoleRow[];
  permissions: PermissionRow[];
  tenants: TenantMini[];
}

export function RoleArchitectClient({ initial }: { initial: Bootstrap }) {
  const t = useTranslations('Features.RoleArchitect');
  const [roles, setRoles] = useState(initial.roles);
  const { permissions, tenants } = initial;

  const [tab, setTab] = useState<'global' | 'tenant'>('global');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [permSet, setPermSet] = useState<Set<string>>(new Set());
  const [tenantId, setTenantId] = useState<string | null>(tenants[0]?.id ?? null);
  const [denySet, setDenySet] = useState<Set<string>>(new Set());
  const [newSlug, setNewSlug] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [tenantScope, setTenantScope] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const globalRoles = useMemo(
    () => [...roles.filter((r) => !r.tenant_id)].sort((a, b) => a.sort_order - b.sort_order),
    [roles]
  );

  const [orderIds, setOrderIds] = useState<string[]>(() => globalRoles.map((r) => r.id));
  useEffect(() => {
    setOrderIds(globalRoles.map((r) => r.id));
  }, [globalRoles]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const isSuperLocked = selectedRole?.slug === 'super_admin';

  const loadPerms = useCallback((roleId: string) => {
    startTransition(async () => {
      try {
        const s = await fetchRolePermissionIds(roleId);
        setPermSet(s);
      } catch {
        setPermSet(new Set());
      }
    });
  }, []);

  const loadDenials = useCallback((tId: string, roleId: string) => {
    startTransition(async () => {
      try {
        const s = await fetchDenialIds(tId, roleId);
        setDenySet(s);
      } catch {
        setDenySet(new Set());
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedRoleId) {
      setPermSet(new Set());
      return;
    }
    loadPerms(selectedRoleId);
  }, [selectedRoleId, loadPerms]);

  useEffect(() => {
    if (tab !== 'tenant' || !tenantId || !selectedRoleId) {
      setDenySet(new Set());
      return;
    }
    loadDenials(tenantId, selectedRoleId);
  }, [tab, tenantId, selectedRoleId, loadDenials]);

  function onTogglePerm(permissionId: string, granted: boolean) {
    if (!selectedRoleId || isSuperLocked) return;
    setMsg(null);
    startTransition(async () => {
      const res = await setRolePermission(selectedRoleId, permissionId, granted);
      if (!res.success) {
        setMsg(res.error ?? t('errSave'));
        return;
      }
      const next = new Set(permSet);
      if (granted) next.add(permissionId);
      else next.delete(permissionId);
      setPermSet(next);
    });
  }

  function onToggleDeny(permissionId: string, denied: boolean) {
    if (!tenantId || !selectedRoleId || isSuperLocked) return;
    setMsg(null);
    startTransition(async () => {
      const res = await setTenantDenial(tenantId, selectedRoleId, permissionId, denied);
      if (!res.success) {
        setMsg(res.error ?? t('errOverride'));
        return;
      }
      const next = new Set(denySet);
      if (denied) next.add(permissionId);
      else next.delete(permissionId);
      setDenySet(next);
    });
  }

  function onReorder(nextOrder: string[]) {
    setOrderIds(nextOrder);
    startTransition(async () => {
      await reorderRoles(nextOrder, null);
      setRoles((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        return prev.map((r) => {
          if (!r.tenant_id) {
            const idx = nextOrder.indexOf(r.id);
            if (idx >= 0) return { ...r, sort_order: idx };
          }
          return r;
        });
      });
    });
  }

  function onCreateRole(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await createRole({
        slug: newSlug,
        description: newDesc || undefined,
        tenantId: tenantScope,
      });
      if (!res.success) {
        setMsg(res.error ?? t('errCreate'));
        return;
      }
      setNewSlug('');
      setNewDesc('');
      setTenantScope(null);
      const db = await fetchRoleArchitectBootstrap();
      setRoles(db.roles);
    });
  }

  function onDeleteRole(roleId: string) {
    if (!confirm(t('confirmDeleteRole'))) return;
    setMsg(null);
    startTransition(async () => {
      const res = await deleteRole(roleId);
      if (!res.success) {
        setMsg(res.error ?? t('errDelete'));
        return;
      }
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (selectedRoleId === roleId) setSelectedRoleId(null);
    });
  }

  const tenantRolesForOverride = useMemo(
    () => roles.filter((r) => !r.tenant_id && r.slug !== 'super_admin'),
    [roles]
  );

  return (
    <div className="space-y-8 max-w-6xl pb-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="flex flex-wrap gap-2"
      >
        {[
          { id: 'global' as const, label: t('tabGlobal'), icon: Layers },
          { id: 'tenant' as const, label: t('tabTenant'), icon: Building2 },
        ].map((item) => {
          const TabIcon = item.icon;
          return (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition-all',
              tab === item.id
                ? 'text-[#1a0f00]'
                : 'text-white/45 hover:text-white/70'
            )}
            style={
              tab === item.id
                ? {
                    background: 'linear-gradient(135deg, #e8d48a, #bea042)',
                    boxShadow: '0 0 24px rgba(190,160,66,0.25)',
                    border: '1px solid rgba(139,110,30,0.45)',
                  }
                : {
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }
            }
          >
            <TabIcon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        );})}
      </motion.div>

      <AnimatePresence>
        {msg && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-rose-300/90 rounded-2xl px-4 py-3 bg-rose-500/10 border border-rose-500/20"
          >
            {msg}
          </motion.p>
        )}
      </AnimatePresence>

      {tab === 'global' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <motion.div
            className="lg:col-span-4 space-y-4 rounded-[2rem] p-5"
            style={{
              background: 'rgba(29,15,29,0.42)',
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: 'blur(40px)',
            }}
          >
            <div className="flex items-center gap-2 text-white/80">
              <Shield className="h-4 w-4 text-[#bea042]" />
              <h2 className="text-sm font-semibold">{t('rolesReorder')}</h2>
            </div>
            <Reorder.Group axis="y" values={orderIds} onReorder={onReorder} className="space-y-2">
              {orderIds.map((id) => {
                const r = roles.find((x) => x.id === id);
                if (!r || r.tenant_id) return null;
                return (
                  <Reorder.Item key={id} value={id}>
                    <motion.button
                      type="button"
                      layout
                      onClick={() => setSelectedRoleId(id)}
                      className={cn(
                        'w-full text-left rounded-2xl px-3 py-3 flex items-center justify-between gap-2 transition-colors cursor-grab active:cursor-grabbing',
                        selectedRoleId === id
                          ? 'bg-[#bea042]/15 border border-[#bea042]/35'
                          : 'bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06]'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white/85 truncate">{r.slug}</p>
                        {r.description && (
                          <p className="text-[10px] text-white/35 line-clamp-2">{r.description}</p>
                        )}
                      </div>
                      {r.slug !== 'super_admin' &&
                        !['tenant_admin', 'tenant_user'].includes(r.slug) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteRole(id);
                            }}
                            className="p-1.5 rounded-xl text-white/25 hover:text-rose-400 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                    </motion.button>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>

            {roles.some((r) => r.tenant_id) && (
              <div className="space-y-2 pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  {t('tenantRolesHeading')}
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {roles
                    .filter((r) => r.tenant_id)
                    .map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-2 rounded-xl px-2 py-2 bg-white/[0.03] border border-white/[0.06]"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedRoleId(r.id)}
                          className={cn(
                            'flex-1 text-left text-xs text-white/75',
                            selectedRoleId === r.id && 'text-[#bea042]'
                          )}
                        >
                          {r.slug}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRole(r.id)}
                          className="p-1 text-white/25 hover:text-rose-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <form onSubmit={onCreateRole} className="space-y-3 pt-4 border-t border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{t('newRole')}</p>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder={t('slugPlaceholder')}
                className="w-full rounded-2xl px-3 py-2.5 text-xs text-white/85 placeholder-white/25 bg-white/[0.05] border border-white/[0.08] outline-none"
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={t('descPlaceholder')}
                className="w-full rounded-2xl px-3 py-2.5 text-xs text-white/85 placeholder-white/25 bg-white/[0.05] border border-white/[0.08] outline-none"
              />
              <select
                value={tenantScope ?? ''}
                onChange={(e) => setTenantScope(e.target.value || null)}
                className="w-full rounded-2xl px-3 py-2.5 text-xs text-white/80 bg-white/[0.05] border border-white/[0.08] outline-none"
              >
                <option value="">{t('scopeGlobalOption')}</option>
                {tenants.map((tn) => (
                  <option key={tn.id} value={tn.id}>
                    {t('tenantScopedOption', { tenant: t('tenantLabel'), name: tn.name })}
                  </option>
                ))}
              </select>
              <motion.button
                type="submit"
                disabled={pending}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-2xl py-2.5 text-xs font-semibold text-[#1a0f00] flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #e8d48a, #bea042)',
                  border: '1px solid rgba(190,160,66,0.4)',
                }}
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {t('createSubmit')}
              </motion.button>
            </form>
          </motion.div>

          <motion.div
            className="lg:col-span-8 rounded-[2rem] overflow-hidden"
            style={{
              background: 'rgba(29,15,29,0.38)',
              border: '1px solid rgba(255,255,255,0.09)',
              backdropFilter: 'blur(48px)',
            }}
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{t('matrixHeading')}</p>
                <p className="text-sm font-medium text-white/85">
                  {selectedRole ? selectedRole.slug : t('selectRole')}
                </p>
              </div>
              {isSuperLocked && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-full px-2.5 py-1">
                  <Lock className="h-3 w-3" />
                  {t('locked')}
                </span>
              )}
            </div>

            <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">
              {permissions.map((p) => {
                const checked = permSet.has(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!selectedRoleId || isSuperLocked || pending}
                      onChange={(e) => onTogglePerm(p.id, e.target.checked)}
                      className="rounded-md border-white/20"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-[#bea042]/85">{p.slug}</p>
                    </div>
                    {p.description && (
                      <span title={p.description} className="shrink-0 text-white/25 hover:text-white/45">
                        <HelpCircle className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      {tab === 'tenant' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div
            className="lg:col-span-4 space-y-4 rounded-[2rem] p-5"
            style={{
              background: 'rgba(29,15,29,0.42)',
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: 'blur(40px)',
            }}
          >
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2">
              {t('tenantLabel')}
            </label>
            <select
              value={tenantId ?? ''}
              onChange={(e) => setTenantId(e.target.value || null)}
              className="w-full rounded-2xl px-3 py-2.5 text-xs text-white/85 bg-white/[0.05] border border-white/[0.08] outline-none"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2 mt-4">
              {t('globalRoleLabel')}
            </label>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {tenantRolesForOverride.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoleId(r.id)}
                  className={cn(
                    'w-full text-left rounded-xl px-3 py-2 text-xs transition-colors',
                    selectedRoleId === r.id
                      ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/25'
                      : 'text-white/50 hover:bg-white/[0.04]'
                  )}
                >
                  {r.slug}
                </button>
              ))}
            </div>
          </div>

          <div
            className="lg:col-span-8 rounded-[2rem] overflow-hidden"
            style={{
              background: 'rgba(29,15,29,0.38)',
              border: '1px solid rgba(255,255,255,0.09)',
              backdropFilter: 'blur(48px)',
            }}
          >
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <p className="text-sm font-medium text-white/85">{t('tenantDenyHeading')}</p>
              <p className="text-[11px] text-white/35 mt-1">{t('tenantDenySub')}</p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">
              {permissions.map((p) => {
                const globalOn = permSet.has(p.id);
                const denied = denySet.has(p.id);
                const effective = globalOn && !denied;
                if (!globalOn) {
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] opacity-35"
                    >
                      <span className="text-xs font-mono text-white/40">{p.slug}</span>
                      <span className="text-[10px] text-white/25 ml-auto">{t('globalOff')}</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-white/80">{p.slug}</p>
                      <p className="text-[10px] text-emerald-400/70">
                        {effective ? t('effectiveYes') : t('effectiveNo')}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] text-white/45 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={denied}
                        disabled={!tenantId || !selectedRoleId || isSuperLocked || pending}
                        onChange={(e) => onToggleDeny(p.id, e.target.checked)}
                      />
                      {t('deny')}
                    </label>
                    {p.description && (
                      <span title={p.description} className="text-white/25">
                        <HelpCircle className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
