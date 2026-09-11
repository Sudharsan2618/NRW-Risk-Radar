'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { ProspectsPanel, Prospect, JobContext } from './ProspectsPanel';
import { HrOutreachStatusPanel } from './HrOutreachStatusPanel';
import {
  getRun,
  getRunJobs,
  getJobProspects,
  triggerEmailFlow,
  enrichProspects,
  type Run,
  type JobRow,
  type ProspectRow,
  type EmailFlowProspect,
  type EmailTemplate,
} from '@/lib/hrApi';

type Quality = 'all' | 'good' | 'poor';
type SortField = 'title' | 'company' | 'industry' | 'location' | 'outreach' | null;
type SortOrder = 'asc' | 'desc';

function seniorityFromTitle(title: string): Prospect['seniority'] {
  const t = (title || '').toLowerCase();
  if (/chief|ceo|cfo|coo|cto|founder|president/.test(t)) return 'c_suite';
  if (/\bvp\b|vice president/.test(t)) return 'vp';
  if (/director/.test(t)) return 'director';
  if (/head of|head,/.test(t)) return 'head';
  return 'manager';
}

const VALID_SENIORITIES = ['c_suite', 'vp', 'director', 'head', 'manager'];

function toProspect(p: ProspectRow, companyName: string): Prospect {
  const last = p.lastName && p.lastName.toLowerCase() !== 'unknown' ? p.lastName : '';
  return {
    id: p._id,
    firstName: p.firstName || '—',
    lastName: last,
    title: p.title || '',
    seniority: VALID_SENIORITIES.includes(p.seniority)
      ? (p.seniority as Prospect['seniority'])
      : seniorityFromTitle(p.title),
    location: p.prospectDetails?.location || '',
    email: p.email || '',
    phone: p.prospectDetails?.phone || undefined,
    linkedinUrl: p.prospectDetails?.linkedinUrl || '',
    isAccepted: p.isAccepted,
    isEnriched: p.isEnriched,
    mobileEnrichmentStatus: p.mobileEnrichmentStatus || undefined,
    industrySlug: p.industrySlug,
    companyId: p.companyId,
    matchReasons: p.matchReasons || [],
    outreachStatus: undefined,
    recentActivity: companyName ? `Surfaced for ${companyName} during the latest run.` : 'Surfaced during the latest run.',
  };
}

function fmtPosted(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CampaignRunResultsView({ id, runId }: { id: string; runId: string }) {
  const router = useRouter();

  const [run, setRun] = React.useState<Run | null>(null);
  const [runError, setRunError] = React.useState<string | null>(null);

  const [filter, setFilter] = React.useState<Quality>('all');
  const [page, setPage] = React.useState(1);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);

  // Search box. `searchInput` is bound to the field; `search` is the debounced
  // value actually sent to the backend (matches job title or company across all
  // pages). Resetting to page 1 whenever the debounced term changes keeps the
  // pager from pointing past the (smaller) filtered result set.
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [jobs, setJobs] = React.useState<JobRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const [jobsLoading, setJobsLoading] = React.useState(true);
  const [jobsError, setJobsError] = React.useState<string | null>(null);
  const [counts, setCounts] = React.useState<{ all: number; good: number; poor: number }>({ all: 0, good: 0, poor: 0 });

  const [sortField, setSortField] = React.useState<SortField>(null);
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('asc');

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [triggering, setTriggering] = React.useState(false);
  const [enrichingJobs, setEnrichingJobs] = React.useState(false);
  const [banner, setBanner] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Outreach status is shown in a live-polling right-side sheet (HrOutreachStatusPanel).
  const [statusOpen, setStatusOpen] = React.useState(false);

  // Prospects panel
  const [panelJob, setPanelJob] = React.useState<JobRow | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [panelProspects, setPanelProspects] = React.useState<Prospect[]>([]);
  const [panelRaw, setPanelRaw] = React.useState<ProspectRow[]>([]);
  const [panelLoading, setPanelLoading] = React.useState(false);
  const [panelError, setPanelError] = React.useState<string | null>(null);
  const [panelSending, setPanelSending] = React.useState(false);
  const [panelTemplate, setPanelTemplate] = React.useState<EmailTemplate | null>(null);

  // ── Load run header ──
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getRun(runId);
        if (!cancelled) setRun(r);
      } catch (e) {
        if (!cancelled) setRunError(e instanceof Error ? e.message : 'Failed to load run');
      }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  // ── Load filter-tab counts (best effort) ──
  const loadCounts = React.useCallback(async () => {
    try {
      const [all, good, poor] = await Promise.all([
        getRunJobs(runId, 1, 1, undefined, search),
        getRunJobs(runId, 1, 1, 'good', search),
        getRunJobs(runId, 1, 1, 'poor', search),
      ]);
      setCounts({ all: all.total, good: good.total, poor: poor.total });
    } catch {
      /* non-fatal */
    }
  }, [runId, search]);
  React.useEffect(() => { void loadCounts(); }, [loadCounts]);

  // ── Load jobs page ──
  const loadJobs = React.useCallback(async () => {
    setJobsLoading(true);
    setJobsError(null);
    try {
      const quality = filter === 'all' ? undefined : filter;
      const resp = await getRunJobs(runId, page, rowsPerPage, quality, search);
      setJobs(resp.jobs);
      setTotal(resp.total);
      setPages(resp.pages);
    } catch (e) {
      setJobsError(e instanceof Error ? e.message : 'Failed to load jobs');
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [runId, page, rowsPerPage, filter, search]);
  React.useEffect(() => { void loadJobs(); }, [loadJobs]);

  // ── Sorting (current page only — server paginates) ──
  const sorted = React.useMemo(() => {
    if (!sortField) return jobs;
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...jobs].sort((a, b) => {
      let va: string | number = '', vb: string | number = '';
      switch (sortField) {
        case 'title':    va = a.title.toLowerCase(); vb = b.title.toLowerCase(); break;
        case 'company':  va = (a.company || '').toLowerCase(); vb = (b.company || '').toLowerCase(); break;
        case 'industry': va = (a.industry || '').toLowerCase(); vb = (b.industry || '').toLowerCase(); break;
        case 'location': va = (a.location || '').toLowerCase(); vb = (b.location || '').toLowerCase(); break;
        case 'outreach': va = a.outreachCount; vb = b.outreachCount; break;
      }
      return va > vb ? dir : va < vb ? -dir : 0;
    });
  }, [jobs, sortField, sortOrder]);

  const toggleSort = (field: Exclude<SortField, null>) => {
    if (sortField === field) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else { setSortField(null); setSortOrder('asc'); }
    } else { setSortField(field); setSortOrder('asc'); }
  };

  const allVisibleSelected = sorted.length > 0 && sorted.every(j => selected.has(j._id));
  const toggleSelectAll = () => {
    const next = new Set(selected);
    if (allVisibleSelected) sorted.forEach(j => next.delete(j._id));
    else sorted.forEach(j => next.add(j._id));
    setSelected(next);
  };
  const toggleRow = (jid: string) => {
    const next = new Set(selected);
    if (next.has(jid)) next.delete(jid); else next.add(jid);
    setSelected(next);
  };

  // ── Prospects panel ──
  const openProspects = async (job: JobRow) => {
    setPanelJob(job);
    setPanelOpen(true);
    setPanelLoading(true);
    setPanelError(null);
    setPanelProspects([]);
    setPanelRaw([]);
    setPanelTemplate(null);
    try {
      const resp = await getJobProspects(job._id);
      setPanelRaw(resp.prospects);
      setPanelProspects(resp.prospects.map(p => toProspect(p, job.company)));
      setPanelTemplate(resp.emailTemplate ?? null);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : 'Failed to load prospects');
    } finally {
      setPanelLoading(false);
    }
  };
  const closeProspects = () => setPanelOpen(false);

  // Re-fetch the open job's prospects after an enrichment so revealed
  // email/phone data appears without closing the panel.
  const refreshPanelProspects = async () => {
    if (!panelJob) return;
    const resp = await getJobProspects(panelJob._id);
    setPanelRaw(resp.prospects);
    setPanelProspects(resp.prospects.map(p => toProspect(p, panelJob.company)));
    setPanelTemplate(resp.emailTemplate ?? null);
  };

  const panelJobContext: JobContext | null = panelJob ? {
    id: panelJob._id, title: panelJob.title, company: panelJob.company,
    industry: panelJob.industry || '', location: panelJob.location || '',
  } : null;

  // Send email to a specific set of prospects within the open panel's job.
  const sendPanelEmails = async (prospectIds: string[]) => {
    if (!panelJob || prospectIds.length === 0) return;
    setPanelSending(true);
    setBanner(null);
    try {
      const chosen = panelRaw.filter(p => prospectIds.includes(p._id));
      const payload: EmailFlowProspect[] = chosen.map(p => ({
        prospectId: p._id,
        companyId: p.companyId,
        firstName: p.firstName,
        email: p.email || '',
        industrySlug: p.industrySlug,
        title: p.title,
        companyName: panelJob.company,
        jobTitle: panelJob.title,
      }));
      const res = await triggerEmailFlow(runId, [{ jobId: panelJob._id, prospects: payload }]);
      setBanner({ kind: 'ok', text: res.message || `Email flow triggered for ${payload.length} prospect(s).` });
      setPanelOpen(false);
      void loadJobs();
    } catch (e) {
      setBanner({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to trigger email flow' });
    } finally {
      setPanelSending(false);
    }
  };

  // Table-level: send to all accepted prospects of the selected jobs.
  const triggerForSelectedJobs = async () => {
    if (selected.size === 0 || triggering) return;
    setTriggering(true);
    setBanner(null);
    try {
      const jobIds = Array.from(selected);
      const selectedJobs = jobs.filter(j => selected.has(j._id));
      const jobNameById = new Map(selectedJobs.map(j => [j._id, j]));

      const perJob = await Promise.all(jobIds.map(async jid => {
        const resp = await getJobProspects(jid);
        const job = jobNameById.get(jid);
        const accepted = resp.prospects.filter(p => p.isAccepted);
        const prospects: EmailFlowProspect[] = accepted.map(p => ({
          prospectId: p._id,
          companyId: p.companyId,
          firstName: p.firstName,
          email: p.email || '',
          industrySlug: p.industrySlug,
          title: p.title,
          companyName: job?.company || '',
          jobTitle: job?.title || '',
        }));
        return { jobId: jid, prospects };
      }));

      const jobsPayload = perJob.filter(j => j.prospects.length > 0);
      if (jobsPayload.length === 0) {
        setBanner({ kind: 'err', text: 'No accepted prospects found for the selected jobs.' });
        return;
      }
      const totalProspects = jobsPayload.reduce((s, j) => s + j.prospects.length, 0);
      const res = await triggerEmailFlow(runId, jobsPayload);
      setBanner({ kind: 'ok', text: res.message || `Email flow triggered for ${totalProspects} prospect(s) across ${jobsPayload.length} job(s).` });
      setSelected(new Set());
      void loadJobs();
    } catch (e) {
      setBanner({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to trigger email flow' });
    } finally {
      setTriggering(false);
    }
  };

  // Table-level: reveal emails for the un-enriched accepted prospects of the
  // selected jobs. Enriches per job so the HR per-job credit accounting holds.
  const enrichForSelectedJobs = async () => {
    if (selected.size === 0 || enrichingJobs) return;
    setEnrichingJobs(true);
    setBanner(null);
    try {
      const jobIds = Array.from(selected);
      let totalEnriched = 0;
      let totalAttempted = 0;
      for (const jid of jobIds) {
        const resp = await getJobProspects(jid);
        const ids = resp.prospects.filter(p => p.isAccepted && !p.email).map(p => p._id);
        if (ids.length === 0) continue;
        totalAttempted += ids.length;
        const res = await enrichProspects(ids, runId, jid, false);
        totalEnriched += res.enriched ?? 0;
      }
      if (totalAttempted === 0) {
        setBanner({ kind: 'err', text: 'No un-enriched accepted prospects in the selected jobs.' });
        return;
      }
      setBanner({ kind: 'ok', text: `Revealed ${totalEnriched} email(s) across ${jobIds.length} job(s).` });
      void loadJobs();
    } catch (e) {
      setBanner({ kind: 'err', text: e instanceof Error ? e.message : 'Bulk enrichment failed' });
    } finally {
      setEnrichingJobs(false);
    }
  };

  // Check status
  const startRow = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endRow = Math.min(page * rowsPerPage, total);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '10px 20px',
        borderBottom: '1px solid var(--color-border)', gap: '10px', flexShrink: 0,
        background: 'var(--color-bg)',
      }}>
        <button onClick={() => router.push('/campaigns/' + id)} style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 8px', background: 'none', border: 'none',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          color: 'var(--color-text-2)', fontFamily: 'var(--font-sans)',
          fontSize: '12px', fontWeight: 500,
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="8,2 3,7 8,12" />
          </svg>
          Back
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '520px' }}>
              {run?.title || `Run ${runId.slice(-4).toUpperCase()}`}
            </span>
            {run && (
              <span style={{
                fontSize: '11.5px', fontWeight: 600,
                color: 'var(--color-success-text)', background: 'var(--color-success-bg)',
                padding: '3px 10px', borderRadius: 'var(--radius-full)', textTransform: 'capitalize',
              }}>{run.status}</span>
            )}
          </div>
          {runError && <div style={{ fontSize: '12px', color: 'var(--color-danger-text)', marginTop: '2px' }}>{runError}</div>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            disabled={selected.size === 0 || enrichingJobs}
            onClick={enrichForSelectedJobs}
            title="Reveal emails for the selected jobs' prospects (uses email credits)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', background: 'var(--color-bg)',
              border: `1px solid ${selected.size === 0 ? 'var(--color-border-2)' : 'var(--color-brand)'}`,
              color: selected.size === 0 ? 'var(--color-text-3)' : 'var(--color-brand-text)',
              borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700,
              cursor: selected.size === 0 || enrichingJobs ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}>
            {enrichingJobs ? 'Enriching…' : `Enrich${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
          <button
            disabled={selected.size === 0 || triggering}
            onClick={triggerForSelectedJobs}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', background: 'var(--color-brand)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '12.5px', fontWeight: 700,
              cursor: selected.size === 0 || triggering ? 'not-allowed' : 'pointer',
              opacity: selected.size === 0 || triggering ? 0.5 : 1,
              fontFamily: 'var(--font-sans)',
            }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5" cy="5" r="2" /><path d="M2 12c0-2 1.5-3.5 3-3.5s3 1.5 3 3.5" /><circle cx="10.5" cy="5.5" r="1.5" /><path d="M11 11c1.2.4 2 1.4 2 2.8" />
            </svg>
            {triggering ? 'Triggering…' : `Trigger Email Flow${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
          <button onClick={() => setStatusOpen(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', background: 'var(--color-bg)', color: 'var(--color-text-1)',
            border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)',
            fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="var(--color-brand)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 9l2-3 2 4 3-6 2 4 1-2h2" />
            </svg>
            Check Status
          </button>
        </div>
      </div>

      {/* ── Banner ── */}
      {banner && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px', flexShrink: 0,
          background: banner.kind === 'ok' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          color: banner.kind === 'ok' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
          fontSize: '12.5px', fontWeight: 600,
        }}>
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '14px' }}>✕</button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '10px 20px',
        borderBottom: '1px solid var(--color-border)', gap: '12px', flexShrink: 0,
        background: 'var(--color-bg)',
      }}>
        <div style={{ display: 'flex', gap: '2px', padding: '3px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          {([
            { id: 'all',  label: 'All Jobs', count: counts.all  },
            { id: 'good', label: 'Accepted', count: counts.good },
            { id: 'poor', label: 'Rejected', count: counts.poor },
          ] as { id: Quality; label: string; count: number }[]).map(f => {
            const on = filter === f.id;
            return (
              <button key={f.id} onClick={() => { setFilter(f.id); setPage(1); }} style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                background: on ? 'var(--color-bg)' : 'transparent',
                color: on ? 'var(--color-brand)' : 'var(--color-text-2)',
                border: on ? '1px solid var(--color-border)' : '1px solid transparent',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', display: 'inline-flex', alignItems: 'center', gap: '6px',
                boxShadow: on ? 'var(--shadow-sm)' : 'none',
              }}>
                {f.label}
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: on ? 'var(--color-brand)' : 'var(--color-text-3)' }}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>
        {/* Search — matches job title or company across every page (server-side). */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '260px' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }}>
            <circle cx="7" cy="7" r="4.5" /><line x1="14" y1="14" x2="10.5" y2="10.5" />
          </svg>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search job title or company"
            style={{
              width: '100%', height: '30px', padding: '0 28px 0 30px',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-2)',
              background: 'var(--color-bg)', color: 'var(--color-text-1)',
              fontSize: '12.5px', fontFamily: 'var(--font-sans)', outline: 'none',
            }}
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')} title="Clear search" style={{
              position: 'absolute', right: '8px', display: 'flex', alignItems: 'center',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="3" y1="3" x2="11" y2="11" /><line x1="11" y1="3" x2="3" y2="11" /></svg>
            </button>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>
          <span style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{total}</span> jobs with prospects
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
        {jobsLoading ? (
          <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Loading jobs…</div>
        ) : jobsError ? (
          <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--color-danger-text)', fontSize: '13px' }}>{jobsError}</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--color-text-3)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: '6px' }}>No jobs found</div>
            <div style={{ fontSize: '13px' }}>No jobs with prospects match the current filter.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1, boxShadow: 'var(--shadow-sm)' }}>
                <th style={{ ...thStyle, width: '40px' }}>
                  <CheckBox checked={allVisibleSelected} onChange={toggleSelectAll} />
                </th>
                <SortableTh field="title"    label="Job title"  sortField={sortField} sortOrder={sortOrder} onClick={toggleSort} minWidth="200px" />
                <SortableTh field="company"  label="Company"    sortField={sortField} sortOrder={sortOrder} onClick={toggleSort} minWidth="160px" />
                <SortableTh field="industry" label="Industry"   sortField={sortField} sortOrder={sortOrder} onClick={toggleSort} minWidth="140px" />
                <th style={{ ...thStyle, width: '110px' }}>Posted</th>
                <SortableTh field="location" label="Location"   sortField={sortField} sortOrder={sortOrder} onClick={toggleSort} minWidth="140px" />
                <SortableTh field="outreach" label="Outreach"   sortField={sortField} sortOrder={sortOrder} onClick={toggleSort} minWidth="120px" />
                <th style={{ ...thStyle, width: '150px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(job => {
                const isSel = selected.has(job._id);
                return (
                  <tr key={job._id} style={{
                    borderBottom: '1px solid var(--color-border)',
                    background: isSel ? 'var(--color-brand-tint)' : job.qualityStatus === 'good' ? 'transparent' : 'rgba(240,106,106,0.04)',
                    transition: 'background .12s',
                  }}>
                    <td style={tdStyle}><CheckBox checked={isSel} onChange={() => toggleRow(job._id)} /></td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)' }}>{job.title}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '22px', height: '22px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-surface)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          color: 'var(--color-text-2)',
                        }}>
                          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="10" height="11" rx="0.5" /><path d="M5 5h1M5 7.5h1M5 10h1M8 5h1M8 7.5h1M8 10h1" />
                          </svg>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-brand)' }}>{job.company}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{job.industry || '—'}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>{fmtPosted(job.postedDate)}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px',
                        background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)',
                        fontSize: '11.5px', fontWeight: 500, color: 'var(--color-text-2)',
                      }}>{job.location || '—'}</span>
                    </td>
                    <td style={tdStyle}>
                      {job.outreachCount > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--color-success-text)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)' }} />
                          {job.outreachCount} sent
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => openProspects(job)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '5px 11px', background: 'var(--color-brand)', color: '#fff',
                        border: 'none', borderRadius: 'var(--radius-md)',
                        fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}>
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="5" cy="5" r="2" /><path d="M2 12c0-2 1.5-3.5 3-3.5s3 1.5 3 3.5" /><circle cx="10.5" cy="5.5" r="1.5" /><path d="M11 11c1.2.4 2 1.4 2 2.8" />
                        </svg>
                        {job.prospectCount} Prospects
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination Footer ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 20px', borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--color-text-3)' }}>
          <span>Rows:</span>
          <select value={rowsPerPage} onChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(1); }}
            style={{
              border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)',
              padding: '3px 6px', background: 'var(--color-bg)', fontSize: '12px',
              fontWeight: 700, color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)',
              outline: 'none', cursor: 'pointer',
            }}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span style={{ marginLeft: '8px', paddingLeft: '12px', borderLeft: '1px solid var(--color-border)' }}>
            {startRow}-{endRow} of {total.toLocaleString()} results
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <PageNavBtn disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} dir="left" />
          {Array.from({ length: Math.min(5, pages) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{
              width: '24px', height: '24px', borderRadius: 'var(--radius-sm)',
              border: 'none', cursor: 'pointer',
              background: page === p ? 'var(--color-brand)' : 'transparent',
              color: page === p ? '#fff' : 'var(--color-text-2)',
              fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-sans)',
            }}>{p}</button>
          ))}
          {pages > 5 && (
            <span style={{ width: '24px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '11px' }}>…</span>
          )}
          <PageNavBtn disabled={page >= pages} onClick={() => setPage(p => p + 1)} dir="right" />
        </div>
      </div>

      <ProspectsPanel
        open={panelOpen}
        onClose={closeProspects}
        job={panelJobContext}
        prospects={panelProspects}
        loading={panelLoading}
        error={panelError}
        sending={panelSending}
        runId={runId}
        emailTemplate={panelTemplate}
        onRefresh={refreshPanelProspects}
        onSendEmails={sendPanelEmails}
      />

      <HrOutreachStatusPanel
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        runId={runId}
        runName={run?.title ?? ''}
      />
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: '10.5px', fontWeight: 700,
  color: 'var(--color-text-3)',
  textTransform: 'uppercase', letterSpacing: '0.6px',
  borderBottom: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  verticalAlign: 'middle',
};

function SortableTh({
  field, label, sortField, sortOrder, onClick, minWidth,
}: {
  field: Exclude<SortField, null>; label: string;
  sortField: SortField; sortOrder: SortOrder;
  onClick: (f: Exclude<SortField, null>) => void;
  minWidth: string;
}) {
  const active = sortField === field;
  return (
    <th style={{ ...thStyle, minWidth, cursor: 'pointer' }} onClick={() => onClick(field)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label}
        {active && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--color-brand)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }}>
            <polyline points="3,7 6,4 9,7" />
          </svg>
        )}
      </div>
    </th>
  );
}

function PageNavBtn({ disabled, onClick, dir }: { disabled: boolean; onClick: () => void; dir: 'left' | 'right' }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '24px', height: '24px', border: 'none', background: 'transparent',
      borderRadius: 'var(--radius-sm)', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.3 : 1, color: 'var(--color-text-2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: dir === 'right' ? 'rotate(180deg)' : 'none' }}>
        <polyline points="7,2 3,6 7,10" />
      </svg>
    </button>
  );
}

function CheckBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span onClick={e => { e.stopPropagation(); onChange(); }} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '16px', height: '16px', borderRadius: '4px',
      border: `1.5px solid ${checked ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
      background: checked ? 'var(--color-brand)' : '#fff',
      cursor: 'pointer', flexShrink: 0,
    }}>
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,6.5 5,9.5 10,3.5" />
        </svg>
      )}
    </span>
  );
}
