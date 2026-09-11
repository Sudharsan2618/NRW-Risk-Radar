import { AppShell } from '../../../../AppShell';
import { CampaignRunResultsView } from '@/components/milo/CampaignRunResultsView';

export default function CampaignRunResultsPage({ params }: { params: { id: string; runId: string } }) {
  return (
    <AppShell>
      <CampaignRunResultsView id={params.id} runId={params.runId} />
    </AppShell>
  );
}
