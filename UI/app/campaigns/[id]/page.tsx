import { AppShell } from '../../AppShell';
import { CampaignDetailView } from '@/components/milo/CampaignDetailView';

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <CampaignDetailView id={params.id} />
    </AppShell>
  );
}
