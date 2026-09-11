'use client';
import React from 'react';
import {
  enrichProspects,
  enrichProspectsMobile,
  fetchEnrichmentCredits,
  type EmailTemplate,
  type EnrichmentCreditStatus,
} from '@/lib/hrApi';
import { substitutePlaceholders } from '@/lib/placeholders';

export interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  seniority: 'c_suite' | 'vp' | 'director' | 'head' | 'manager';
  location: string;
  email: string;
  phone?: string;
  linkedinUrl: string;
  isAccepted: boolean;
  isEnriched: boolean;
  mobileEnrichmentStatus?: string;
  industrySlug?: string;
  companyId?: string;
  matchReasons: string[];
  outreachStatus?: 'sent' | 'pending' | 'failed';
  recentActivity: string;
}

export interface JobContext {
  id: string;
  title: string;
  company: string;
  industry: string;
  location: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  job: JobContext | null;
  prospects: Prospect[];
  loading?: boolean;
  error?: string | null;
  sending?: boolean;
  /** Run id — required for enrichment credit tracking. */
  runId?: string;
  /** Outreach email template for this job (HTML with {{PLACEHOLDER}} tokens). */
  emailTemplate?: EmailTemplate | null;
  /** Re-fetch the prospect list after an enrichment so freshly revealed
   *  email/phone data shows up. */
  onRefresh?: () => Promise<void> | void;
  /** Trigger the email flow for the given prospect ids. Returns when done. */
  onSendEmails?: (prospectIds: string[]) => Promise<void> | void;
}

const SENIORITY_STYLE: Record<Prospect['seniority'], { bg: string; color: string; label: string }> = {
  c_suite:  { bg: 'rgba(139, 92, 246, 0.12)',  color: '#6D28D9',                  label: 'C-suite'  },
  vp:       { bg: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)',  label: 'VP'       },
  director: { bg: 'var(--color-success-bg)',   color: 'var(--color-success-text)',label: 'Director' },
  head:     { bg: 'var(--color-warning-bg)',   color: 'var(--color-warning-text)',label: 'Head'     },
  manager:  { bg: 'var(--color-surface)',      color: 'var(--color-text-2)',      label: 'Manager'  },
};

const AVATAR_COLORS = [
  'var(--color-avatar-blue)', 'var(--color-avatar-green)', 'var(--color-avatar-amber)',
  'var(--color-avatar-purple)', 'var(--color-avatar-pink)',
];

function avatarColor(seed: string) {
  let h = 0; for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function ProspectsPanel({ open, onClose, job, prospects, loading, error, sending, runId, emailTemplate, onRefresh, onSendEmails }: Props) {
  const [tab, setTab] = React.useState<'all' | 'accepted' | 'rejected'>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  // Enrichment state
  const [credits, setCredits] = React.useState<EnrichmentCreditStatus | null>(null);
  const [enriching, setEnriching] = React.useState<'email' | 'email_phone' | null>(null);
  const [enrichingBulk, setEnrichingBulk] = React.useState(false);
  const [findingPhone, setFindingPhone] = React.useState(false);
  const [enrichError, setEnrichError] = React.useState<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = React.useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Apollo can deliver a phone number asynchronously via webhook (status
  // becomes "pending"). Poll a few times so the revealed number appears.
  const pollForPhone = React.useCallback(() => {
    stopPolling();
    let polls = 0;
    pollRef.current = setInterval(async () => {
      polls += 1;
      try {
        await onRefresh?.();
        if (runId) fetchEnrichmentCredits(runId).then(setCredits).catch(() => {});
      } catch { /* ignore transient errors */ }
      if (polls >= 6) stopPolling();
    }, 5000);
  }, [onRefresh, runId, stopPolling]);

  // Stop polling when the panel closes or unmounts
  React.useEffect(() => { if (!open) stopPolling(); return stopPolling; }, [open, stopPolling]);

  // Reset state whenever a new job is opened
  React.useEffect(() => {
    if (!open) return;
    setTab('all');
    setSelected(new Set());
    setActiveId(prospects[0]?.id || null);
    setEnrichError(null);
  }, [open, job?.id]);

  // Load enrichment credits for the run when the panel opens
  React.useEffect(() => {
    if (!open || !runId) { setCredits(null); return; }
    let cancelled = false;
    fetchEnrichmentCredits(runId)
      .then(c => { if (!cancelled) setCredits(c); })
      .catch(() => { /* credits are best-effort */ });
    return () => { cancelled = true; };
  }, [open, runId, job?.id]);

  const emailCreditsLeft = credits?.creditsRemaining ?? null;
  const mobileCreditsLeft = credits?.mobileCreditsRemaining ?? null;
  const mobileLimit = credits?.mobileLimit ?? 3;
  // Per-job mail quota (job-scoped): each job can only consume `perJobLimit`
  // successful email enrichments. Mirrors the backend check in credit_service.
  const perJobLimit = credits?.perJobLimit ?? null;
  const jobMailUsed = job && credits ? (credits.jobCredits?.[job.id] ?? 0) : 0;
  const jobQuotaFull = perJobLimit !== null && jobMailUsed >= perJobLimit;

  const handleEnrich = async (mode: 'email' | 'email_phone') => {
    if (!activeId || !runId || enriching) return;
    if (emailCreditsLeft !== null && emailCreditsLeft <= 0) {
      setEnrichError('No email credits remaining for this run. Credits reset at midnight UTC.');
      return;
    }
    if (jobQuotaFull) {
      setEnrichError(`This job has reached its mail quota of ${perJobLimit} enrichments. Pick another job or wait for the daily reset.`);
      return;
    }
    if (mode === 'email_phone' && mobileCreditsLeft !== null && mobileCreditsLeft <= 0) {
      setEnrichError(`No mobile credits remaining for this run (limit: ${mobileLimit}).`);
      return;
    }
    setEnriching(mode);
    setEnrichError(null);
    try {
      const res = await enrichProspects([activeId], runId, job?.id, mode === 'email_phone');
      if (res.creditStatus) setCredits(res.creditStatus);
      else if (runId) fetchEnrichmentCredits(runId).then(setCredits).catch(() => {});
      await onRefresh?.();
      // If a mobile lookup was requested and queued for webhook delivery, poll.
      if (mode === 'email_phone' && (res.triggered ?? 0) > 0) pollForPhone();
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : 'Enrichment failed — please try again.');
    } finally {
      setEnriching(null);
    }
  };

  // Bulk email enrichment for all currently-selected prospects. Mirrors the
  // single-prospect handleEnrich credit guardrails but for the selection.
  const handleEnrichSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0 || !runId || enrichingBulk) return;
    if (emailCreditsLeft !== null && emailCreditsLeft <= 0) {
      setEnrichError('No email credits remaining for this run. Credits reset at midnight UTC.');
      return;
    }
    if (jobQuotaFull) {
      setEnrichError(`This job has reached its mail quota of ${perJobLimit} enrichments. Pick another job or wait for the daily reset.`);
      return;
    }
    if (emailCreditsLeft !== null && ids.length > emailCreditsLeft) {
      setEnrichError(`You selected ${ids.length} prospects but only ${emailCreditsLeft} email credit${emailCreditsLeft === 1 ? '' : 's'} remain this run.`);
      return;
    }
    setEnrichingBulk(true);
    setEnrichError(null);
    try {
      const res = await enrichProspects(ids, runId, job?.id, false);
      if (res.creditStatus) setCredits(res.creditStatus);
      else if (runId) fetchEnrichmentCredits(runId).then(setCredits).catch(() => {});
      await onRefresh?.();
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : 'Bulk enrichment failed — please try again.');
    } finally {
      setEnrichingBulk(false);
    }
  };

  const handleFindPhone = async () => {
    if (!activeId || !runId || findingPhone) return;
    if (mobileCreditsLeft !== null && mobileCreditsLeft <= 0) {
      setEnrichError('Mobile credit limit reached for this run. Resets at midnight UTC.');
      return;
    }
    setFindingPhone(true);
    setEnrichError(null);
    try {
      const res = await enrichProspectsMobile([activeId], runId, job?.id);
      if (res.creditStatus) setCredits(res.creditStatus);
      else if (runId) fetchEnrichmentCredits(runId).then(setCredits).catch(() => {});
      await onRefresh?.();
      // Phone may arrive synchronously (res.phones) or via webhook (pending).
      const gotPhoneNow = !!res.phones && Object.keys(res.phones).length > 0;
      if (!gotPhoneNow && (res.triggered ?? 0) > 0) pollForPhone();
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : 'Failed to look up phone number.');
    } finally {
      setFindingPhone(false);
    }
  };

  // ESC closes the panel
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = prospects.filter(p =>
    tab === 'all' ? true : tab === 'accepted' ? p.isAccepted : !p.isAccepted
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const toggleSelectAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) filtered.forEach(p => next.delete(p.id));
    else filtered.forEach(p => next.add(p.id));
    setSelected(next);
  };
  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const active = prospects.find(p => p.id === activeId) || null;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Slide panel */}
      <aside style={{
        position: 'fixed', top: 0, bottom: 0, right: 0,
        width: 'min(95vw, 1120px)', background: 'var(--color-bg)',
        zIndex: 101, boxShadow: 'var(--shadow-modal)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-brand-subtle)', color: 'var(--color-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7" cy="6" r="2.5" /><path d="M2 15c0-3 2.2-5 5-5s5 2 5 5" />
                <circle cx="13" cy="6.5" r="2" /><path d="M14 12.5c1.6.6 2.5 1.8 2.5 3.5" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)' }}>Prospects</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>Found for this job posting</div>
            </div>
          </div>
          {/* Global quotas + close — shown in the header because they apply across all jobs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {credits && (
              <QuotaRing
                label={<>Daily Email<br />Limit</>}
                used={credits.creditsUsed}
                limit={credits.dailyLimit}
                kind="email"
              />
            )}
            {credits && (
              <QuotaRing
                label={<>Daily Mobile<br />Limit</>}
                used={credits.mobileCreditsUsed ?? 0}
                limit={credits.mobileLimit ?? 3}
                kind="mobile"
              />
            )}
            <button onClick={onClose} style={{
              width: '32px', height: '32px', border: 'none', background: 'transparent',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-2)',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
              </svg>
            </button>
          </div>
        </div>

        {/* Job context + job-scoped mail quota */}
        {job && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
            padding: '12px 20px', background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="var(--color-brand)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="2.5" y="5" width="13" height="10" rx="1.5" />
                <path d="M6 5V3.5h6V5" />
              </svg>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>{job.company} · {job.location}</div>
              </div>
            </div>
            {credits && perJobLimit !== null && (
              <QuotaRing
                label={<>Mail Limit<br />Per Job</>}
                used={jobMailUsed}
                limit={perJobLimit}
                kind="job"
                elevated
              />
            )}
          </div>
        )}

        {/* Split */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* LEFT: list */}
          <div style={{
            width: '40%', minWidth: '320px',
            borderRight: '1px solid var(--color-border)',
            display: 'flex', flexDirection: 'column', background: 'var(--color-bg)',
          }}>
            {/* Tabs */}
            <div style={{
              display: 'flex', alignItems: 'center', padding: '0 16px',
              borderBottom: '1px solid var(--color-border)', flexShrink: 0, gap: '4px',
            }}>
              {(['all', 'accepted', 'rejected'] as const).map(t => {
                const on = tab === t;
                const label = t === 'all' ? 'All' : t === 'accepted' ? 'Accepted' : 'Rejected';
                return (
                  <button key={t} onClick={() => setTab(t)} style={{
                    padding: '10px 12px', background: 'none', border: 'none',
                    borderBottom: `2px solid ${on ? 'var(--color-brand)' : 'transparent'}`,
                    fontSize: '13px', fontWeight: on ? 600 : 500,
                    color: on ? 'var(--color-brand)' : 'var(--color-text-2)',
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    marginBottom: '-1px',
                  }}>{label}</button>
                );
              })}
            </div>

            {/* Select-all row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 16px', background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckBox checked={allFilteredSelected} onChange={toggleSelectAll} />
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Select all
                </span>
              </div>
              <span style={{
                fontSize: '10.5px', fontWeight: 700,
                background: 'var(--color-border)', color: 'var(--color-text-2)',
                padding: '2px 8px', borderRadius: 'var(--radius-sm)',
              }}>{filtered.length} total</span>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)' }}>
                  Loading prospects…
                </div>
              ) : error ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-danger-text)' }}>
                  {error}
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)' }}>
                  No prospects match this filter.
                </div>
              ) : filtered.map(p => {
                const isActive = p.id === activeId;
                const isSel = selected.has(p.id);
                return (
                  <div key={p.id} onClick={() => setActiveId(p.id)} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderLeft: `3px solid ${isActive ? 'var(--color-brand)' : 'transparent'}`,
                    background: isActive ? 'var(--color-brand-tint)' : 'transparent',
                    borderBottom: '1px solid var(--color-border)',
                    transition: 'background .12s',
                  }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-row-hover)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                    <div onClick={e => e.stopPropagation()} style={{ paddingTop: '8px' }}>
                      <CheckBox checked={isSel} onChange={() => toggleSelect(p.id)} />
                    </div>

                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: avatarColor(p.id), color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: 700,
                      }}>{p.firstName[0]}{p.lastName[0]}</div>
                      <div style={{
                        position: 'absolute', bottom: '-2px', right: '-2px',
                        width: '14px', height: '14px', borderRadius: '50%',
                        background: p.isAccepted ? 'var(--color-success)' : 'var(--color-danger)',
                        border: '2px solid var(--color-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="6" height="6" viewBox="0 0 8 8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          {p.isAccepted ? <polyline points="1.5,4.5 3.5,6.5 6.5,2" /> : (
                            <><line x1="2" y1="2" x2="6" y2="6" /><line x1="6" y1="2" x2="2" y2="6" /></>
                          )}
                        </svg>
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.firstName} {p.lastName}
                        </span>
                        <SeniorityBadge seniority={p.seniority} />
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.title}{job ? ` at ${job.company}` : ''}
                      </div>
                      {p.outreachStatus && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          marginTop: '4px', fontSize: '10.5px', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.5px',
                          color: p.outreachStatus === 'sent' ? 'var(--color-success-text)'
                            : p.outreachStatus === 'failed' ? 'var(--color-danger-text)'
                            : 'var(--color-warning-text)',
                        }}>
                          <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: p.outreachStatus === 'sent' ? 'var(--color-success)'
                              : p.outreachStatus === 'failed' ? 'var(--color-danger)'
                              : 'var(--color-warning)',
                          }} />
                          Email {p.outreachStatus}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer action */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: '8px' }}>
              <button
                disabled={selected.size === 0 || enrichingBulk}
                onClick={handleEnrichSelected}
                title="Reveal verified emails for the selected prospects (uses email credits)"
                style={{
                  flex: 1, padding: '10px',
                  background: 'var(--color-bg)',
                  border: `1px solid ${selected.size > 0 ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
                  color: selected.size > 0 ? 'var(--color-brand-text)' : 'var(--color-text-3)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12.5px', fontWeight: 700, fontFamily: 'var(--font-sans)',
                  cursor: selected.size === 0 || enrichingBulk ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}>
                {enrichingBulk ? <><Spinner /> Enriching…</> : `Enrich (${selected.size})`}
              </button>
              <button
                disabled={selected.size === 0 || sending || !onSendEmails}
                onClick={() => onSendEmails?.(Array.from(selected))}
                style={{
                  flex: 1.4, padding: '10px',
                  background: selected.size > 0 && !sending ? 'var(--color-brand)' : 'var(--color-surface)',
                  color: selected.size > 0 && !sending ? '#fff' : 'var(--color-text-3)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)',
                  cursor: selected.size === 0 || sending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2L7 9" /><polygon points="14,2 10,14 7,9 2,6" />
                </svg>
                {sending ? 'Sending…' : `Send email${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </button>
            </div>
          </div>

          {/* RIGHT: detail */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)' }}>
            {!active ? (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '40px', background: 'var(--color-row-hover)',
              }}>
                <div style={{
                  width: '68px', height: '68px', borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-brand-subtle)', color: 'var(--color-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px',
                }}>
                  <svg width="30" height="30" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7" cy="6" r="2.5" /><path d="M2 15c0-3 2.2-5 5-5s5 2 5 5" />
                    <circle cx="13" cy="6.5" r="2" /><path d="M14 12.5c1.6.6 2.5 1.8 2.5 3.5" />
                  </svg>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>
                  No prospect selected
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-2)', textAlign: 'center', maxWidth: '360px' }}>
                  Select a prospect from the list to view their full dossier and outreach email.
                </div>
              </div>
            ) : (
              <div style={{ padding: '28px 32px', maxWidth: '720px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '24px' }}>
                  <div style={{
                    width: '72px', height: '72px', borderRadius: '50%',
                    background: avatarColor(active.id), color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '24px', fontWeight: 700, flexShrink: 0,
                  }}>
                    {active.firstName[0]}{active.lastName[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)' }}>
                        {active.firstName} {active.lastName}
                      </span>
                      <SeniorityBadge seniority={active.seniority} />
                    </div>
                    <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)' }}>
                      {active.title} at{' '}
                      <span style={{ color: 'var(--color-brand)', fontWeight: 600 }}>{job?.company}</span>
                    </div>
                  </div>
                </div>

                {/* Location + LinkedIn */}
                <div style={{ display: 'flex', gap: '24px', marginBottom: '28px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-2)' }}>
                    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 1.5c-3 0-5.5 2.4-5.5 5.5 0 4 5.5 9.5 5.5 9.5s5.5-5.5 5.5-9.5c0-3.1-2.5-5.5-5.5-5.5z" />
                      <circle cx="9" cy="7" r="2" />
                    </svg>
                    {active.location}
                  </div>
                  <a href={active.linkedinUrl} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-2)', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-2)')}>
                    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2.5" y="2.5" width="13" height="13" rx="1.8" />
                      <line x1="5.5" y1="7.5" x2="5.5" y2="13" />
                      <circle cx="5.5" cy="5" r="0.8" fill="currentColor" stroke="none" />
                      <path d="M8.5 13V7.5M8.5 9.5c0-1.1 1-2 2.2-2s2.3.9 2.3 2.5V13" />
                    </svg>
                    linkedin.com/in/{active.firstName.toLowerCase()}{active.lastName.toLowerCase()}
                  </a>
                </div>

                {/* Mobile Phone */}
                <Section icon={
                  <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 4.5c0-1 .8-2 1.8-2h1.6c.4 0 .8.3.9.7L8 6c.1.4 0 .8-.3 1L6.5 8a8 8 0 0 0 3.5 3.5l1-1.2c.3-.3.7-.4 1.1-.3l2.8.7c.4.1.7.5.7.9v1.6c0 1-1 1.8-2 1.8C7.4 15 3 10.6 3 4.5z" />
                  </svg>
                } title="Mobile Phone">
                  <div style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                      padding: '12px 16px', background: 'var(--color-surface)',
                      borderBottom: '1px solid var(--color-border)',
                    }}>
                      {active.phone ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--color-brand)' }}>
                          {active.phone}
                        </span>
                      ) : active.mobileEnrichmentStatus === 'pending' ? (
                        <span style={{ fontSize: '12px', color: 'var(--color-brand)', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Spinner /> Lookup pending callback…
                        </span>
                      ) : (
                        <span style={{ fontSize: '12.5px', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
                          Mobile number not yet discovered
                        </span>
                      )}
                      {active.phone ? (
                        <button onClick={() => copy(active.phone!)} style={pillBtnStyle}>
                          {copied === active.phone ? '✓ Copied' : 'Copy'}
                        </button>
                      ) : (
                        <button
                          onClick={handleFindPhone}
                          disabled={
                            findingPhone || !runId ||
                            active.mobileEnrichmentStatus === 'pending' ||
                            (mobileCreditsLeft !== null && mobileCreditsLeft <= 0)
                          }
                          style={{
                            ...pillBtnStyle,
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            opacity: (findingPhone || !runId || active.mobileEnrichmentStatus === 'pending' || (mobileCreditsLeft !== null && mobileCreditsLeft <= 0)) ? 0.55 : 1,
                            cursor: (findingPhone || !runId || active.mobileEnrichmentStatus === 'pending' || (mobileCreditsLeft !== null && mobileCreditsLeft <= 0)) ? 'not-allowed' : 'pointer',
                          }}>
                          {findingPhone ? <><Spinner /> Searching…</> : 'Find phone'}
                        </button>
                      )}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                      padding: '8px 16px', fontSize: '11px',
                    }}>
                      <span style={{ color: active.phone ? 'var(--color-success-text)' : 'var(--color-text-3)' }}>
                        {active.phone
                          ? '✓ Phone enriched'
                          : active.mobileEnrichmentStatus === 'pending'
                            ? 'Number will populate on webhook confirmation.'
                            : 'Costs 1 mobile credit per successful lookup.'}
                      </span>
                      {!active.phone && mobileCreditsLeft !== null && (
                        <span style={{ fontWeight: 700, color: mobileCreditsLeft <= 0 ? 'var(--color-danger-text)' : 'var(--color-brand)' }}>
                          {mobileCreditsLeft} / {mobileLimit} mobile credits
                        </span>
                      )}
                    </div>
                  </div>
                </Section>

                {/* Outreach mail */}
                <Section icon={
                  <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="14" height="10" rx="1.5" /><polyline points="2.5,5 9,10 15.5,5" />
                  </svg>
                } title="Outreach mail content">
                  {enrichError && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: '8px',
                      padding: '10px 12px', marginBottom: '12px',
                      background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
                      borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-danger-text)',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ flexShrink: 0, marginTop: '1px' }}>
                        <circle cx="8" cy="8" r="6.5" /><line x1="8" y1="5" x2="8" y2="8.5" /><circle cx="8" cy="11" r="0.6" fill="currentColor" />
                      </svg>
                      {enrichError}
                    </div>
                  )}

                  {active.isEnriched ? (
                    active.email ? (
                      <div style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)', overflow: 'hidden',
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', background: 'var(--color-surface)',
                          borderBottom: '1px solid var(--color-border)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-3)' }}>To:</span>
                            <span style={{
                              fontSize: '13px', fontWeight: 700, color: 'var(--color-brand)',
                              background: 'var(--color-brand-subtle)', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                            }}>{active.email}</span>
                          </div>
                          <button onClick={() => copy(active.email)} style={pillBtnStyle}>
                            {copied === active.email ? '✓ Copied' : 'Copy draft'}
                          </button>
                        </div>
                        {emailTemplate?.template ? (
                          <div style={{ padding: '16px', background: 'var(--color-bg)', overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
                            <div
                              style={{ width: '100%', fontSize: '13.5px', color: 'var(--color-text-1)', lineHeight: 1.6 }}
                              dangerouslySetInnerHTML={{ __html: renderTemplate(emailTemplate.template, active, job) }}
                            />
                          </div>
                        ) : (
                          <div style={{ padding: '20px', fontSize: '13px', color: 'var(--color-text-2)', lineHeight: 1.6 }}>
                            <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--color-text-1)' }}>
                              Subject: Connect regarding {job?.title} at {job?.company}
                            </div>
                            No outreach template is configured for this industry yet. The verified email
                            above will receive the default outreach copy when you trigger the email flow.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{
                        padding: '28px', textAlign: 'center',
                        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                        background: 'var(--color-surface)',
                      }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>
                          No verified email
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', maxWidth: '360px', margin: '0 auto' }}>
                          A verified email could not be retrieved from the enrichment provider, so this
                          prospect falls back to manual outreach.
                        </div>
                      </div>
                    )
                  ) : (
                    // ── Not enriched yet → offer enrichment ──
                    <div style={{
                      padding: '24px', textAlign: 'center',
                      border: '1px dashed var(--color-warning)', borderRadius: 'var(--radius-md)',
                      background: 'var(--color-warning-bg)',
                    }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%', margin: '0 auto 14px',
                        background: 'var(--color-bg)', color: 'var(--color-warning-text)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {enriching ? <Spinner size={20} /> : (
                          <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 9a6 6 0 1 1-1.8-4.3" /><polyline points="15 3 15 6 12 6" />
                          </svg>
                        )}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-warning-text)', marginBottom: '6px' }}>
                        Enrichment required
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', maxWidth: '380px', margin: '0 auto 18px', lineHeight: 1.5 }}>
                        Reveal this prospect&apos;s verified email to unlock the personalized outreach draft.
                        Optionally request their mobile number in the same step.
                      </div>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleEnrich('email')}
                          disabled={!!enriching || !runId || jobQuotaFull || (emailCreditsLeft !== null && emailCreditsLeft <= 0)}
                          title={jobQuotaFull ? `This job's mail quota of ${perJobLimit} is used up` : 'Reveal verified email'}
                          style={enrichBtnStyle('email', !!enriching || !runId || jobQuotaFull || (emailCreditsLeft !== null && emailCreditsLeft <= 0))}>
                          {enriching === 'email' ? <><Spinner /> Enriching…</> : 'Email only'}
                        </button>
                        <button
                          onClick={() => handleEnrich('email_phone')}
                          disabled={!!enriching || !runId || jobQuotaFull || (emailCreditsLeft !== null && emailCreditsLeft <= 0) || (mobileCreditsLeft !== null && mobileCreditsLeft <= 0)}
                          title={jobQuotaFull ? `This job's mail quota of ${perJobLimit} is used up` : mobileCreditsLeft !== null && mobileCreditsLeft <= 0 ? `No mobile credits left (${mobileLimit} per run)` : 'Enrich email + request mobile number'}
                          style={enrichBtnStyle('phone', !!enriching || !runId || jobQuotaFull || (emailCreditsLeft !== null && emailCreditsLeft <= 0) || (mobileCreditsLeft !== null && mobileCreditsLeft <= 0))}>
                          {enriching === 'email_phone' ? <><Spinner /> Enriching…</> : (
                            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                              <span>Email + Phone</span>
                              <span style={{ fontSize: '10px', fontWeight: 500, opacity: 0.85 }}>
                                {mobileCreditsLeft !== null ? `${mobileCreditsLeft}/${mobileLimit} mobile credits` : 'mobile lookup'}
                              </span>
                            </span>
                          )}
                        </button>
                      </div>
                      {jobQuotaFull ? (
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-danger-text)', marginTop: '12px' }}>
                          This job&apos;s mail quota ({jobMailUsed}/{perJobLimit}) is used up — enrich a different job or wait for the daily reset.
                        </div>
                      ) : emailCreditsLeft !== null && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '12px' }}>
                          {emailCreditsLeft} email credit{emailCreditsLeft === 1 ? '' : 's'} remaining this run · {jobMailUsed}/{perJobLimit ?? '—'} used for this job
                        </div>
                      )}
                    </div>
                  )}
                </Section>

                {/* Highlights */}
                {active.matchReasons.length > 0 && (
                  <Section title="Key highlights">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {active.matchReasons.map((r, i) => (
                        <span key={i} style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '4px 10px', borderRadius: 'var(--radius-full)',
                          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                          fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-2)',
                          textTransform: 'capitalize',
                        }}>{r.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Recent activity */}
                <Section title="Recent activity">
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '14px', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', background: 'var(--color-surface)',
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'var(--color-brand-subtle)', color: 'var(--color-brand)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 1.5l6 3v4c0 4-3 7-6 7s-6-3-6-7v-4z" />
                        <polyline points="6.5,9 8,10.5 11.5,7" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)' }}>Qualified via validation</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-2)', marginTop: '2px' }}>{active.recentActivity}</div>
                    </div>
                  </div>
                </Section>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// ─────────────── helpers ───────────────

/**
 * Small circular gauge showing a used/limit quota. Mirrors the enrichment
 * limitation rings from the legacy HR-Assistant UI (Daily Email Sent, Daily
 * Mobile Quota, This Job Mail Quota). The arc turns amber past 66% and red when
 * the quota is exhausted. `kind` only changes the base (not-yet-full) color.
 */
function QuotaRing({ label, used, limit, kind, elevated }: {
  label: React.ReactNode;
  used: number;
  limit: number;
  kind: 'email' | 'mobile' | 'job';
  /** Render on a raised white card (used inside the surface-colored job bar). */
  elevated?: boolean;
}) {
  const safeLimit = limit > 0 ? limit : 1;
  const pct = Math.min(100, Math.round((used / safeLimit) * 100));
  const isFull = used >= limit;
  const base = kind === 'mobile' ? 'var(--color-avatar-purple)' : 'var(--color-success)';
  const stroke = isFull ? 'var(--color-danger)' : pct > 66 ? 'var(--color-warning)' : base;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '5px 10px', borderRadius: 'var(--radius-md)',
      background: elevated ? 'var(--color-bg)' : 'var(--color-surface)',
      border: '1px solid var(--color-border)', flexShrink: 0,
      boxShadow: elevated ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
    }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontSize: '8px', fontWeight: 700, color: 'var(--color-text-3)',
          textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.15,
        }}>{label}</div>
        <div style={{
          fontSize: '12px', fontWeight: 800,
          color: isFull ? 'var(--color-danger-text)' : 'var(--color-text-1)',
        }}>{used}/{limit}</div>
      </div>
      <svg width="34" height="34" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke="var(--color-border)" strokeWidth="3" />
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke={stroke} strokeWidth="3"
          strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
      </svg>
    </div>
  );
}

const pillBtnStyle: React.CSSProperties = {
  padding: '4px 10px', background: 'var(--color-bg)',
  border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)',
  fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-1)',
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

function enrichBtnStyle(kind: 'email' | 'phone', disabled: boolean): React.CSSProperties {
  const bg = kind === 'email' ? 'var(--color-warning)' : 'var(--color-avatar-purple)';
  return {
    minWidth: '140px', padding: '10px 16px',
    background: bg, color: '#fff', border: 'none',
    borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 700,
    fontFamily: 'var(--font-sans)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    transition: 'opacity .12s',
  };
}

function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      style={{ animation: 'miloSpin 0.7s linear infinite', flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <style>{`@keyframes miloSpin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

/**
 * Substitute the backend template's {{PLACEHOLDER}} tokens with the active
 * prospect's details. Mirrors the substitution the old HR-Assistant UI did so
 * the rendered preview matches what the email flow actually sends.
 */
function renderTemplate(template: string, p: Prospect, job: JobContext | null): string {
  return substitutePlaceholders(template, {
    first: p.firstName || '',
    last: p.lastName || '',
    company: job?.company || '',
    jobTitle: job?.title || '',
  });
}

function Section({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-3)',
        textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '10px',
      }}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function SeniorityBadge({ seniority }: { seniority: Prospect['seniority'] }) {
  const s = SENIORITY_STYLE[seniority];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: 'var(--radius-sm)',
      background: s.bg, color: s.color,
      fontSize: '9.5px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
    }}>{s.label}</span>
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
