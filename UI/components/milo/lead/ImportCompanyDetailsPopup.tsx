'use client';
import React from 'react';
import { fetchCompanyDetails, enrichCompany, analyzeCompanySignal, fetchCompanyProspectPosts, type CompanyDetails, type AISignal, type ProspectPostGroup } from '@/lib/leadFunnelApi';
import { EnrichmentPostsPanel } from './EnrichmentPostsPanel';

const SIGNAL: Record<string, { bg: string; text: string; dot: string }> = {
  green: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)', dot: 'var(--color-success)' },
  yellow: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)', dot: 'var(--color-warning)' },
  orange: { bg: '#FFE8D2', text: '#C2540B', dot: '#F97316' },
  red: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)', dot: 'var(--color-danger)' },
};
// Tier name from the colour key, not the stored label (which may predate the
// taxonomy change) — keeps this card in step with the table badge and filter.
const SIGNAL_NAME: Record<string, string> = { green: 'High-intent', yellow: 'Relevant', orange: 'On-Watch', red: 'Dormant' };

export function ImportCompanyDetailsPopup({ open, onClose, companyName, companyLinkedin, runId }: {
  open: boolean; onClose: () => void; companyName: string; companyLinkedin: string; runId: string;
}) {
  const [details, setDetails] = React.useState<CompanyDetails | null>(null);
  const [signal, setSignal] = React.useState<AISignal | undefined>(undefined);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [prospectGroups, setProspectGroups] = React.useState<ProspectPostGroup[] | null>(null);

  const load = React.useCallback(async () => {
    if (!open) return;
    const data = await fetchCompanyDetails(companyName);
    setDetails(data.company);
    setSignal(data.company?.aiSignal);
  }, [open, companyName]);

  React.useEffect(() => { load(); }, [load]);

  // Prospect posts are separate from the company's own posts — they live per
  // person (agamx_people_post_details) and are gathered by the Account Intel run.
  React.useEffect(() => {
    if (!open) { setProspectGroups(null); return; }
    let stop = false;
    fetchCompanyProspectPosts(runId, companyName)
      .then(r => { if (!stop) setProspectGroups(r.prospects); })
      .catch(() => { if (!stop) setProspectGroups([]); });
    return () => { stop = true; };
  }, [open, runId, companyName]);

  const analyze = async () => {
    setAnalyzing(true);
    try { const r = await analyzeCompanySignal(companyName); setSignal(r.aiSignal); }
    catch { /* surfaced as no-op */ }
    finally { setAnalyzing(false); }
  };

  const cfg = SIGNAL[signal?.signal ?? ''] ?? { bg: 'var(--color-surface)', text: 'var(--color-text-2)', dot: 'var(--color-text-3)' };

  const signalCard = (
    <div style={{ background: cfg.bg, borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-1)' }}>Account Category</span>
        <button onClick={analyze} disabled={analyzing} style={{ fontSize: '11px', fontWeight: 700, color: cfg.text, background: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 9px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          {analyzing ? 'Analysing…' : signal ? 'Re-analyse' : 'Analyse'}
        </button>
      </div>
      {signal ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: cfg.dot }} />
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: cfg.text }}>{SIGNAL_NAME[signal.signal] || signal.label}</span>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: cfg.text, background: 'rgba(255,255,255,0.6)', padding: '2px 7px', borderRadius: 'var(--radius-full)' }}>{Math.round(signal.confidence * 100)}%</span>
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--color-text-2)', lineHeight: 1.55, margin: '0 0 8px' }}>{signal.summary}</p>
          {signal.keywords?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {signal.keywords.map((k, i) => <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: cfg.text, border: `1px solid ${cfg.dot}`, padding: '2px 7px', borderRadius: 'var(--radius-full)' }}>{k}</span>)}
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: '12.5px', color: 'var(--color-text-3)', margin: 0 }}>Analyse the scraped posts to classify this account.</p>
      )}
    </div>
  );

  const rightSlot = (
    <>
      {signalCard}
      <ProspectActivity groups={prospectGroups} />
    </>
  );

  return (
    <EnrichmentPostsPanel
      open={open}
      onClose={onClose}
      title="Company Details"
      subtitle={companyName}
      linkedinUrl={companyLinkedin}
      posts={details?.posts ?? []}
      enriched={!!details}
      signalSlot={rightSlot}
      onEnrich={async (n) => (await enrichCompany(companyName, runId, n)).enrichmentId}
      onEnriched={load}
    />
  );
}

// ── Prospect Activity ───────────────────────────────────────────────────────
// The company's listed prospects grouped with their scraped posts. Reuses the
// same compact post-card look as the company post list. Groups with posts sort
// first (server-side); people with none still show, so the state is honest.
function ProspectActivity({ groups }: { groups: ProspectPostGroup[] | null }) {
  if (groups === null) {
    return <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', padding: '4px 0 12px' }}>Loading prospect activity…</div>;
  }
  if (groups.length === 0) return null;

  const totalPosts = groups.reduce((n, g) => n + g.postCount, 0);
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>
        Prospect Activity · {totalPosts} post{totalPosts === 1 ? '' : 's'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {groups.map(g => <ProspectGroup key={g.prospectId} group={g} />)}
      </div>
    </div>
  );
}

function ProspectGroup({ group }: { group: ProspectPostGroup }) {
  // Expanded by default only when there's something to show, so a company with
  // many post-less prospects doesn't open as a wall of empty groups.
  const [open, setOpen] = React.useState(group.postCount > 0);
  const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return s; } };

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--color-surface)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
      >
        <span style={{ fontSize: '10px', color: 'var(--color-text-3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
          {group.title && <div style={{ fontSize: '11px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.title}</div>}
        </div>
        {group.linkedinUrl && <a href={group.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '11px', fontWeight: 600, color: '#0077B5', textDecoration: 'none', flexShrink: 0 }}>in ↗</a>}
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: group.postCount ? 'var(--color-brand-text)' : 'var(--color-text-3)', background: group.postCount ? 'var(--color-brand-subtle)' : 'var(--color-hover)', padding: '2px 8px', borderRadius: 'var(--radius-full)', flexShrink: 0 }}>{group.postCount}</span>
      </button>
      {open && (
        <div>
          {group.postCount === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--color-text-3)' }}>No recent posts scraped for this prospect.</div>
          ) : group.posts.map((p, i) => (
            <div key={p.urnId || i} style={{ padding: '11px 14px', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>{fmtDate(p.postedAt)}</span>
                {p.postUrl && <a href={p.postUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#0077B5', textDecoration: 'none' }}>View ↗</a>}
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--color-text-1)', lineHeight: 1.5, margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{p.text || 'No text'}</p>
              <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--color-text-3)' }}>
                <span>♡ {p.reactions?.total ?? 0}</span><span>💬 {p.comments}</span><span>↗ {p.shares}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
