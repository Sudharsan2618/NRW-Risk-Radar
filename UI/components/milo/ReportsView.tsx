'use client';

import React from 'react';
import { fetchCampaignReport, listImportCampaigns, type CampaignReport, type CampaignReportRow } from '@/lib/leadFunnelApi';
import { listCampaigns as listHrCampaigns } from '@/lib/hrApi';

/** A campaign the report can be run for — either an Import or a Search campaign,
 *  normalised to a common shape. Only ACTIVE campaigns are offered. */
type ReportCampaign = { id: string; name: string; kind: 'import' | 'search' };

const btn: React.CSSProperties = { padding: '8px 13px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', color: 'var(--color-text-1)', fontSize: '12.5px', fontWeight: 650, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const primary: React.CSSProperties = { ...btn, background: 'var(--color-brand)', borderColor: 'var(--color-brand)', color: '#fff' };
const panel: React.CSSProperties = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' };
const fieldLabel: React.CSSProperties = { color: 'var(--color-text-3)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)' };
const control: React.CSSProperties = { minHeight: '38px', padding: '8px 10px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)', fontSize: '13.5px' };
const sectionHead: React.CSSProperties = { padding: '17px 19px', borderBottom: '1px solid var(--color-border)' };
const sectionTitle: React.CSSProperties = { fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)' };
const sectionSub: React.CSSProperties = { color: 'var(--color-text-2)', fontSize: '12px', marginTop: '3px' };

/** Rows per page in Activity detail. A 30-day range on a busy campaign runs to
 *  hundreds of touches; rendering them all made the page scroll for screens. */
const PAGE_SIZE = 25;

type RangeKey = 'today' | '7d' | '30d' | 'custom';
const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', custom: 'Custom range',
};

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function dateLabel(value: string): string { return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function dateTime(value?: string | null): string { return value ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }

/** Resolve a preset to its [from, to] pair. `custom` keeps whatever is on screen. */
function rangeDates(key: RangeKey, current: { from: string; to: string }): { from: string; to: string } {
  const end = new Date();
  if (key === 'custom') return current;
  const days = key === 'today' ? 1 : key === '7d' ? 7 : 30;
  return { from: isoDate(new Date(end.getTime() - (days - 1) * 86400000)), to: isoDate(end) };
}

function downloadCsv(rows: CampaignReportRow[], campaignName: string, from: string, to: string) {
  const header = ['Company', 'Prospect name', 'Job title', 'LinkedIn link', 'Medium', 'Sent date', 'Status'];
  const escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const csv = [header, ...rows.map(r => [r.company, r.prospectName, r.jobTitle, r.linkedinUrl, r.medium, r.sentAt || '', r.status])]
    .map(row => row.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${from}-to-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── skeleton ──
   Mirrors the real composition (5 stat cards, chart + funnel pair, table) so the
   layout holds its shape and nothing jumps when the report lands. Shares the
   shimmer treatment used by the My-Tasks boards. */
function SkeletonBar({ w = '100%', h = 12, r = 6, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return <div className="sk-shimmer" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />;
}

function ReportSkeleton() {
  return <div aria-busy="true" aria-label="Loading report">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '17px' }}>
      {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ ...panel, padding: '16px 17px' }}>
        <SkeletonBar w={78} h={10} />
        <SkeletonBar w={54} h={24} style={{ marginTop: '11px' }} />
        <SkeletonBar w={92} h={9} style={{ marginTop: '7px' }} />
      </div>)}
    </div>
    <div className="rep-split">
      <section style={panel}>
        <div style={sectionHead}><SkeletonBar w={132} h={13} /><SkeletonBar w={168} h={10} style={{ marginTop: '7px' }} /></div>
        <div style={{ padding: '20px', display: 'flex', alignItems: 'flex-end', gap: '10px', height: '230px' }}>
          {[42, 66, 30, 78, 52, 88, 36].map((h, i) => <SkeletonBar key={i} w="100%" h={Math.round(h * 1.6)} r={4} style={{ flex: 1 }} />)}
        </div>
      </section>
      <section style={panel}>
        <div style={sectionHead}><SkeletonBar w={118} h={13} /><SkeletonBar w={92} h={10} style={{ marginTop: '7px' }} /></div>
        <div style={{ padding: '19px' }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '17px 0' }}>
          <SkeletonBar w={62} h={10} /><SkeletonBar h={9} r={99} style={{ flex: 1 }} /><SkeletonBar w={20} h={10} />
        </div>)}</div>
      </section>
    </div>
    <section style={panel}>
      <div style={sectionHead}><SkeletonBar w={104} h={13} /><SkeletonBar w={220} h={10} style={{ marginTop: '7px' }} /></div>
      {[0, 1, 2, 3, 4, 5].map(i => <div key={i} style={{ display: 'flex', gap: '18px', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid var(--color-border)' }}>
        <SkeletonBar w="21%" h={11} /><SkeletonBar w="18%" h={11} /><SkeletonBar w="20%" h={11} />
        <SkeletonBar w="9%" h={11} /><SkeletonBar w="16%" h={11} /><SkeletonBar w={54} h={17} r={99} />
      </div>)}
    </section>
  </div>;
}

function SummaryCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <div style={{ ...panel, padding: '16px 17px' }}>
    <div style={{ color: 'var(--color-text-2)', fontSize: '12px', fontWeight: 650 }}>{label}</div>
    <div style={{ fontSize: '25px', fontWeight: 750, letterSpacing: '-.04em', marginTop: '9px', color: 'var(--color-text-1)' }}>{value}</div>
    {note && <div style={{ color: 'var(--color-text-3)', fontSize: '11px', marginTop: '3px' }}>{note}</div>}
  </div>;
}

function ActivityChart({ report }: { report: CampaignReport }) {
  const max = Math.max(1, ...report.daily.flatMap(d => [d.emails, d.linkedin]));
  // A 30-day range packs 30 labels onto the axis; show every nth so they stay legible.
  const step = Math.max(1, Math.ceil(report.daily.length / 10));
  return <div style={{ padding: '20px 20px 14px' }}>
    <div style={{ height: '230px', display: 'flex', gap: '10px' }}>
      <div style={{ width: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: 'var(--color-text-3)', fontSize: '10px', paddingBottom: '22px' }}>
        <span>{max}</span><span>{Math.round(max * .66)}</span><span>{Math.round(max * .33)}</span><span>0</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'end', gap: 'clamp(5px, 1.5vw, 18px)', borderBottom: '1px solid var(--color-border-2)', background: 'repeating-linear-gradient(to bottom, transparent 0, transparent 54px, var(--color-border) 55px)', padding: '0 6px' }}>
          {report.daily.map(day => <div key={day.date} style={{ flex: 1, minWidth: '10px', height: '100%', display: 'flex', alignItems: 'end', justifyContent: 'center', gap: '3px' }}>
            <span title={`${dateLabel(day.date)} · ${day.emails} emails`} style={{ width: '9px', maxWidth: '45%', height: `${Math.max(3, (day.emails / max) * 100)}%`, background: 'var(--color-brand)', borderRadius: '4px 4px 0 0' }} />
            <span title={`${dateLabel(day.date)} · ${day.linkedin} LinkedIn invites`} style={{ width: '9px', maxWidth: '45%', height: `${Math.max(3, (day.linkedin / max) * 100)}%`, background: 'var(--color-avatar-blue)', borderRadius: '4px 4px 0 0' }} />
          </div>)}
        </div>
        <div style={{ display: 'flex', gap: '4px', color: 'var(--color-text-3)', fontSize: '10px', padding: '7px 4px 0' }}>
          {report.daily.map((d, i) => <span key={d.date} style={{ flex: 1, minWidth: 0, textAlign: 'center', whiteSpace: 'nowrap' }}>{i % step === 0 ? dateLabel(d.date) : ''}</span>)}
        </div>
      </div>
    </div>
    <div style={{ display: 'flex', gap: '18px', color: 'var(--color-text-2)', fontSize: '11px', marginTop: '14px' }}>
      <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-brand)', marginRight: 5 }} />Emails</span>
      <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-avatar-blue)', marginRight: 5 }} />LinkedIn invites</span>
    </div>
  </div>;
}

/* Fixed column widths: every cell truncates to one line with its full value in a
   tooltip, so a long job title can no longer push Medium/Sent date out of view. */
const COLUMNS: { key: string; label: string; width: string }[] = [
  { key: 'company', label: 'Company', width: '22%' },
  { key: 'prospect', label: 'Prospect', width: '21%' },
  { key: 'jobTitle', label: 'Job title', width: '21%' },
  { key: 'medium', label: 'Medium', width: '10%' },
  { key: 'sentAt', label: 'Sent date', width: '16%' },
  { key: 'status', label: 'Status', width: '10%' },
];

const cellBase: React.CSSProperties = {
  padding: '13px 18px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-2)',
  fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

function ActivityTable({ report, from, to }: { report: CampaignReport; from: string; to: string }) {
  const [page, setPage] = React.useState(0);
  const rows = report.rows;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // A new (or shorter) report must never strand the view on a page that no longer
  // exists — clamp rather than render an empty table.
  const current = Math.min(page, pageCount - 1);
  React.useEffect(() => { setPage(0); }, [report]);

  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const first = rows.length === 0 ? 0 : current * PAGE_SIZE + 1;
  const last = Math.min(rows.length, (current + 1) * PAGE_SIZE);

  const pageBtn = (disabled: boolean): React.CSSProperties => ({
    ...btn, padding: '6px 11px', fontSize: '12px',
    color: disabled ? 'var(--color-text-3)' : 'var(--color-text-1)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .6 : 1,
  });

  return <section style={panel}>
    <div style={{ ...sectionHead, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div>
        <div style={sectionTitle}>Activity detail</div>
        <div style={sectionSub}>Every email and LinkedIn touch in the selected period</div>
      </div>
      <button style={btn} onClick={() => downloadCsv(rows, report.campaign.name, from, to)}>Download CSV</button>
    </div>

    {rows.length === 0 ? (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--color-text-1)', fontWeight: 650, fontSize: '13.5px' }}>No outreach activity in this period</div>
        <div style={{ color: 'var(--color-text-3)', fontSize: '12.5px', marginTop: '5px' }}>Try a wider date range, or check that this campaign was active.</div>
      </div>
    ) : <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>{COLUMNS.map(c => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
          <thead><tr>{COLUMNS.map(c => <th key={c.key} scope="col" style={{
            textAlign: 'left', padding: '11px 18px', background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-3)',
            fontSize: '10px', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>{c.label}</th>)}</tr></thead>
          <tbody>
            {visible.map((row, i) => {
              const replied = row.status === 'replied';
              const bounced = row.status === 'bounced';
              return <tr key={`${row.prospectName}-${row.sentAt}-${i}`} className="rep-row">
                <td style={{ ...cellBase, color: 'var(--color-text-1)', fontWeight: 650 }} title={row.company}>{row.company}</td>
                <td style={cellBase} title={row.linkedinUrl ? `${row.prospectName} — open LinkedIn profile` : row.prospectName}>
                  {/* The name IS the link. A separate "Open profile" column spent a
                      tenth of the table repeating one word on every row. */}
                  {row.linkedinUrl
                    ? <a href={row.linkedinUrl} target="_blank" rel="noreferrer" className="rep-link" style={{ color: 'var(--color-brand)', fontWeight: 650, textDecoration: 'none' }}>{row.prospectName}</a>
                    : <span style={{ color: 'var(--color-text-1)', fontWeight: 650 }}>{row.prospectName}</span>}
                </td>
                <td style={cellBase} title={row.jobTitle || undefined}>{row.jobTitle || '—'}</td>
                <td style={cellBase}>{row.medium}</td>
                <td style={cellBase} title={dateTime(row.sentAt)}>{dateTime(row.sentAt)}</td>
                <td style={{ ...cellBase, overflow: 'visible' }}>
                  <span style={{
                    display: 'inline-flex', padding: '4px 8px', borderRadius: 'var(--radius-full)',
                    background: bounced ? 'var(--color-danger-bg)' : replied ? 'var(--color-success-bg)' : 'var(--color-brand-subtle)',
                    color: bounced ? 'var(--color-danger-text)' : replied ? 'var(--color-success-text)' : 'var(--color-brand-text)',
                    fontSize: '11px', fontWeight: 700,
                  }}>{row.status}</span>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '11px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--color-text-3)', fontSize: '11.5px' }}>
          Showing {first}–{last} of {rows.length} · Sorted newest first
        </div>
        {pageCount > 1 && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button style={pageBtn(current === 0)} disabled={current === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</button>
          <span style={{ color: 'var(--color-text-2)', fontSize: '12px', minWidth: '82px', textAlign: 'center' }}>Page {current + 1} of {pageCount}</span>
          <button style={pageBtn(current >= pageCount - 1)} disabled={current >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>Next</button>
        </div>}
      </div>
    </>}
  </section>;
}

export function ReportsView() {
  // Default to Today: the question this screen answers most often is "did today's
  // outreach actually go out?", and a 7-day default buried that under six other days.
  const initial = React.useMemo(() => rangeDates('today', { from: '', to: '' }), []);
  const [rangeKey, setRangeKey] = React.useState<RangeKey>('today');
  const [from, setFrom] = React.useState(initial.from);
  const [to, setTo] = React.useState(initial.to);
  const [campaigns, setCampaigns] = React.useState<ReportCampaign[]>([]);
  const [campaignId, setCampaignId] = React.useState('');
  const [report, setReport] = React.useState<CampaignReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingReport, setLoadingReport] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadReport = React.useCallback(async (id = campaignId, start = from, end = to) => {
    if (!id) return;
    setLoadingReport(true); setError(null);
    try { setReport(await fetchCampaignReport(id, start, end)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load campaign report'); }
    finally { setLoadingReport(false); }
  }, [campaignId, from, to]);

  React.useEffect(() => {
    let alive = true;
    // Reports cover BOTH campaign systems: Import (lead-funnel) and Search (HR). Only
    // ACTIVE campaigns are offered — a paused campaign is not being worked, so it has
    // nothing to report on. Both endpoints are scoped to campaigns the user can see.
    const isActive = (s?: string) => (s || 'active') === 'active';
    Promise.allSettled([listImportCampaigns(), listHrCampaigns()])
      .then(([imp, hr]) => {
        if (!alive) return;
        const list: ReportCampaign[] = [];
        if (imp.status === 'fulfilled') {
          list.push(...(imp.value.campaigns || [])
            .filter(c => isActive(c.status))
            .map(c => ({ id: c._id, name: c.name, kind: 'import' as const })));
        }
        if (hr.status === 'fulfilled') {
          list.push(...hr.value
            .filter(c => !c.isLegacy && isActive(c.status))
            .map(c => ({ id: c.id, name: c.name, kind: 'search' as const })));
        }
        if (imp.status === 'rejected' && hr.status === 'rejected') {
          setError('Could not load campaigns.');
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        setCampaigns(list);
        if (list[0]) { setCampaignId(list[0].id); void loadReport(list[0].id); }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []); // initial campaign selection only

  // Picking a preset or a campaign reloads immediately — leaving the previous
  // period's numbers on screen under a new label is misleading state. Hand-typed
  // From/To still wait for Apply, so a half-entered range never fires a request.
  const onPreset = (key: RangeKey) => {
    const next = rangeDates(key, { from, to });
    setRangeKey(key); setFrom(next.from); setTo(next.to);
    if (key !== 'custom') void loadReport(campaignId, next.from, next.to);
  };
  const onCampaign = (id: string) => { setCampaignId(id); void loadReport(id, from, to); };

  const summary = report?.summary;
  const selected = campaigns.find(c => c.id === campaignId);

  return <div style={{ flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--color-bg)' }}>
    <style>{`
      .sk-shimmer{background:linear-gradient(90deg,var(--color-surface) 25%,var(--color-border) 37%,var(--color-surface) 63%);background-size:400% 100%;animation:sk-shimmer 1.4s ease infinite;}
      @keyframes sk-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
      @media (prefers-reduced-motion: reduce){.sk-shimmer{animation:none;}}
      .rep-row:hover{background:var(--color-row-hover);}
      .rep-link:hover{text-decoration:underline;}
      .rep-link:focus-visible{outline:2px solid var(--color-brand);outline-offset:2px;border-radius:3px;}
      /* The chart carries the period's shape and earns the wider column; the funnel
         is four values. Below 900px the pair stacks rather than squeezing both. */
      .rep-split{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(260px,1fr);gap:17px;margin-bottom:17px;}
      @media (max-width:900px){.rep-split{grid-template-columns:minmax(0,1fr);}}
    `}</style>

    {/* Full-bleed like every other screen. The old 1440px centred column left two
        dead margins on a wide display while the table inside it scrolled sideways. */}
    <main style={{ padding: '18px 20px 40px' }}>
      <div style={{ color: 'var(--color-text-3)', fontSize: '12px', marginBottom: '7px' }}>Reports / Campaign performance</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', marginBottom: '18px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', lineHeight: 1.2, letterSpacing: '-.03em', color: 'var(--color-text-1)', fontWeight: 700 }}>Campaign reports</h1>
          <div style={{ color: 'var(--color-text-2)', marginTop: '4px', fontSize: '13.5px' }}>Understand what happened across your outreach, day by day.</div>
        </div>
        <button style={{ ...primary, opacity: report ? 1 : .6, cursor: report ? 'pointer' : 'not-allowed' }} disabled={!report}
          onClick={() => report && downloadCsv(report.rows, report.campaign.name, from, to)}>Download CSV</button>
      </div>

      <section style={{ ...panel, padding: '13px 14px', display: 'flex', alignItems: 'end', gap: '13px', flexWrap: 'wrap', marginBottom: '17px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '230px', flex: '1 1 230px', maxWidth: '340px' }}>
          <label htmlFor="rep-campaign" style={fieldLabel}>Campaign</label>
          <select id="rep-campaign" value={campaignId} onChange={e => onCampaign(e.target.value)} style={control}>
            <option value="">Select campaign</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '150px' }}>
          <label htmlFor="rep-range" style={fieldLabel}>Range</label>
          <select id="rep-range" value={rangeKey} onChange={e => onPreset(e.target.value as RangeKey)} style={control}>
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map(k => <option key={k} value={k}>{RANGE_LABELS[k]}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="rep-from" style={fieldLabel}>From</label>
          <input id="rep-from" type="date" value={from} max={to} onChange={e => { setFrom(e.target.value); setRangeKey('custom'); }} style={control} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label htmlFor="rep-to" style={fieldLabel}>To</label>
          <input id="rep-to" type="date" value={to} min={from} onChange={e => { setTo(e.target.value); setRangeKey('custom'); }} style={control} />
        </div>
        <button style={{ ...primary, marginLeft: 'auto', opacity: !campaignId || loadingReport ? .6 : 1, cursor: !campaignId || loadingReport ? 'not-allowed' : 'pointer' }}
          disabled={!campaignId || loadingReport} onClick={() => void loadReport()}>{loadingReport ? 'Loading…' : 'Apply filters'}</button>
      </section>

      {error && <div role="alert" style={{ padding: '13px 15px', color: 'var(--color-danger-text)', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', marginBottom: '17px', fontSize: '13px' }}>{error}</div>}

      {loading || (loadingReport && !report) ? <ReportSkeleton />
        : !report ? <div style={{ ...panel, padding: '52px', textAlign: 'center' }}>
            <div style={{ color: 'var(--color-text-1)', fontWeight: 650, fontSize: '14px' }}>{campaigns.length ? 'Select a campaign to view its report' : 'No campaigns yet'}</div>
            <div style={{ color: 'var(--color-text-3)', fontSize: '12.5px', marginTop: '5px' }}>{campaigns.length ? 'Pick one above and choose a date range.' : 'Import or create a campaign to see its performance here.'}</div>
          </div>
        : <div style={{ opacity: loadingReport ? .55 : 1, transition: 'opacity .15s ease' }} aria-busy={loadingReport}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '17px' }}>
            <SummaryCard label="Emails sent" value={summary?.emailsSent ?? 0} note="Delivered" />
            <SummaryCard label="Bounced" value={summary?.bounced ?? 0} note="Rejected by recipient" />
            <SummaryCard label="LinkedIn invites" value={summary?.linkedinInvites ?? 0} />
            <SummaryCard label="Responses" value={summary?.responses ?? 0} />
            <SummaryCard label="Response rate" value={`${summary?.responseRate ?? 0}%`} note="Responses / emails sent" />
          </div>
          <div className="rep-split">
            <section style={panel}>
              <div style={sectionHead}>
                <div style={sectionTitle}>Activity over time</div>
                <div style={sectionSub}>{dateLabel(report.range.from)} – {dateLabel(report.range.to)}{selected ? ` · ${selected.name}` : ''}</div>
              </div>
              <ActivityChart report={report} />
            </section>
            <section style={panel}>
              <div style={sectionHead}>
                <div style={sectionTitle}>Campaign funnel</div>
                <div style={sectionSub}>{RANGE_LABELS[rangeKey]}</div>
              </div>
              <div style={{ padding: '19px' }}>
                {([['Contacted', summary?.touches ?? 0], ['Emails', summary?.emailsSent ?? 0], ['LinkedIn', summary?.linkedinInvites ?? 0], ['Responses', summary?.responses ?? 0]] as const).map(([label, value], i) =>
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '17px 0' }}>
                    <span style={{ width: '73px', color: 'var(--color-text-2)', fontSize: '12px' }}>{label}</span>
                    <div style={{ flex: 1, height: '9px', background: 'var(--color-surface)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Number(value) / Math.max(1, summary?.touches || 1) * 100)}%`, background: i === 3 ? 'var(--color-success)' : 'var(--color-brand)', borderRadius: '99px' }} />
                    </div>
                    <strong style={{ width: '30px', textAlign: 'right', fontSize: '13px' }}>{value}</strong>
                  </div>)}
              </div>
            </section>
          </div>
          <ActivityTable report={report} from={from} to={to} />
        </div>}
    </main>
  </div>;
}
