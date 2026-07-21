import { evaluateImpressionMilestone } from '@/features/gamification/actions/impressionMilestones';
import { DashboardImpressionMilestone } from '@/features/gamification/components/DashboardImpressionMilestone';

export async function DashboardImpressionMilestoneSection({ companyId }: { companyId: string }) {
  const result = await evaluateImpressionMilestone(companyId);
  return <DashboardImpressionMilestone result={result} />;
}
