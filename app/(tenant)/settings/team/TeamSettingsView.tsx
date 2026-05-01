'use client';

import { useTranslations } from 'next-intl';
import { MobileFirstSheet } from '@/components/layout/MobileFirstSheet';
import { TeamManagementClient } from '@/features/team/components/TeamManagementClient';
import type { AssignableRole, TeamMemberRow } from '@/features/team/actions/teamActions';

type Props = {
  companyId: string;
  currentUserId: string;
  initialMembers: TeamMemberRow[];
  assignableRoles: AssignableRole[];
};

export function TeamSettingsView(props: Props) {
  const t = useTranslations('Features.Team');

  return (
    <MobileFirstSheet title={t('title')}>
      <TeamManagementClient {...props} />
    </MobileFirstSheet>
  );
}
