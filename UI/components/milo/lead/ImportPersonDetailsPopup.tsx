'use client';
import React from 'react';
import { fetchPersonDetails, enrichPerson, type PersonDetails } from '@/lib/leadFunnelApi';
import { EnrichmentPostsPanel } from './EnrichmentPostsPanel';

export function ImportPersonDetailsPopup({ open, onClose, prospectId, fullName, linkedinUrl, runId }: {
  open: boolean; onClose: () => void; prospectId: string; fullName: string; linkedinUrl: string; runId: string;
}) {
  const [details, setDetails] = React.useState<PersonDetails | null>(null);

  const load = React.useCallback(async () => {
    if (!open) return;
    const data = await fetchPersonDetails(prospectId);
    setDetails(data.person);
  }, [open, prospectId]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <EnrichmentPostsPanel
      open={open}
      onClose={onClose}
      title="Prospect Details"
      subtitle={fullName}
      linkedinUrl={linkedinUrl}
      posts={details?.posts ?? []}
      enriched={!!details}
      onEnrich={async (n) => (await enrichPerson(prospectId, runId, n)).enrichmentId}
      onEnriched={load}
    />
  );
}
