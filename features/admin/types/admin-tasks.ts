export type AdminTaskType =
  | 'MISSING_BRAND_VAULT'
  | 'CREATIVE_APPROVAL_PENDING'
  | 'CREATIVE_REVISION_REQUEST'
  | 'CREATIVE_APPROVED'
  | 'API_CONNECTION_LOST'
  | 'SPEND_LIMIT_EXCEEDED';

export type AdminTaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type AdminTaskStatus = 'open' | 'done' | 'dismissed';

/** Normalized row for Ops Center UI (DB + computed). */
export type AdminOpsTaskItem = {
  id: string;
  source: 'database' | 'computed';
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  taskType: AdminTaskType;
  priority: AdminTaskPriority;
  title: string;
  body: string | null;
  targetPath: string;
  relatedEntityId: string | null;
  createdAt: string;
};

export type AdminRecentApprovalItem = {
  assetId: string;
  title: string;
  tenantSlug: string;
  tenantName: string;
  updatedAt: string;
};

export type AdminOpsPayload = {
  activeTasks: AdminOpsTaskItem[];
  recentApprovals: AdminRecentApprovalItem[];
};
