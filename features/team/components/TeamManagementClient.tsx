'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MailPlus, Shield, User, Loader2, Trash2, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AssignableRole, TeamMemberRow } from '@/features/team/actions/teamActions';
import {
  inviteTeamMember,
  listTeamMembers,
  revokeTeamMember,
  updateTeamMemberRole,
} from '@/features/team/actions/teamActions';
import { cn } from '@/lib/utils/cn';

const spring = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 1 };

interface Props {
  companyId: string;
  currentUserId: string;
  initialMembers: TeamMemberRow[];
  assignableRoles: AssignableRole[];
}

function roleOptionsForMember(m: TeamMemberRow, assignable: AssignableRole[]): AssignableRole[] {
  if (assignable.some((r) => r.id === m.role_id)) return assignable;
  return [{ id: m.role_id, slug: m.role }, ...assignable];
}

export function TeamManagementClient({
  companyId,
  currentUserId,
  initialMembers,
  assignableRoles,
}: Props) {
  const t = useTranslations('Features.Team');
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState(
    () => assignableRoles.find((r) => r.slug === 'tenant_user')?.id ?? assignableRoles[0]?.id ?? ''
  );
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const next = await listTeamMembers(companyId);
      setMembers(next);
    });
  }

  function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!inviteRoleId) {
      setMessage({ type: 'err', text: t('errNoAssignableRole') });
      return;
    }
    startTransition(async () => {
      const res = await inviteTeamMember(companyId, email, inviteRoleId);
      if (res.success) {
        setMessage({ type: 'ok', text: t('toastInviteOk') });
        setEmail('');
        refresh();
      } else {
        setMessage({ type: 'err', text: res.error ?? t('toastInviteFail') });
      }
    });
  }

  function onRoleChange(userId: string, roleId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await updateTeamMemberRole(companyId, userId, roleId);
      if (res.success) refresh();
      else setMessage({ type: 'err', text: res.error ?? t('toastRoleFail') });
    });
  }

  function onRevoke(userId: string) {
    if (!confirm(t('confirmRevoke'))) return;
    setMessage(null);
    startTransition(async () => {
      const res = await revokeTeamMember(companyId, userId, currentUserId);
      if (res.success) refresh();
      else setMessage({ type: 'err', text: res.error ?? t('toastRevokeFail') });
    });
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="rounded-[2rem] p-6 md:p-8 space-y-6"
        style={{
          background: 'rgba(29, 15, 29, 0.42)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 0 0 0.5px rgba(255,255,255,0.05) inset, 0 24px 70px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(156,112,178,0.3), rgba(190,160,66,0.18))',
              border: '1px solid rgba(190,160,66,0.3)',
            }}
          >
            <Shield className="h-5 w-5 text-white/85" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white/90 tracking-tight">{t('title')}</h1>
            <p className="text-sm text-white/40 mt-1 leading-relaxed">
              {t.rich('subtitle', {
                perm: (chunks) => <span className="text-[#bea042]/90">{chunks}</span>,
              })}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {message && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                'text-sm rounded-2xl px-4 py-3',
                message.type === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-300/90 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-300/90 border border-rose-500/20'
              )}
            >
              {message.text}
            </motion.p>
          )}
        </AnimatePresence>

        <form onSubmit={onInvite} className="space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">{t('inviteHeading')}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <MailPlus className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm text-white/85 placeholder-white/25 outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
            </div>
            <div className="relative">
              <select
                value={inviteRoleId}
                onChange={(e) => setInviteRoleId(e.target.value)}
                className="appearance-none w-full sm:min-w-[200px] pl-4 pr-10 py-3 rounded-2xl text-sm text-white/80 outline-none cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.slug}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
            </div>
            <motion.button
              type="submit"
              disabled={pending || !assignableRoles.length}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              className="rounded-2xl px-5 py-3 text-sm font-semibold text-[#1a0f00] disabled:opacity-50 inline-flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #e8d48a, #bea042)',
                border: '1px solid rgba(190,160,66,0.45)',
                boxShadow: '0 0 24px rgba(190,160,66,0.25)',
              }}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('inviteSubmit')}
            </motion.button>
          </div>
        </form>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.06 }}
        className="rounded-[2rem] overflow-hidden"
        style={{
          background: 'rgba(29, 15, 29, 0.35)',
          border: '1px solid rgba(255,255,255,0.09)',
          backdropFilter: 'blur(36px)',
        }}
      >
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <p className="text-sm font-medium text-white/80">{t('membersHeading')}</p>
          <p className="text-xs text-white/30 mt-0.5">{t('membersCount', { count: members.length })}</p>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {members.map((m, i) => (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: i * 0.04 }}
              className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-4"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-white/40" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/85 truncate">{m.full_name || m.email}</p>
                  <p className="text-xs text-white/35 truncate">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {m.role === 'super_admin' ? (
                  <span className="text-xs font-medium text-amber-400/90 px-3 py-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07]">
                    super_admin
                  </span>
                ) : (
                  <select
                    value={m.role_id}
                    disabled={m.id === currentUserId || pending}
                    onChange={(e) => onRoleChange(m.id, e.target.value)}
                    className="text-xs rounded-xl px-3 py-2 text-white/80 outline-none disabled:opacity-40 max-w-[220px]"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {roleOptionsForMember(m, assignableRoles).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.slug}
                      </option>
                    ))}
                  </select>
                )}
                <motion.button
                  type="button"
                  disabled={m.id === currentUserId || pending || m.role === 'super_admin'}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onRevoke(m.id)}
                  className="rounded-xl p-2 text-rose-400/80 hover:bg-rose-500/10 disabled:opacity-30 transition-colors"
                  title={t('revokeAria')}
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              </div>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
