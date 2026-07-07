import { requireTenantContext } from '@/lib/auth/tenant-guard';
import { fetchInstagramHybridSimulatorData } from '@/features/oauth/actions/fetchInstagramHybridFeed';
import { InstagramSimulatorClient } from '@/features/creative-studio/components/InstagramSimulatorClient';

/** Always fetch fresh Meta Graph data on reload (no static cache). */
export const dynamic = 'force-dynamic';

export default async function InstagramSimulatorPage() {
  const { tenant, companyId } = await requireTenantContext();
  const { liveProfileData, hybridFeedPosts } = await fetchInstagramHybridSimulatorData(companyId);

  return (
    <div className="w-full py-4 md:py-6">
      <InstagramSimulatorClient
        posts={hybridFeedPosts}
        liveProfile={liveProfileData}
        tenantName={tenant.name}
        brandLogoUrl={tenant.brand_logo_url ?? tenant.logo_url ?? null}
        websiteUrl={tenant.custom_domain ?? null}
      />
    </div>
  );
}
