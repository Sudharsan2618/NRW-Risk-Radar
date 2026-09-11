import React, { Suspense } from 'react';
import { AppShell } from '../../AppShell';
import { CampaignImportView } from '@/components/milo/CampaignImportView';

export default function CampaignNewImportPage() {
  return (
    <AppShell>
      <Suspense fallback={<div style={{ padding: '24px 20px', color: 'var(--color-text-3)', fontSize: '13px' }}>Loading…</div>}>
        <CampaignImportView />
      </Suspense>
    </AppShell>
  );
}
