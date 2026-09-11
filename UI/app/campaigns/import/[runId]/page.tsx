'use client';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../AppShell';
import { ImportRunDetailView } from '@/components/milo/ImportRunDetailView';

export default function ImportRunDetailPage() {
  const params = useParams();
  const runId = Array.isArray(params.runId) ? params.runId[0] : params.runId;
  return (
    <AppShell>
      {runId ? <ImportRunDetailView runId={runId} /> : null}
    </AppShell>
  );
}
