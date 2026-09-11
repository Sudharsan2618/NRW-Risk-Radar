'use client';
import React, { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useCampaign } from '@/lib/campaigns';
import {
  listCampaignRuns,
  listCampaignSchedules,
  startCampaignRun,
  deleteCampaign as apiDeleteCampaign,
  updateCampaign as apiUpdateCampaign,
  deleteRun as apiDeleteRun,
  resumeRun as apiResumeRun,
  type Campaign,
  type Run,
  type Schedule,
} from '@/lib/hrApi';
import { fetchOutreachTemplates, type OutreachTemplate, fetchLinkedInTemplates, fetchLinkedInTemplateById, type LinkedInTemplate, fetchActiveUsers, type ActiveUser, fetchEmailSenders, type EmailSender, fetchDefaultTemplate } from '@/lib/leadFunnelApi';
import { type Option, MultiSelectDropdown } from './Dropdowns';
import { WeeklyPlanEditor } from './WeeklyPlanEditor';
import { AutomationSchedule } from './AutomationSchedule';
import { ActivePromptSetting } from './ActivePromptSetting';
import { TagChipInput } from './lead/TagChipInput';

const INNER_EXPANDED = 220;

const CSI = ({ d, size = 15 }: { d: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, color: 'inherit', display: 'block' }}>
    {d}
  </svg>
);

const CIC = {
  stats:    <CSI d={<><line x1="2" y1="15" x2="16" y2="15" /><rect x="4" y="9"  width="2.5" height="6" /><rect x="8" y="6"  width="2.5" height="9" /><rect x="12" y="3" width="2.5" height="12" /></>} />,
  runs:     <CSI d={<><polygon points="4,3 14,9 4,15" /></>} />,
  settings: <CSI d={<><circle cx="9" cy="9" r="2.5" /><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.6 3.6l1.5 1.5M12.9 12.9l1.5 1.5M3.6 14.4l1.5-1.5M12.9 5.1l1.5-1.5" /></>} />,
};

interface NavItem { id: 'stats' | 'runs' | 'settings'; label: string; icon: ReactNode }
const NAV: NavItem[] = [
  { id: 'stats',    label: 'Overview', icon: CIC.stats },
  { id: 'runs',     label: 'Workflow', icon: CIC.runs },
  { id: 'settings', label: 'Settings', icon: CIC.settings },
];

type RunStatusKey = 'completed' | 'active' | 'failed' | 'cancelled' | 'scheduled';
const STATUS_STYLE: Record<RunStatusKey, { bg: string; color: string; label: string; dot: string }> = {
  completed: { bg: 'var(--color-success-bg)',   color: 'var(--color-success-text)', label: 'Completed', dot: 'var(--color-success)' },
  active:    { bg: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)',   label: 'Running',   dot: 'var(--color-brand)' },
  failed:    { bg: 'var(--color-danger-bg)',    color: 'var(--color-danger-text)',  label: 'Failed',    dot: 'var(--color-danger)' },
  cancelled: { bg: 'var(--color-danger-bg)',    color: 'var(--color-danger-text)',  label: 'Cancelled', dot: 'var(--color-danger)' },
  scheduled: { bg: 'var(--color-warning-bg)',   color: 'var(--color-warning-text)', label: 'Scheduled', dot: 'var(--color-warning)' },
};
function statusStyle(status: string) {
  return STATUS_STYLE[(status as RunStatusKey)] || STATUS_STYLE.active;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FREQ_LABEL: Record<string, string> = {
  once: 'Once', daily: 'Daily', repeat: 'Repeat', weekly: 'Weekly', monthly: 'Monthly',
};

/** '18:00' → '6:00 PM'. Returns '—' for anything unparseable. */
function fmtTimeOfDay(t?: string | null): string {
  if (!t) return '—';
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${ampm}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Human-readable cadence, e.g. "Every Tue, Wed, Thu, Fri at 6:00 PM". */
function scheduleCadence(s: Schedule): string {
  const at = `at ${fmtTimeOfDay(s.timeOfDay)}`;
  switch (s.frequency) {
    case 'once':
      return s.runAt ? `Once on ${fmtDateTime(s.runAt)}` : 'Once';
    case 'daily':
      return `Every day ${at}`;
    case 'repeat': {
      const days = (s.daysOfWeek ?? []).slice().sort((a, b) => a - b).map(d => DAY_SHORT[d] ?? d).join(', ');
      return days ? `Every ${days} ${at}` : `Repeats ${at}`;
    }
    case 'weekly':
      return `Every ${DAY_FULL[s.dayOfWeek ?? 0] ?? ''} ${at}`.replace(/\s+/g, ' ').trim();
    case 'monthly':
      return s.dayOfMonth ? `Monthly on the ${ordinal(s.dayOfMonth)} ${at}` : `Monthly ${at}`;
    default:
      return at;
  }
}

/**
 * Frequency-dependent "when" row for the schedule card — replaces the raw cron.
 * repeat → selected weekdays · weekly → the weekday · monthly → the date · once → datetime.
 */
function scheduleWhen(s: Schedule): { label: string; value: string } | null {
  switch (s.frequency) {
    case 'repeat': {
      const days = (s.daysOfWeek ?? []).slice().sort((a, b) => a - b).map(d => DAY_SHORT[d] ?? d);
      return { label: 'Days', value: days.length ? days.join(', ') : '—' };
    }
    case 'weekly':
      return { label: 'Day of week', value: DAY_FULL[s.dayOfWeek ?? -1] ?? '—' };
    case 'monthly':
      return { label: 'Day of month', value: s.dayOfMonth ? ordinal(s.dayOfMonth) : '—' };
    case 'once':
      return { label: 'Runs at', value: fmtDateTime(s.runAt ?? null) };
    case 'daily':
      return { label: 'Days', value: 'Every day' };
    default:
      return null;
  }
}

function duration(run: Run): string {
  if (!run.runStartedAt) return '—';
  const start = new Date(run.runStartedAt).getTime();
  const end = run.runEndedAt ? new Date(run.runEndedAt).getTime() : (run.status === 'active' ? Date.now() : start);
  const secs = Math.max(0, Math.round((end - start) / 1000));
  if (secs < 60) return `${secs} sec`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m} min ${s} sec`;
}

// ─────────── Main component ───────────
export function CampaignDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { campaign, loading: campaignLoading, error: campaignError, reload: reloadCampaign } = useCampaign(id);
  const [activePage, setActivePage] = React.useState<NavItem['id']>('runs');

  const [runs, setRuns] = React.useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = React.useState(true);
  const [runsError, setRunsError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);

  const loadRuns = React.useCallback(async () => {
    setRunsLoading(true);
    setRunsError(null);
    try {
      setRuns(await listCampaignRuns(id));
    } catch (e) {
      setRunsError(e instanceof Error ? e.message : 'Failed to load runs');
    } finally {
      setRunsLoading(false);
    }
  }, [id]);

  React.useEffect(() => { void loadRuns(); }, [loadRuns]);

  const handleStartRun = async () => {
    if (starting || !campaign || campaign.isLegacy) return;
    setStarting(true);
    try {
      const run = await startCampaignRun(id);
      await Promise.all([loadRuns(), reloadCampaign()]);
      router.push(`/campaigns/${id}/runs/${run.id}`);
    } catch (e) {
      setRunsError(e instanceof Error ? e.message : 'Failed to start run');
    } finally {
      setStarting(false);
    }
  };

  if (campaignLoading) {
    return <CenterMsg title="Loading campaign…" />;
  }
  if (campaignError || !campaign) {
    return (
      <CenterMsg
        title={campaignError || 'Campaign not found'}
        action={{ label: 'Go to dashboard', onClick: () => router.push('/dashboard') }}
      />
    );
  }

  const openRun = (runId: string) => router.push(`/campaigns/${id}/runs/${runId}`);
  const isLegacy = campaign.isLegacy;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* ── Top header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '10px 20px',
        borderBottom: '1px solid var(--color-border)', gap: '10px', flexShrink: 0,
        background: 'var(--color-bg)',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>{campaign.name}</span>
            <span style={{
              fontSize: '11.5px', fontWeight: 600,
              color: campaign.status === 'paused' ? 'var(--color-warning-text)' : 'var(--color-success-text)',
              background: campaign.status === 'paused' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
              padding: '3px 10px', borderRadius: 'var(--radius-full)', textTransform: 'capitalize',
            }}>{campaign.status}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginTop: '2px' }}>
            {targetingSummary(campaign)}
          </div>
        </div>
        {!isLegacy && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button style={primaryBtn} onClick={handleStartRun} disabled={starting}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3,2 12,7 3,12" />
              </svg>
              {starting ? 'Starting…' : 'Start New Run'}
            </button>
          </div>
        )}
      </div>

      {/* ── Inner split ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <nav style={{
          width: `${INNER_EXPANDED}px`, minWidth: `${INNER_EXPANDED}px`,
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-bg)', overflowY: 'auto', overflowX: 'hidden',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          <div style={{ padding: '14px 0 16px' }}>
            {NAV.filter(n => !(isLegacy && n.id === 'settings')).map(item => {
              const active = activePage === item.id;
              return (
                <div key={item.id} onClick={() => setActivePage(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '7px 14px', margin: '1px 8px',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    fontSize: '13.5px', fontWeight: active ? 600 : 500,
                    color: active ? 'var(--color-brand)' : 'var(--color-text-1)',
                    background: active ? 'var(--color-brand-tint)' : 'transparent',
                    transition: 'background .12s, color .12s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--color-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ color: active ? 'var(--color-brand)' : 'var(--color-text-2)', display: 'flex' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </div>
              );
            })}
          </div>
        </nav>

        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-row-hover)' }}>
          {activePage === 'stats'    && <StatsPage    campaign={campaign} runs={runs} />}
          {activePage === 'runs'     && <RunsPage     runs={runs} loading={runsLoading} error={runsError} onOpen={openRun} onReload={loadRuns} />}
          {activePage === 'settings' && !isLegacy && <SettingsPage campaign={campaign} reloadCampaign={reloadCampaign} onDeleted={() => router.push('/dashboard')} />}
        </div>
      </div>
    </div>
  );
}

function targetingSummary(c: Campaign): string {
  const titles = c.runConfig?.searchTitles ?? [];
  const locs = c.runConfig?.searchLocations ?? [];
  if (c.isLegacy) return 'All historical runs in one place.';
  const t = titles.slice(0, 3).join(', ') + (titles.length > 3 ? '…' : '');
  return [t, locs.join(', ')].filter(Boolean).join(' · ') || 'No targeting configured';
}

function CenterMsg({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', padding: '40px' }}>
      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-1)' }}>{title}</div>
      {action && (
        <button onClick={action.onClick} style={{
          padding: '6px 14px', background: 'var(--color-brand)', color: '#fff', border: 'none',
          borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>{action.label}</button>
      )}
    </div>
  );
}

// ─────────── Runs page ───────────
function RunsPage({ runs, loading, error, onOpen, onReload }: {
  runs: Run[]; loading: boolean; error: string | null;
  onOpen: (runId: string) => void; onReload: () => void;
}) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [resumingId, setResumingId] = React.useState<string | null>(null);
  const [resumeNote, setResumeNote] = React.useState<string | null>(null);

  // Only these two states are resumable — the API rejects anything else with a 400,
  // so offering the button elsewhere would just produce an error.
  const canResume = (run: Run) => run.status === 'cancelled' || run.status === 'failed';

  const handleResumeRun = async (e: React.MouseEvent, run: Run) => {
    e.stopPropagation(); // don't open the run
    if (resumingId || deletingId) return;
    // Say plainly what will happen, because it differs per run: one that never
    // persisted anything starts over, one that died late picks up where it stopped.
    const scraped = run.stats?.totalJobsScraped ?? 0;
    if (!window.confirm(
      `Resume "${run.title || 'Untitled run'}"?\n\n` +
      (scraped > 0
        ? `Job scraping is already done (${scraped.toLocaleString()} scraped) — this continues from company extraction onward.`
        : `Nothing was saved before this run stopped, so it starts again from job scraping. This can take a while.`)
    )) return;
    setResumingId(run.id);
    setResumeNote(null);
    setDeleteError(null);
    try {
      await apiResumeRun(run.id);
      // The work runs in the background, so the run flips to `active` and its
      // counters fill in over the following minutes rather than on this reload.
      setResumeNote(`"${run.title || 'Untitled run'}" is resuming in the background. Refresh to follow progress.`);
      await onReload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to resume run');
    } finally {
      setResumingId(null);
    }
  };

  const handleDeleteRun = async (e: React.MouseEvent, run: Run) => {
    e.stopPropagation(); // don't open the run
    if (deletingId) return;
    if (!window.confirm(
      `Delete run "${run.title || 'Untitled run'}"?\n\n` +
      `This permanently removes the run and all of its jobs, prospects, and outreach records. This cannot be undone.`
    )) return;
    setDeletingId(run.id);
    setDeleteError(null);
    try {
      await apiDeleteRun(run.id);
      await onReload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete run');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ padding: '24px 28px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>Runs</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '2px' }}>All runs executed for this campaign.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onReload} style={secondaryBtn}>Refresh</button>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{runs.length}</span> total runs
          </div>
        </div>
      </div>

      {(error || deleteError) && (
        <div style={{ ...emptyCard, borderColor: 'var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
          {error || deleteError}
        </div>
      )}

      {resumeNote && (
        <div style={{ ...emptyCard, borderColor: 'var(--color-brand)', color: 'var(--color-text-2)', fontSize: '13px' }}>
          {resumeNote}
        </div>
      )}

      {loading ? (
        <div style={emptyCard}><div style={{ fontSize: '13px', color: 'var(--color-text-2)' }}>Loading runs…</div></div>
      ) : runs.length === 0 && !error ? (
        <div style={emptyCard}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>No runs yet</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-2)' }}>Click <strong>Start New Run</strong> above to kick off your first lead-generation run.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {runs.map(run => {
            const s = statusStyle(run.status);
            return (
              <div key={run.id} onClick={() => onOpen(run.id)} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 110px 110px 92px 32px 20px',
                gap: '16px', alignItems: 'center',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 18px', cursor: 'pointer',
                transition: 'border-color .12s, box-shadow .12s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand-tint)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '420px' }}>
                      {run.title || 'Untitled run'}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '10.5px', fontWeight: 700,
                      padding: '2px 8px', borderRadius: 'var(--radius-full)',
                      background: s.bg, color: s.color,
                      textTransform: 'uppercase', letterSpacing: '0.4px',
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot }} />
                      {s.label}
                    </span>
                    <span style={{
                      fontSize: '10.5px', fontWeight: 700,
                      padding: '2px 8px', borderRadius: 'var(--radius-full)',
                      textTransform: 'uppercase', letterSpacing: '0.4px',
                      background: run.scheduledFromId ? 'var(--color-brand-subtle)' : 'var(--color-surface)',
                      color: run.scheduledFromId ? 'var(--color-brand-text)' : 'var(--color-text-2)',
                    }}>
                      {run.scheduledFromId ? 'Automated' : 'Manual'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>
                    Started {fmtDateTime(run.runStartedAt)} · {duration(run)}
                    {run.reportUrl && (
                      <>
                        {' · '}
                        <a href={run.reportUrl} target="_blank" rel="noopener noreferrer"
                           onClick={e => e.stopPropagation()}
                           style={{ color: 'var(--color-brand-text)', fontWeight: 700, textDecoration: 'none' }}>
                          View report ↗
                        </a>
                      </>
                    )}
                  </div>
                </div>
                {/* The run's OUTCOME, not its scrape volume. `totalJobsScraped`
                    counts every posting pulled including duplicates, so a run that
                    produced 8 workable jobs was reporting 2,564. The scraped figure
                    stays as sub-text — useful context, wrong headline. */}
                <Stat label="Jobs"
                      value={(run.stats?.qualifiedJobs ?? 0).toLocaleString()}
                      sub={run.stats?.totalJobsScraped
                        ? `of ${run.stats.totalJobsScraped.toLocaleString()} scraped`
                        : undefined} />
                <Stat label="Prospects" value={(run.stats?.totalProspects ?? 0).toLocaleString()} />
                {/* Resume sits next to Delete rather than inside the run, so a
                    stalled run can be restarted from the list where it is noticed.
                    The cell is always rendered so the grid columns stay aligned
                    across rows whether or not a run is resumable. */}
                {canResume(run) ? (
                  <button
                    onClick={e => handleResumeRun(e, run)}
                    disabled={resumingId === run.id || !!deletingId}
                    title={`Resume this ${run.status} run from where it stopped`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '5px 10px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-brand)',
                      background: 'transparent', color: 'var(--color-brand-text)',
                      fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap',
                      cursor: resumingId === run.id ? 'wait' : 'pointer',
                      opacity: resumingId === run.id ? 0.6 : 1,
                      fontFamily: 'var(--font-sans)',
                    }}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                      <polygon points="3,2 10,6 3,10" />
                    </svg>
                    {resumingId === run.id ? 'Resuming…' : 'Resume'}
                  </button>
                ) : <span />}
                <button
                  onClick={e => handleDeleteRun(e, run)}
                  disabled={deletingId === run.id}
                  title="Delete run"
                  style={{
                    width: '28px', height: '28px', border: 'none', background: 'transparent',
                    borderRadius: 'var(--radius-md)', cursor: deletingId === run.id ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-3)', padding: 0,
                    opacity: deletingId === run.id ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (deletingId !== run.id) { e.currentTarget.style.background = 'var(--color-danger-bg)'; e.currentTarget.style.color = 'var(--color-danger-text)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-3)'; }}
                >
                  <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3,4.5 15,4.5" />
                    <path d="M6 4.5V3.2c0-.5.4-.9.9-.9h4.2c.5 0 .9.4.9.9V4.5" />
                    <path d="M4.5 4.5l.8 10.1c0 .6.5 1.1 1.1 1.1h5.2c.6 0 1.1-.5 1.1-1.1l.8-10.1" />
                    <line x1="7.5" y1="7.5" x2="7.5" y2="12.5" /><line x1="10.5" y1="7.5" x2="10.5" y2="12.5" />
                  </svg>
                </button>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--color-text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="5,2 10,7 5,12" />
                </svg>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────── Stats page ───────────
function StatsPage({ campaign, runs }: { campaign: Campaign; runs: Run[] }) {
  const st = campaign.stats;
  const completed = runs.filter(r => r.status === 'completed').length;
  const failed = runs.filter(r => r.status === 'failed' || r.status === 'cancelled').length;
  const successRate = runs.length > 0 ? Math.round((completed / runs.length) * 100) : 0;

  return (
    <div style={{ padding: '24px 28px 40px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>Stats</div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '2px' }}>Aggregated performance across all runs for {campaign.name}.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <KpiCard label="Total runs"      value={st.totalRuns.toString()}              sub={`${completed} completed`} />
        <KpiCard label="Jobs discovered" value={st.totalJobsScraped.toLocaleString()} sub="across all runs" />
        <KpiCard label="Prospects"       value={st.totalProspects.toLocaleString()}   sub="qualified leads" />
        <KpiCard label="Emails sent"     value={st.totalEmailsSent.toLocaleString()}  sub={`${st.activeRuns} active`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
        <div style={card}>
          <SectionHeader title="Activity" subtitle="Prospects discovered per run" />
          <SparkBar data={runs.slice().reverse().map(r => r.stats?.totalProspects ?? 0)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: 'var(--color-text-3)' }}>
            <span>Older</span><span>Latest</span>
          </div>
        </div>
        <div style={card}>
          <SectionHeader title="Success rate" subtitle="Run completion" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <RingChart percent={successRate} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-2)', marginBottom: '2px' }}>
                {completed} of {runs.length} runs completed
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                {failed} failed/cancelled · {campaign.stats.activeRuns} running
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-text-1)', marginTop: '6px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '6px' }}>{sub}</div>
    </div>
  );
}

function SparkBar({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  if (data.length === 0) {
    return <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--color-text-3)' }}>No runs yet</div>;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px' }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: `${(v / max) * 100}%`,
          background: 'var(--color-brand)',
          opacity: 0.6 + (i / Math.max(1, data.length)) * 0.4,
          borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
          minHeight: '4px',
        }} title={`${v} prospects`} />
      ))}
    </div>
  );
}

function RingChart({ percent }: { percent: number }) {
  const dash = `${Math.max(0, Math.min(100, percent))}, 100`;
  return (
    <svg width="80" height="80" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
      <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none" stroke="var(--color-border)" strokeWidth="3.5" />
      <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none" stroke="var(--color-brand)" strokeWidth="3.5"
        strokeDasharray={dash} strokeLinecap="round" />
      <text x="18" y="20" textAnchor="middle"
        transform="rotate(90 18 18)"
        fontSize="9" fontWeight="800" fill="var(--color-text-1)" fontFamily="var(--font-sans)">
        {percent}%
      </text>
    </svg>
  );
}

// ─────────── Settings page ───────────

function SettingsPage({ campaign, reloadCampaign, onDeleted }: { campaign: Campaign; reloadCampaign?: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>(campaign.status || 'active');
  const [savingStatus, setSavingStatus] = React.useState(false);
  const [autoFC, setAutoFC] = React.useState<boolean>(!!campaign.autoFirstContact);
  const [savingAutoFC, setSavingAutoFC] = React.useState(false);
  // Automation schedule (time + zone) — mirrors the import campaign's "Runs at"
  // control. Persisted via PATCH so the daily automation tick picks it up.
  const DEFAULT_AUTOMATION_TZ = 'Europe/Berlin';
  const DEFAULT_AUTOMATION_TIME = '15:00';
  const [schedule, setSchedule] = React.useState({
    timezone: campaign.automationTimezone || DEFAULT_AUTOMATION_TZ,
    time: campaign.automationTime || DEFAULT_AUTOMATION_TIME,
  });
  const [savingSchedule, setSavingSchedule] = React.useState(false);
  const onChangeSchedule = async (next: { timezone: string; time: string }) => {
    setSchedule(next);
    setSavingSchedule(true);
    setErr(null);
    try {
      await apiUpdateCampaign(campaign.id, {
        automationTimezone: next.timezone,
        automationTime: next.time,
      });
    } catch {
      setErr('Could not update automation schedule');
      setSchedule({
        timezone: campaign.automationTimezone || DEFAULT_AUTOMATION_TZ,
        time: campaign.automationTime || DEFAULT_AUTOMATION_TIME,
      });
    } finally {
      setSavingSchedule(false);
    }
  };
  // Kept in sync from the weekly plan (Monday's email cell is the daily goal) so
  // any future reader of the campaign's goal sees the saved value, not a stale one.
  const [, setGoal] = React.useState(campaign.dailyEmailGoal ?? 3);
  const savedGoalRef = React.useRef(campaign.dailyEmailGoal ?? 3);
  const cfg = campaign.runConfig;

  // ── Campaign details ──
  // One "Edit Details" mode over name, sender, ownership and pinned templates —
  // the same shape as the import campaign's Settings, so the two screens behave
  // identically. Previously each of these auto-saved on every keystroke/toggle in
  // its own card, which meant no way to review a set of changes before committing
  // them and no way to back out of a mistake.
  const [isEditing, setIsEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [templates, setTemplates] = React.useState<OutreachTemplate[]>([]);
  const [linkedinTemplates, setLinkedinTemplates] = React.useState<LinkedInTemplate[]>([]);
  const [activeUsers, setActiveUsers] = React.useState<ActiveUser[]>([]);
  const [emailSenders, setEmailSenders] = React.useState<EmailSender[]>([]);
  // The editor's own default email template — pre-seeded as the first default
  // when a campaign has none configured, so it lands on top and others are added.
  const [userDefaultTemplateId, setUserDefaultTemplateId] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchOutreachTemplates().then(d => setTemplates(d.templates || [])).catch(() => {});
    fetchDefaultTemplate().then(r => setUserDefaultTemplateId(r.defaultTemplateId)).catch(() => {});
    // All LinkedIn templates, not just follow-ups: filtering left the picker empty
    // for users who only have invite templates.
    fetchLinkedInTemplates().then(d => setLinkedinTemplates(d.templates || [])).catch(() => {});
    fetchActiveUsers().then(setActiveUsers).catch(() => {});
    fetchEmailSenders().then(d => setEmailSenders(d.senders || [])).catch(() => {});
  }, []);

  // Draft state — only read back from the campaign when an edit starts, so a
  // background reload can't overwrite what is being typed.
  const [editName, setEditName] = React.useState(campaign.name || '');
  const [editSenderEmail, setEditSenderEmail] = React.useState(campaign.senderEmail || '');
  const [editForwardEmail, setEditForwardEmail] = React.useState(campaign.forwardToEmail || '');
  // Fixed CC list copied on every outreach email (multi-value).
  const [editCcEmails, setEditCcEmails] = React.useState<string[]>(campaign.ccEmails || []);
  const [editOwners, setEditOwners] = React.useState<string[]>(campaign.owners || []);
  const [editCollaborators, setEditCollaborators] = React.useState<string[]>(campaign.collaborators || []);
  const [editTemplateIds, setEditTemplateIds] = React.useState<string[]>(campaign.defaultTemplateIds || []);
  const [editLinkedinInviteTemplateIds, setEditLinkedinInviteTemplateIds] = React.useState<string[]>(campaign.defaultLinkedinInviteTemplateIds || []);
  const [editLinkedinTemplateIds, setEditLinkedinTemplateIds] = React.useState<string[]>(campaign.defaultLinkedinTemplateIds || []);

  const startEdit = () => {
    setEditName(campaign.name || '');
    setEditSenderEmail(campaign.senderEmail || '');
    setEditForwardEmail(campaign.forwardToEmail || '');
    setEditCcEmails(campaign.ccEmails || []);
    setEditOwners(campaign.owners || []);
    setEditCollaborators(campaign.collaborators || []);
    // A campaign with no configured templates is seeded with the user's default
    // (when they have one and it still exists), so it appears as the first default
    // and they can add other templates on top before saving.
    const configured = campaign.defaultTemplateIds || [];
    const seeded = configured.length === 0 && userDefaultTemplateId && templates.some(t => t._id === userDefaultTemplateId)
      ? [userDefaultTemplateId]
      : configured;
    setEditTemplateIds(seeded);
    setEditLinkedinInviteTemplateIds(campaign.defaultLinkedinInviteTemplateIds || []);
    setEditLinkedinTemplateIds(campaign.defaultLinkedinTemplateIds || []);
    setErr(null);
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (campaign.isLegacy || saving) return;
    if (!editName.trim()) { setErr('A campaign needs a name'); return; }
    // With no owner the campaign's tasks reach nobody and the daily rollover skips
    // it, so the server rejects this too — caught here to keep the edit open.
    if (editOwners.length === 0) { setErr('A campaign needs at least one owner'); return; }
    setSaving(true); setErr(null);
    try {
      await apiUpdateCampaign(campaign.id, {
        name: editName.trim(),
        senderEmail: editSenderEmail,
        senderEngine: emailSenders.find(s => s.email === editSenderEmail)?.engine,
        forwardToEmail: editForwardEmail.trim(),
        ccEmails: editCcEmails,
        owners: editOwners,
        // An owner can never also be a collaborator.
        collaborators: editCollaborators.filter(x => !editOwners.includes(x)),
        defaultTemplateIds: editTemplateIds,
        defaultLinkedinInviteTemplateIds: editLinkedinInviteTemplateIds,
        defaultLinkedinTemplateIds: editLinkedinTemplateIds,
      });
      reloadCampaign?.();
      setIsEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the campaign details');
    } finally { setSaving(false); }
  };

  // Display helpers for read mode.
  const userName = (id: string) => activeUsers.find(u => u.id === id)?.full_name || activeUsers.find(u => u.id === id)?.email || id;
  const namesOf = (ids?: string[] | null) => (ids && ids.length ? ids.map(userName).join(', ') : 'None');
  const templateName = (id: string) => {
    const t = templates.find(x => x._id === id);
    return t ? (t.name || `${t.industry} · ${t.persona}`) : id;
  };
  const linkedinTemplateName = (id: string) => linkedinTemplates.find(x => x._id === id)?.name || 'Untitled template';

  // A campaign's default LinkedIn templates may have been pinned by another user,
  // so they aren't always in the caller's scoped list. Fetch any missing ones by
  // id so the read-only rows show real names instead of "Untitled template".
  React.useEffect(() => {
    const ids = [
      ...(campaign.defaultLinkedinTemplateIds || []),
      ...(campaign.defaultLinkedinInviteTemplateIds || []),
    ];
    const missing = ids.filter(id => !linkedinTemplates.some(t => t._id === id));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map(id =>
        fetchLinkedInTemplateById(id).then(d => d.template).catch(() => null),
      ),
    ).then(templates => {
      if (cancelled) return;
      const valid = templates.filter(Boolean) as LinkedInTemplate[];
      if (valid.length === 0) return;
      setLinkedinTemplates(prev => {
        const have = new Set(prev.map(t => t._id));
        return [...prev, ...valid.filter(t => !have.has(t._id))];
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign, linkedinTemplates]);

  // Weekly plan — shared source of truth with Weekly Goals + My Tasks.
  const [planSeed, setPlanSeed] = React.useState(campaign.weeklyPlan);
  const [savingPlan, setSavingPlan] = React.useState(false);
  const saveWeeklyPlan = async (plan: { email: number[]; linkedin: number[]; calls: number[] }) => {
    setSavingPlan(true); setErr(null);
    try {
      const c = await apiUpdateCampaign(campaign.id, { weeklyPlan: plan });
      setPlanSeed(c.weeklyPlan ?? plan);
      // Keep the daily-goal field in sync with Monday's email value (server does this too).
      savedGoalRef.current = c.dailyEmailGoal ?? plan.email[0];
      setGoal(savedGoalRef.current);
    } finally { setSavingPlan(false); }
  };

  const chip = (text: string, key: string | number) => (
    <span key={key} style={{
      display: 'inline-flex', padding: '4px 10px', borderRadius: 'var(--radius-full)',
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      fontSize: '12px', fontWeight: 600, color: 'var(--color-text-2)',
    }}>{text}</span>
  );

  const isActive = status === 'active';
  const toggleStatus = async () => {
    if (savingStatus || campaign.isLegacy) return;
    const next = isActive ? 'paused' : 'active';
    setStatus(next); setSavingStatus(true); setErr(null);
    try {
      await apiUpdateCampaign(campaign.id, { status: next });
    } catch {
      setErr('Could not update campaign status');
      setStatus(isActive ? 'active' : 'paused');
    } finally { setSavingStatus(false); }
  };

  const toggleAutoFC = async () => {
    if (savingAutoFC || campaign.isLegacy) return;
    const next = !autoFC;
    setAutoFC(next); setSavingAutoFC(true); setErr(null);
    try {
      await apiUpdateCampaign(campaign.id, { autoFirstContact: next });
    } catch {
      setErr('Could not update automated first contact');
      setAutoFC(!next);
    } finally { setSavingAutoFC(false); }
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (!window.confirm(`Delete campaign "${campaign.name}"?\n\nThis permanently deletes the campaign and all its runs, prospects, and outreach. This cannot be undone.`)) return;
    setDeleting(true);
    setErr(null);
    try {
      await apiDeleteCampaign(campaign.id, true);
      onDeleted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete campaign');
      setDeleting(false);
    }
  };

  return (
    <div style={{ padding: '24px 28px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>Settings</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '2px' }}>Campaign configuration and lifecycle.</div>
        </div>
        <div>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setIsEditing(false); setErr(null); }} disabled={saving} style={editCancelBtn}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={editSaveBtn}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          ) : (
            <button onClick={startEdit} disabled={campaign.isLegacy} style={{ ...editCancelBtn, opacity: campaign.isLegacy ? 0.5 : 1, cursor: campaign.isLegacy ? 'not-allowed' : 'pointer' }}>Edit Details</button>
          )}
        </div>
      </div>

      <div style={card}>
        <SectionHeader title="Status" />
        <FieldRow label="Campaign status" hint="Active campaigns feed My Tasks. Pausing hides this campaign's companies from every My Tasks tab (they return when reactivated).">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: isActive ? 'var(--color-success-text)' : 'var(--color-text-3)' }}>
              {savingStatus ? 'Saving…' : isActive ? 'Active' : 'Paused'}
            </span>
            <button type="button" role="switch" aria-checked={isActive} onClick={toggleStatus} disabled={savingStatus || campaign.isLegacy}
              title={isActive ? 'Click to pause (removes from My Tasks)' : 'Click to activate'}
              style={{ width: 42, height: 24, borderRadius: 999, border: 'none', padding: 0, position: 'relative', flexShrink: 0,
                background: isActive ? 'var(--color-brand)' : 'var(--color-border-2)', cursor: (savingStatus || campaign.isLegacy) ? 'not-allowed' : 'pointer', opacity: (savingStatus || campaign.isLegacy) ? 0.6 : 1, transition: 'background .15s' }}>
              <span style={{ position: 'absolute', top: 3, left: isActive ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
            </button>
          </div>
        </FieldRow>
      </div>

      <div style={{ ...card, marginTop: '12px' }}>
        <SectionHeader title="Automation" />
        <FieldRow label="Fully automated first contact" hint="When on, this campaign's daily first-contact worklist is sent automatically each morning — emails always, plus LinkedIn invites for members who've connected LinkedIn (email-only otherwise). Default off.">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: autoFC ? 'var(--color-success-text)' : 'var(--color-text-3)' }}>
              {savingAutoFC ? 'Saving…' : autoFC ? 'On' : 'Off'}
            </span>
            <button type="button" role="switch" aria-checked={autoFC} onClick={toggleAutoFC} disabled={savingAutoFC || campaign.isLegacy}
              title={autoFC ? 'Click to turn off automated first contact' : 'Click to automate first contact daily'}
              style={{ width: 42, height: 24, borderRadius: 999, border: 'none', padding: 0, position: 'relative', flexShrink: 0,
                background: autoFC ? 'var(--color-brand)' : 'var(--color-border-2)', cursor: (savingAutoFC || campaign.isLegacy) ? 'not-allowed' : 'pointer', opacity: (savingAutoFC || campaign.isLegacy) ? 0.6 : 1, transition: 'background .15s' }}>
              <span style={{ position: 'absolute', top: 3, left: autoFC ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
            </button>
          </div>
        </FieldRow>
        <FieldRow label="Runs at" hint="Local to the zone you pick, so it stays put across daylight saving — only the UTC instant moves. This is when the campaign's work-day rolls over and when automated first contact fires.">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', width: '100%' }}>
            <AutomationSchedule
              timezone={schedule.timezone}
              time={schedule.time}
              plan={campaign.weeklyPlan}
              editable={!campaign.isLegacy}
              saving={savingSchedule}
              onChange={onChangeSchedule}
            />
          </div>
        </FieldRow>
      </div>

      {/* Campaign Details — one card, one edit mode, same field order as the
          import campaign's Settings so the two screens read identically. */}
      <div style={{ ...card, marginTop: '12px' }}>
        <SectionHeader title="Campaign Details" />
        {isEditing ? (
          <>
            <FieldRow label="Campaign Name">
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={editInput} />
            </FieldRow>
            <FieldRow label="Email Sender" hint="The mailbox this campaign's outreach is sent from — manual sends and automated first contact alike. Leave on the default to keep using the standard search-campaign mailbox.">
              {emailSenders.length === 0 ? (
                <span style={emptyText}>No sender mailboxes configured.</span>
              ) : (
                <select value={editSenderEmail} onChange={e => setEditSenderEmail(e.target.value)} style={editSelect}>
                  <option value="">Default search-campaign mailbox</option>
                  {emailSenders.map(s => (
                    <option key={s.id} value={s.email}>{s.email}{s.name ? ` (${s.name})` : ''}</option>
                  ))}
                </select>
              )}
            </FieldRow>
            <FieldRow label="Forward Replies To" hint="When a prospect replies, a copy is forwarded (in the same thread, from this campaign's sending mailbox) to this address so you see it in your own inbox. Leave empty to turn forwarding off. This is a notification copy — replying to it does NOT reach the prospect.">
              <input
                type="email"
                value={editForwardEmail}
                onChange={e => setEditForwardEmail(e.target.value)}
                placeholder="e.g. you@company.com — empty = off"
                style={editInput}
              />
            </FieldRow>
            <FieldRow label="CC on Every Email" hint="Addresses added as CC on every outreach email this campaign sends. Type an address and press Enter or comma to add; click × to remove. Leave empty for no CC.">
              <div style={{ width: '100%', maxWidth: '300px' }}>
                <TagChipInput
                  tags={editCcEmails}
                  onAdd={t => setEditCcEmails(p => [...p, t])}
                  onRemove={t => setEditCcEmails(p => p.filter(x => x !== t))}
                  placeholder="e.g. team@company.com"
                />
              </div>
            </FieldRow>
            <FieldRow label="Owners" hint="Who runs this campaign — they get My Tasks, Weekly Goals and automated first contact. Several owners share one worklist and one daily send budget, so adding an owner spreads the work rather than doubling what the campaign sends. At least one is required.">
              <div style={{ width: '100%', maxWidth: '300px' }}>
                <MultiSelectDropdown
                  options={activeUsers.map(u => ({ id: u.id, name: u.full_name || u.email, selected: editOwners.includes(u.id) }))}
                  onToggle={id => {
                    setEditOwners(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                    // An owner can't also be a collaborator.
                    setEditCollaborators(prev => prev.filter(x => x !== id));
                  }}
                  placeholder="Add owners…"
                  searchPlaceholder="Search users"
                />
              </div>
            </FieldRow>
            <FieldRow label="Collaborators" hint="Can view the campaign and manage its settings, and send manually — but get NO My Tasks, Weekly Goals or automation.">
              <div style={{ width: '100%', maxWidth: '300px' }}>
                <MultiSelectDropdown
                  options={activeUsers.filter(u => !editOwners.includes(u.id)).map(u => ({ id: u.id, name: u.full_name || u.email, selected: editCollaborators.includes(u.id) }))}
                  onToggle={id => setEditCollaborators(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  placeholder="Add collaborators…"
                  searchPlaceholder="Search users"
                />
              </div>
            </FieldRow>
            <FieldRow label="Default Templates" hint="Outreach templates offered when contacting prospects. The first selected is used for automated first contact. Leave empty to offer all your templates.">
              <div style={{ width: '100%', maxWidth: '300px' }}>
                {templates.length === 0 ? (
                  <span style={emptyText}>No outreach templates found.</span>
                ) : (
                  <MultiSelectDropdown
                    options={templates.map(t => ({ id: t._id, name: t.name || `${t.industry} · ${t.persona}`, selected: editTemplateIds.includes(t._id) }))}
                    onToggle={id => setEditTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                    placeholder="All templates (no default)…"
                    searchPlaceholder="Search templates"
                  />
                )}
              </div>
            </FieldRow>
            <FieldRow label="Default LinkedIn Invite Template" hint="Template used for automated LinkedIn invites and pre-filled invite notes. The first selected is the default.">
              <div style={{ width: '100%', maxWidth: '300px' }}>
                {linkedinTemplates.filter(t => t.category === 'invite' || !t.category).length === 0 ? (
                  <span style={emptyText}>No LinkedIn invite templates yet. Create one in the LinkedIn Composer.</span>
                ) : (
                  <MultiSelectDropdown
                    options={linkedinTemplates.filter(t => t.category === 'invite' || !t.category).map(t => ({ id: t._id, name: t.name || 'Untitled template', selected: editLinkedinInviteTemplateIds.includes(t._id) }))}
                    onToggle={id => setEditLinkedinInviteTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                    placeholder="No campaign invite template…"
                    searchPlaceholder="Search invite templates"
                  />
                )}
              </div>
            </FieldRow>
            <FieldRow label="Default LinkedIn Follow-up Template" hint="Template pre-filled when messaging a prospect who accepted your invite. If none is set, write the message yourself in My Tasks.">
              <div style={{ width: '100%', maxWidth: '300px' }}>
                {linkedinTemplates.filter(t => t.category === 'follow-up').length === 0 ? (
                  <span style={emptyText}>No LinkedIn follow-up templates yet. Create one in the LinkedIn Composer.</span>
                ) : (
                  <MultiSelectDropdown
                    options={linkedinTemplates.filter(t => t.category === 'follow-up').map(t => ({ id: t._id, name: t.name || 'Untitled template', selected: editLinkedinTemplateIds.includes(t._id) }))}
                    onToggle={id => setEditLinkedinTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                    placeholder="Use my newest LinkedIn template…"
                    searchPlaceholder="Search LinkedIn templates"
                  />
                )}
              </div>
            </FieldRow>
          </>
        ) : (
          <>
            <FieldRow label="Campaign Name"><strong style={fieldVal}>{campaign.name || '—'}</strong></FieldRow>
            <FieldRow label="Email Sender" hint="The mailbox this campaign's outreach is sent from (manual and automated).">
              <strong style={fieldVal}>{campaign.senderEmail || 'Default search-campaign mailbox'}</strong>
            </FieldRow>
            <FieldRow label="Forward Replies To" hint="Prospect replies are notification-forwarded (in-thread, from the sending mailbox) to this address. Empty = off.">
              <strong style={fieldVal}>{campaign.forwardToEmail || 'Not set'}</strong>
            </FieldRow>
            <FieldRow label="CC on Every Email" hint="Addresses CC'd on every outreach email this campaign sends. Empty = no CC.">
              <strong style={fieldVal}>{campaign.ccEmails && campaign.ccEmails.length > 0 ? campaign.ccEmails.join(', ') : 'Not set'}</strong>
            </FieldRow>
            <FieldRow label="Owners" hint="Who runs this campaign (My Tasks, Weekly Goals, automation).">
              <strong style={fieldVal}>{namesOf(campaign.owners)}</strong>
            </FieldRow>
            <FieldRow label="Collaborators" hint="Can view the campaign and send manually, but get no My Tasks, Weekly Goals or automation.">
              <strong style={fieldVal}>{namesOf(campaign.collaborators)}</strong>
            </FieldRow>
            <FieldRow label="Default Templates" hint="Templates offered in the outreach panel. All templates are offered when none are set.">
              <strong style={fieldVal}>
                {campaign.defaultTemplateIds && campaign.defaultTemplateIds.length > 0
                  ? campaign.defaultTemplateIds.map(templateName).join(', ')
                  : 'All templates'}
              </strong>
            </FieldRow>
              <FieldRow label="Default LinkedIn Invite Template" hint="Template used for automated LinkedIn invites and invite notes.">
                <strong style={fieldVal}>{campaign.defaultLinkedinInviteTemplateIds?.length ? campaign.defaultLinkedinInviteTemplateIds.map(linkedinTemplateName).join(', ') : 'Not set'}</strong>
              </FieldRow>
              <FieldRow label="Default LinkedIn Follow-up Template" hint="Template pre-filled after a prospect accepts your invite.">
              <strong style={fieldVal}>
                {campaign.defaultLinkedinTemplateIds && campaign.defaultLinkedinTemplateIds.length > 0
                  ? campaign.defaultLinkedinTemplateIds.map(linkedinTemplateName).join(', ')
                  : 'Not set — write in My Tasks'}
              </strong>
            </FieldRow>
          </>
        )}
      </div>

      <div style={{ ...card, marginTop: '12px' }}>
        <SectionHeader title="ICP Selection Prompt" subtitle="The active prospect-selection instructions used by this campaign." />
        <FieldRow label="Active prompt" hint="Prompt versions are managed in Outreach Hub → ICP Selection.">
          <ActivePromptSetting campaignId={campaign.id} campaignName={campaign.name} source="hr" />
        </FieldRow>
      </div>

      <div style={{ ...card, marginTop: '12px' }}>
        <SectionHeader title="Targeting" />
        <FieldRow label="Industries">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
            {(cfg?.targetIndustries ?? []).length > 0 ? cfg!.targetIndustries.map((x, i) => chip(x, i)) : <span style={emptyText}>None</span>}
          </div>
        </FieldRow>
        <FieldRow label="Search titles">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
            {(cfg?.searchTitles ?? []).length > 0 ? cfg!.searchTitles.map((x, i) => chip(x, i)) : <span style={emptyText}>None</span>}
          </div>
        </FieldRow>
        <FieldRow label="Locations">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>
            {(cfg?.searchLocations ?? []).length > 0 ? cfg!.searchLocations.map((x, i) => chip(x, i)) : <span style={emptyText}>None</span>}
          </div>
        </FieldRow>
      </div>

      {/* The standalone "Daily email goal" stepper that used to sit here is gone:
          it edited the same number as the Weekly plan's Monday email cell (the
          server syncs dailyEmailGoal to Monday on every plan save), so the screen
          showed one value in two places and the second one to be edited won.
          The Weekly plan below is the single control. */}
      {!campaign.isLegacy && (
        <div style={{ ...card, marginTop: '12px' }}>
          <SectionHeader title="Weekly plan" />
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', margin: '0 0 14px', maxWidth: 480, lineHeight: 1.45 }}>
            Per-day commitment per channel. Editing Monday fills the week; change any single day to customise it. This drives My Tasks and the Weekly Goals screen.
          </div>
          <WeeklyPlanEditor initialPlan={planSeed} onSave={saveWeeklyPlan} saving={savingPlan} />
        </div>
      )}

      <div style={{ ...card, marginTop: '12px' }}>
        <SectionHeader title="Pipeline" />
        <FieldRow label="Results per search"><strong style={fieldVal}>{cfg?.resultsPerSearch ?? '—'}</strong></FieldRow>
        <FieldRow label="Max posting age">  <strong style={fieldVal}>{cfg?.hoursOld ?? '—'} hrs</strong></FieldRow>
        <FieldRow label="Job type">         <strong style={fieldVal}>{campaign.jobType || '—'}</strong></FieldRow>
        <FieldRow label="Active sources">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end' }}>{(cfg?.siteName ?? []).map((x, i) => chip(x, i))}</div>
        </FieldRow>
      </div>

      <ScheduleSection campaignId={campaign.id} />

      <div style={{ ...card, marginTop: '12px', borderColor: 'var(--color-danger-border)' }}>
        <SectionHeader title="Danger zone" titleColor="var(--color-danger-text)" />
        <FieldRow label="Delete campaign" hint="Permanently removes the campaign and all its runs, prospects, and outreach. This cannot be undone.">
          <button style={dangerBtn} onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
        </FieldRow>
        {err && <div style={{ fontSize: '12px', color: 'var(--color-danger-text)', marginTop: '8px' }}>{err}</div>}
      </div>
    </div>
  );
}

// ─────────── Schedule section ───────────
function ScheduleSection({ campaignId }: { campaignId: string }) {
  const [schedules, setSchedules] = React.useState<Schedule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listCampaignSchedules(campaignId)
      .then(s => { if (alive) setSchedules(Array.isArray(s) ? s : []); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load schedules'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [campaignId]);

  return (
    <div style={{ ...card, marginTop: '12px' }}>
      <SectionHeader title="Schedule" subtitle="Automated runs configured for this campaign." />

      {loading ? (
        <div style={{ fontSize: '13px', color: 'var(--color-text-2)', padding: '6px 0' }}>Loading schedule…</div>
      ) : error ? (
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', padding: '6px 0' }}>
          No schedule configured for this campaign.
        </div>
      ) : schedules.length === 0 ? (
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', padding: '6px 0' }}>
          This campaign runs manually only — no automated schedule is set.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {schedules.map((s, i) => (
            <div key={s.id ?? i} style={i > 0 ? { borderTop: '1px solid var(--color-border)', paddingTop: '14px' } : undefined}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>
                  {scheduleCadence(s)}
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                  textTransform: 'uppercase', letterSpacing: '0.4px',
                  background: s.isActive ? 'var(--color-success-bg)' : 'var(--color-surface)',
                  color: s.isActive ? 'var(--color-success-text)' : 'var(--color-text-2)',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.isActive ? 'var(--color-success)' : 'var(--color-text-3)' }} />
                  {s.isActive ? 'Active' : 'Paused'}
                </span>
              </div>

              <FieldRow label="Frequency"><strong style={fieldVal}>{FREQ_LABEL[s.frequency] ?? s.frequency}</strong></FieldRow>
              {s.frequency !== 'once' && (
                <FieldRow label="Time of day"><strong style={fieldVal}>{fmtTimeOfDay(s.timeOfDay)}</strong></FieldRow>
              )}
              <FieldRow label="Timezone"><strong style={fieldVal}>{s.timezone || '—'}</strong></FieldRow>
              {(() => {
                const when = scheduleWhen(s);
                return when ? <FieldRow label={when.label}><strong style={fieldVal}>{when.value}</strong></FieldRow> : null;
              })()}
              <FieldRow label="Next run"><strong style={fieldVal}>{fmtDateTime(s.nextRunAt ?? null)}</strong></FieldRow>
              <FieldRow label="Last run">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-2)' }}>{fmtDateTime(s.lastRunAt ?? null)}</span>
                  {s.lastRunStatus && (
                    <span style={{
                      fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                      textTransform: 'capitalize',
                      background: statusStyle(s.lastRunStatus).bg, color: statusStyle(s.lastRunStatus).color,
                    }}>{s.lastRunStatus}</span>
                  )}
                </div>
              </FieldRow>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle, titleColor }: { title: string; subtitle?: string; titleColor?: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: titleColor || 'var(--color-text-1)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: '12px', color: 'var(--color-text-2)', marginTop: '2px' }}>{subtitle}</div>}
    </div>
  );
}

/** One settings row: explanatory text on the left, its control on the right.
 *
 *  The text column GROWS and the control column is fixed. It used to be the other
 *  way round — a 140px label column with `flex: 1` on the control — which squeezed
 *  every hint into a tall, narrow ribbon while the row's actual width sat empty to
 *  the right of a 42px toggle.
 *
 *  `maxWidth` on the text keeps lines from running to a hard-to-read length on wide
 *  screens; the control column may shrink on narrow ones so the row never overflows. */
function FieldRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      gap: '32px', padding: '14px 0', borderBottom: '1px solid var(--color-border)',
    }}>
      {/* Text grows to fill the row, pushing the control flush right so every row's
          control lines up. The readable-line cap sits on the TEXT — capping the
          column instead left the control stranded short of the card edge. */}
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)' }}>{label}</div>
        {hint && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginTop: '3px', lineHeight: 1.5, maxWidth: '70ch' }}>
            {hint}
          </div>
        )}
      </div>
      <div style={{ flex: '0 1 300px', minWidth: '150px', display: 'flex', justifyContent: 'flex-end' }}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, mono = false }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{
        fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', marginTop: '2px',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '10.5px', color: 'var(--color-text-3)', marginTop: '1px', whiteSpace: 'nowrap' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─────────── shared inline styles ───────────
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '6px 14px', background: 'var(--color-brand)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '6px 14px', background: 'var(--color-bg)', color: 'var(--color-text-1)',
  border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)',
  fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

const dangerBtn: React.CSSProperties = {
  padding: '6px 14px', background: 'var(--color-bg)', color: 'var(--color-danger-text)',
  border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)',
  fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

const card: React.CSSProperties = {
  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)', padding: '18px 20px',
};

const emptyCard: React.CSSProperties = {
  padding: '48px 20px', textAlign: 'center',
  background: 'var(--color-bg)', border: '1px dashed var(--color-border-2)',
  borderRadius: 'var(--radius-lg)',
};

const fieldVal: React.CSSProperties = {
  fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)',
};

const emptyText: React.CSSProperties = {
  fontSize: '12.5px', color: 'var(--color-text-3)', fontStyle: 'italic',
};

/* Edit-mode chrome for the Campaign Details card — matched to the import
   campaign's Settings so the two screens are visually the same control. */
const editCancelBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
  background: 'var(--color-bg)', color: 'var(--color-text-1)',
  border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)',
  fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

const editSaveBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
  background: 'var(--color-brand)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700,
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

const editInput: React.CSSProperties = {
  width: '100%', maxWidth: '300px', boxSizing: 'border-box', padding: '7px 10px',
  fontSize: '13px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)',
  border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)',
  background: 'var(--color-bg)',
};

const editSelect: React.CSSProperties = { ...editInput, cursor: 'pointer' };
