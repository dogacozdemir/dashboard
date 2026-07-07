'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Loader2,
  MailPlus,
  MoreVertical,
  Search,
  Shield,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';
import {
  adminInviteNewUser,
  adminRevokeUser,
  adminUpdateUserRole,
  fetchAdminAssignableRoles,
  fetchAdminUsers,
  type AdminAssignableRole,
  type AdminUserFilterRole,
  type AdminUserFilterTenant,
  type AdminUserRow,
} from '../actions/adminUserActions';

const spring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };

type Props = {
  initialUsers: AdminUserRow[];
  tenants: AdminUserFilterTenant[];
  filterRoles: AdminUserFilterRole[];
  initialTenantId?: string;
  initialSearch?: string;
  initialRoleId?: string;
};

function resolveError(t: ReturnType<typeof useTranslations>, errorKey?: string, error?: string) {
  const knownKeys = [
    'errInvalidEmail',
    'errServiceUnavailable',
    'errRoleNotAssignable',
    'errTenantNotFound',
    'errTenantLookup',
    'errSuperAdminBlocked',
    'errUserNotFound',
    'errLastTenantAdmin',
  ] as const;
  if (errorKey && knownKeys.includes(errorKey as (typeof knownKeys)[number])) {
    return t(`errors.${errorKey}` as `errors.${(typeof knownKeys)[number]}`);
  }
  return error ?? t('toastGenericFail');
}

function UserAvatar({ user }: { user: AdminUserRow }) {
  if (user.avatar_url) {
    return (
      <Image
        src={user.avatar_url}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 rounded-2xl object-cover border border-white/[0.08]"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06]">
      <User className="h-4 w-4 text-white/40" />
    </div>
  );
}

export function AdminUsersClient({
  initialUsers,
  tenants,
  filterRoles,
  initialTenantId = '',
  initialSearch = '',
  initialRoleId = '',
}: Props) {
  const t = useTranslations('Admin.users');
  const router = useRouter();

  const [users, setUsers] = useState(initialUsers);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [tenantFilter, setTenantFilter] = useState(initialTenantId);
  const [roleFilter, setRoleFilter] = useState(initialRoleId);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteTenantId, setInviteTenantId] = useState(initialTenantId || tenants[0]?.id || '');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteRoles, setInviteRoles] = useState<AdminAssignableRole[]>([]);

  const [roleDialogUser, setRoleDialogUser] = useState<AdminUserRow | null>(null);
  const [roleDialogRoleId, setRoleDialogRoleId] = useState('');
  const [roleDialogRoles, setRoleDialogRoles] = useState<AdminAssignableRole[]>([]);

  const [revokeUser, setRevokeUser] = useState<AdminUserRow | null>(null);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 320);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const activeFilters = useMemo(
    () => ({
      tenantId: tenantFilter || undefined,
      search: debouncedSearch || undefined,
      roleId: roleFilter || undefined,
    }),
    [tenantFilter, debouncedSearch, roleFilter],
  );

  const skipFilterReload = useRef(true);

  const reload = useCallback(() => {
    startTransition(async () => {
      const next = await fetchAdminUsers(activeFilters);
      setUsers(next);
      router.refresh();
    });
  }, [activeFilters, router]);

  useEffect(() => {
    if (skipFilterReload.current) {
      skipFilterReload.current = false;
      return;
    }
    reload();
  }, [debouncedSearch, tenantFilter, roleFilter, reload]);

  useEffect(() => {
    if (!inviteOpen || !inviteTenantId) {
      setInviteRoles([]);
      return;
    }
    void fetchAdminAssignableRoles(inviteTenantId).then((roles) => {
      setInviteRoles(roles);
      const defaultRole = roles.find((r) => r.slug === 'tenant_user') ?? roles[0];
      setInviteRoleId((prev) => prev || defaultRole?.id || '');
    });
  }, [inviteOpen, inviteTenantId]);

  useEffect(() => {
    if (!roleDialogUser) {
      setRoleDialogRoles([]);
      return;
    }
    void fetchAdminAssignableRoles(roleDialogUser.tenant_id).then((roles) => {
      setRoleDialogRoles(roles);
      setRoleDialogRoleId(roleDialogUser.role_id);
    });
  }, [roleDialogUser]);

  function showToast(type: 'ok' | 'err', text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4500);
  }

  function onInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteTenantId || !inviteRoleId) return;

    startTransition(async () => {
      const res = await adminInviteNewUser(inviteTenantId, inviteEmail, inviteRoleId);
      if (res.success) {
        showToast('ok', t('toastInviteOk'));
        setInviteOpen(false);
        setInviteEmail('');
        reload();
      } else {
        showToast('err', resolveError(t, res.errorKey, res.error));
      }
    });
  }

  function onRoleSave() {
    if (!roleDialogUser || !roleDialogRoleId) return;

    startTransition(async () => {
      const res = await adminUpdateUserRole(roleDialogUser.id, roleDialogRoleId);
      if (res.success) {
        showToast('ok', t('toastRoleOk'));
        setRoleDialogUser(null);
        reload();
      } else {
        showToast('err', resolveError(t, res.errorKey, res.error));
      }
    });
  }

  function onRevokeConfirm() {
    if (!revokeUser) return;

    startTransition(async () => {
      const res = await adminRevokeUser(revokeUser.id);
      if (res.success) {
        showToast('ok', t('toastRevokeOk'));
        setRevokeUser(null);
        reload();
      } else {
        showToast('err', resolveError(t, res.errorKey, res.error));
      }
    });
  }

  const activeTenants = tenants.filter((row) => row.is_active);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="glass glow-inset gpu-glass-promote relative overflow-hidden rounded-[2rem]"
      >
        <div className="flex flex-col gap-4 border-b border-white/[0.06] px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white/90">{t('heading')}</h1>
              <p className="mt-1 text-xs text-white/32">{t('subheading', { count: users.length })}</p>
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-[#1a0f00]"
              style={{
                background: 'linear-gradient(135deg, #e8d48a, #bea042)',
                border: '1px solid rgba(190,160,66,0.45)',
                boxShadow: '0 0 24px rgba(190,160,66,0.25)',
              }}
            >
              <UserPlus className="h-4 w-4" />
              {t('globalInvite')}
            </motion.button>
          </div>

          <AnimatePresence>
            {toast && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  'rounded-2xl px-4 py-3 text-sm',
                  toast.type === 'ok'
                    ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300/90'
                    : 'border border-rose-500/20 bg-rose-500/10 text-rose-300/90',
                )}
              >
                {toast.text}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] py-2.5 pl-10 pr-4 text-xs text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none placeholder:text-white/25 focus:border-white/15"
              />
            </div>

            <div className="relative min-w-[180px]">
              <select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-2xl border border-white/[0.08] bg-white/[0.05] py-2.5 pl-4 pr-10 text-xs text-white/80 outline-none"
              >
                <option value="">{t('filterAllTenants')}</option>
                {tenants.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} ({row.slug})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            </div>

            <div className="relative min-w-[160px]">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-2xl border border-white/[0.08] bg-white/[0.05] py-2.5 pl-4 pr-10 text-xs text-white/80 outline-none"
              >
                <option value="">{t('filterAllRoles')}</option>
                {filterRoles.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.slug}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            </div>

            {pending && (
              <div className="flex items-center gap-2 text-xs text-white/35">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('refreshing')}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {users.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-white/20" />
              <p className="text-sm font-medium text-white/55">{t('emptyTitle')}</p>
              <p className="mt-1 text-xs text-white/30">{t('emptySubtitle')}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {[t('colUser'), t('colEmail'), t('colTenant'), t('colRole'), t('colCreated'), t('colActions')].map(
                    (h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-white/28"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ ...spring, delay: Math.min(i * 0.03, 0.3) }}
                    className="group border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar user={user} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white/85">
                            {user.full_name || user.email.split('@')[0]}
                          </p>
                          <p className="truncate text-[11px] text-white/30">{user.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <p className="max-w-[220px] truncate text-sm text-white/60">{user.email}</p>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white/75">{user.tenant.name}</p>
                        <span className="mt-1 inline-flex rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] text-indigo-300/90">
                          {user.tenant.slug}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium',
                          user.role === 'super_admin'
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300/90'
                            : user.role === 'tenant_admin'
                              ? 'border-purple-500/25 bg-purple-500/10 text-purple-300/85'
                              : 'border-white/10 bg-white/[0.05] text-white/55',
                        )}
                      >
                        <Shield className="h-3 w-3 opacity-70" />
                        {user.roleMeta.slug}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <p className="whitespace-nowrap text-xs tabular-nums text-white/45">
                        {formatDate(user.created_at)}
                      </p>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      {user.role === 'super_admin' ? (
                        <span className="text-[10px] uppercase tracking-wider text-white/20">{t('platformUser')}</span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="rounded-xl p-2 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/75"
                            aria-label={t('actionsAria')}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[180px]">
                            <DropdownMenuItem onClick={() => setRoleDialogUser(user)}>
                              {t('actionChangeRole')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setRevokeUser(user)}
                            >
                              {t('actionRevoke')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* Global invite modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent
          showCloseButton
          className="border-white/10 bg-[#1a0f1a]/95 text-white sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-white/90">{t('inviteModalTitle')}</DialogTitle>
            <DialogDescription className="text-white/40">{t('inviteModalDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onInviteSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                {t('inviteTenantLabel')}
              </label>
              <select
                required
                value={inviteTenantId}
                onChange={(e) => {
                  setInviteTenantId(e.target.value);
                  setInviteRoleId('');
                }}
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white/85 outline-none"
              >
                {activeTenants.length === 0 ? (
                  <option value="">{t('noActiveTenants')}</option>
                ) : (
                  activeTenants.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {row.slug}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                {t('inviteEmailLabel')}
              </label>
              <div className="relative">
                <MailPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t('inviteEmailPlaceholder')}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-3 text-sm text-white/85 outline-none placeholder:text-white/25"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
                {t('inviteRoleLabel')}
              </label>
              <select
                required
                value={inviteRoleId}
                onChange={(e) => setInviteRoleId(e.target.value)}
                disabled={!inviteRoles.length}
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white/85 outline-none disabled:opacity-50"
              >
                {inviteRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.slug}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter className="border-white/10 bg-transparent">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-xl px-4 py-2 text-sm text-white/50 hover:text-white/75"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={pending || !inviteRoles.length}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#e8d48a] to-[#bea042] px-4 py-2 text-sm font-semibold text-[#1a0f00] disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('inviteSubmit')}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change role dialog */}
      <Dialog open={!!roleDialogUser} onOpenChange={(open) => !open && setRoleDialogUser(null)}>
        <DialogContent showCloseButton className="border-white/10 bg-[#1a0f1a]/95 text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white/90">{t('roleModalTitle')}</DialogTitle>
            <DialogDescription className="text-white/40">
              {roleDialogUser
                ? t('roleModalDesc', { email: roleDialogUser.email, tenant: roleDialogUser.tenant.name })
                : ''}
            </DialogDescription>
          </DialogHeader>
          <select
            value={roleDialogRoleId}
            onChange={(e) => setRoleDialogRoleId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white/85 outline-none"
          >
            {roleDialogRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.slug}
              </option>
            ))}
          </select>
          <DialogFooter className="border-white/10 bg-transparent">
            <button
              type="button"
              onClick={() => setRoleDialogUser(null)}
              className="rounded-xl px-4 py-2 text-sm text-white/50 hover:text-white/75"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              disabled={pending || !roleDialogRoleId}
              onClick={onRoleSave}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-4 py-2 text-sm font-medium text-white/85 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('roleSave')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={!!revokeUser} onOpenChange={(open) => !open && setRevokeUser(null)}>
        <DialogContent showCloseButton className="border-white/10 bg-[#1a0f1a]/95 text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-300/90">{t('revokeModalTitle')}</DialogTitle>
            <DialogDescription className="text-white/40">
              {revokeUser
                ? t('revokeModalDesc', { email: revokeUser.email, tenant: revokeUser.tenant.name })
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-white/10 bg-transparent">
            <button
              type="button"
              onClick={() => setRevokeUser(null)}
              className="rounded-xl px-4 py-2 text-sm text-white/50 hover:text-white/75"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onRevokeConfirm}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-200 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t('revokeConfirm')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
