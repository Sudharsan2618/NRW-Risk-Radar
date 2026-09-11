'use client';
import React from 'react';
import { fetchRunOverview, type RunOverview, type LeadFunnelRun } from '@/lib/leadFunnelApi';

// Signal palette — kept in sync with the Companies-tab badge colors.
const SIGNAL: Record<string, { color: string; label: string }> = {
  green: { color: 'var(--color-success)', label: 'AI Ready' },
  yellow: { color: 'var(--color-warning)', label: 'Interested' },
  orange: { color: '#F97316', label: 'Passive' },
  red: { color: 'var(--color-danger)', label: 'Not considering' },
  notAnalyzed: { color: 'var(--color-border-2)', label: 'Not analyzed' },
};
const LEVEL_LABEL: Record<string, string> = { csuite: 'C-Suite', head: 'Head of', director: 'Director', vp: 'VP', other: 'Other' };

const card: React.CSSProperties = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' };
const lbl: React.CSSProperties = { fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.6px' };
const big: React.CSSProperties = { fontSize: '26px', fontWeight: 800, color: 'var(--color-text-1)', marginTop: '6px', lineHeight: 1 };
const sub: React.CSSProperties = { fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '6px' };
const ttl: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '12px' };

function pct(n: number, d: number) { return d > 0 ? Math.round((n / d) * 100) : 0; }

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(s)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Donut built from proportional segments. Renders a centered total. */
function Donut({ segments, total, centerLabel }: { segments: { value: number; color: string }[]; total: number; centerLabel: string }) {
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  let offset = 0;
  return (
    <svg width="96" height="96" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
      <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--color-surface)" strokeWidth="4" />
      {segments.filter(s => s.value > 0).map((s, i) => {
        const len = (s.value / sum) * 100;
        const el = (
          <circle key={i} cx="18" cy="18" r="15.915" fill="none" stroke={s.color} strokeWidth="4"
            strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-offset} transform="rotate(-90 18 18)" />
        );
        offset += len;
        return el;
      })}
      <text x="18" y="17.5" textAnchor="middle" fontSize="7" fontWeight="800" fill="var(--color-text-1)" fontFamily="var(--font-sans)">{total}</text>
      <text x="18" y="22.5" textAnchor="middle" fontSize="2.6" fill="var(--color-text-3)" fontFamily="var(--font-sans)" style={{ textTransform: 'uppercase', letterSpacing: '0.3px' }}>{centerLabel}</text>
    </svg>
  );
}

function LegendRow({ color, label, count, muted }: { color: string; label: string; count: number; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: muted ? 'var(--color-text-3)' : 'var(--color-text-1)' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{count}</span>
    </div>
  );
}

function KpiCard({ label, value, sub: subtext, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{ ...card, ...(accent ? { borderColor: 'var(--color-brand)' } : {}) }}>
      <div style={{ ...lbl, ...(accent ? { color: 'var(--color-brand-text)' } : {}) }}>{label}</div>
      <div style={{ ...big, ...(accent ? { color: 'var(--color-brand-text)' } : {}) }}>{value}</div>
      <div style={sub}>{subtext}</div>
    </div>
  );
}

export function ImportOverview({ run }: { run: LeadFunnelRun }) {
  const runId = run._id;
  const [data, setData] = React.useState<RunOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    setLoading(true); setError(false);
    fetchRunOverview(runId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13.5px' }}>Loading overview…</div>;
  if (error || !data) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13.5px' }}>Couldn’t load overview.</div>;

  const { companies, prospects, outreach, funnel, recent } = data;
  const delivered = outreach.sent + outreach.replied;
  const noEmail = Math.max(0, prospects.total - prospects.withEmail);
  const notContacted = Math.max(0, companies.total - companies.contacted);

  const signalSegments = (['green', 'yellow', 'orange', 'red', 'notAnalyzed'] as const).map(k => ({ value: companies.signal[k], color: SIGNAL[k].color }));
  const outreachSegments = [
    { value: outreach.sent, color: 'var(--color-brand)' },
    { value: outreach.replied, color: 'var(--color-success)' },
    { value: outreach.failed, color: 'var(--color-danger)' },
    { value: outreach.pending, color: 'var(--color-warning)' },
  ];
  const levelMax = Math.max(1, ...Object.values(prospects.byLevel));

  const funnelStages = [
    { key: 'companies', label: 'Companies', value: funnel.companies, color: 'var(--color-brand)', op: 0.95 },
    { key: 'prospects', label: 'Prospects', value: funnel.prospects, color: 'var(--color-brand)', op: 0.82 },
    { key: 'withEmail', label: 'With email', value: funnel.withEmail, color: 'var(--color-brand)', op: 0.68 },
    { key: 'emailed', label: 'Emailed', value: funnel.emailed, color: 'var(--color-brand)', op: 0.54 },
    { key: 'replied', label: 'Replied', value: funnel.replied, color: 'var(--color-success)', op: 1 },
  ];
  const funnelMax = Math.max(1, ...funnelStages.map(s => s.value));

  const hasInsight = noEmail > 0 || notContacted > 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 40px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>Overview</div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '2px' }}>Coverage and outreach performance for {run.runName}.</div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
        <KpiCard label="Companies" value={String(companies.total)} sub={`${companies.contacted} contacted · ${pct(companies.contacted, companies.total)}%`} />
        <KpiCard label="Prospects" value={String(prospects.total)} sub={`${prospects.withEmail} with email${noEmail ? ` · ${noEmail} missing` : ''}`} />
        <KpiCard label="Emails Delivered" value={String(delivered)} sub={`${outreach.failed} failed · ${outreach.pending} in queue`} accent />
        <KpiCard label="Replies" value={String(outreach.replied)} sub={delivered ? `${pct(outreach.replied, delivered)}% reply rate` : 'No sends yet'} />
      </div>

      {/* Funnel + two donuts — one row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap: '12px', marginBottom: '12px', alignItems: 'stretch' }}>
        {/* Conversion funnel as horizontal bars (reads as a funnel; fits a narrow column) */}
        <div style={card}>
          <div style={ttl}>Conversion funnel</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
            {funnelStages.map((s, i) => {
              const prev = i > 0 ? funnelStages[i - 1].value : s.value;
              const drop = i > 0 && prev > 0 ? pct(s.value, prev) : null;
              return (
                <div key={s.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--color-text-2)' }}>{s.label}</span>
                    <span>
                      {drop !== null && <span style={{ fontSize: '10.5px', color: 'var(--color-text-3)', marginRight: '6px' }}>{drop}%</span>}
                      <span style={{ fontWeight: 800, color: s.key === 'replied' ? 'var(--color-success-text)' : 'var(--color-text-1)' }}>{s.value}</span>
                    </span>
                  </div>
                  <div style={{ height: 9, borderRadius: 5, background: 'var(--color-surface)' }}>
                    <div style={{ height: 9, borderRadius: 5, width: `${(s.value / funnelMax) * 100}%`, background: s.color, opacity: s.op, minWidth: s.value ? 5 : 0 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI readiness signal */}
        <div style={card}>
          <div style={ttl}>AI readiness signal</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Donut segments={signalSegments} total={companies.total} centerLabel="firms" />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(['green', 'yellow', 'orange', 'red', 'notAnalyzed'] as const).map(k => (
                <LegendRow key={k} color={SIGNAL[k].color} label={SIGNAL[k].label} count={companies.signal[k]} muted={k === 'notAnalyzed'} />
              ))}
            </div>
          </div>
        </div>

        {/* Outreach status */}
        <div style={card}>
          <div style={ttl}>Outreach status</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Donut segments={outreachSegments} total={delivered} centerLabel="sent" />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <LegendRow color="var(--color-brand)" label="Delivered" count={outreach.sent} />
              <LegendRow color="var(--color-success)" label="Replied" count={outreach.replied} muted={outreach.replied === 0} />
              <LegendRow color="var(--color-danger)" label="Failed" count={outreach.failed} muted={outreach.failed === 0} />
              <LegendRow color="var(--color-warning)" label="In queue" count={outreach.pending} muted={outreach.pending === 0} />
              {outreach.skipped > 0 && <LegendRow color="var(--color-border-2)" label="Skipped" count={outreach.skipped} muted />}
            </div>
          </div>
        </div>
      </div>

      {/* Seniority + Recent activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: hasInsight ? '12px' : 0 }}>
        <div style={card}>
          <div style={ttl}>Who we’re reaching <span style={{ fontWeight: 500, color: 'var(--color-text-3)' }}>· seniority</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(['csuite', 'head', 'director', 'vp', 'other'] as const).map(k => {
              const v = prospects.byLevel[k];
              return (
                <div key={k}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-2)', marginBottom: '4px' }}>
                    <span>{LEVEL_LABEL[k]}</span><span style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{v}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: 'var(--color-surface)' }}>
                    <div style={{ height: 7, borderRadius: 4, width: `${(v / levelMax) * 100}%`, background: 'var(--color-brand)', minWidth: v ? 4 : 0 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={card}>
          <div style={ttl}>Recent activity</div>
          {recent.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '12.5px' }}>No emails sent yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {recent.map((r, i) => {
                const replied = r.status === 'replied';
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.company}{r.company && r.at ? ' · ' : ''}{timeAgo(r.at)}</div>
                    </div>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)', flexShrink: 0, marginLeft: '8px', background: replied ? 'var(--color-success-bg)' : 'var(--color-surface)', color: replied ? 'var(--color-success-text)' : 'var(--color-brand-text)' }}>
                      {replied ? 'REPLIED' : 'SENT'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Actionable insight */}
      {hasInsight && (
        <div style={{ ...card, borderColor: 'var(--color-brand)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '15px' }}>💡</span>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>
            {noEmail > 0 && <><strong style={{ color: 'var(--color-text-1)' }}>{noEmail} prospect{noEmail === 1 ? '' : 's'}</strong> {noEmail === 1 ? 'has' : 'have'} no email yet</>}
            {noEmail > 0 && notContacted > 0 && ' and '}
            {notContacted > 0 && <><strong style={{ color: 'var(--color-text-1)' }}>{notContacted} compan{notContacted === 1 ? 'y' : 'ies'}</strong> {notContacted === 1 ? 'is' : 'are'} not contacted</>}
            {' '}— enrich &amp; send from the Run History tab to lift coverage.
          </div>
        </div>
      )}
    </div>
  );
}
