'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { fetchProspectSelectionPrompts, type AgentPrompt } from '@/lib/leadFunnelApi';

export function ActivePromptSetting({ campaignId, campaignName, source = 'lead_funnel' }: { campaignId: string; campaignName?: string; source?: 'hr' | 'lead_funnel' }) {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState<AgentPrompt | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchProspectSelectionPrompts(campaignId, source)
      .then(data => {
        if (!alive) return;
        const all = data.versions?.length ? data.versions : data.prompts || [];
        setPrompt(all.find(p => p.id === data.active_prompt_id) || all.find(p => p.is_active) || all[0] || null);
      })
      .catch(() => { if (alive) setPrompt(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [campaignId, source]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', maxWidth: '420px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {campaignName && (
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {campaignName}
          </span>
        )}
        <span style={{ flexShrink: 0, fontSize: '11.5px', fontWeight: 700, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '3px 9px', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}>
          {loading ? 'Loading…' : prompt ? `Version ${prompt.version}` : 'Backend default'}
        </span>
      </div>
      <button type="button" onClick={() => router.push(`/icp-selection?campaignId=${encodeURIComponent(campaignId)}`)} style={{ flexShrink: 0, padding: '6px 10px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', color: 'var(--color-brand-text)', font: '600 12px var(--font-sans)', cursor: 'pointer' }}>
        Manage
      </button>
    </div>
  );
}
