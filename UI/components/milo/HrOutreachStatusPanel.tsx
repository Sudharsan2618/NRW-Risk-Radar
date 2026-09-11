'use client';
import React from 'react';
import { getOutreachStatus, type OutreachStatusResponse } from '@/lib/hrApi';

/** Render an outreach timestamp in the viewer's local time.
 *
 * The backend serialises `updatedAt` via `datetime.utcnow()` with no timezone
 * suffix, so an offset-less string must be pinned to UTC — left as-is the
 * browser would read it as local time and shift the clock by its own offset.
 */
function localTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const hasTz = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const d = new Date(hasTz ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS: Record<string, [string, string]> = {
  sent: ['var(--color-success-bg)', 'var(--color-success-text)'],
  replied: ['var(--color-brand-subtle)', 'var(--color-brand-text)'],
  pending: ['var(--color-warning-bg)', 'var(--color-warning-text)'],
  failed: ['var(--color-danger-bg)', 'var(--color-danger-text)'],
  skipped: ['var(--color-surface)', 'var(--color-text-2)'],
};

const POLL_MS = 2500;

/* ── skeleton loader ── mirrors the real row/card geometry so the panel doesn't
 * reflow when the first response lands. */
const shimmer: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--color-surface) 25%, var(--color-border) 37%, var(--color-surface) 63%)',
  backgroundSize: '400% 100%', animation: 'hrOutreachSkeleton 1.4s ease infinite',
};
function Skel({ w, h = 12, r = 6, style }: { w: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return <div style={{ width: w, height: h, borderRadius: r, ...shimmer, ...style }} />;
}
function MiniCardSkeleton() {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
      <Skel w={52} h={10} />
      <Skel w={28} h={22} style={{ marginTop: '6px' }} />
    </div>
  );
}
function LogRowSkeleton({ last }: { last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 14px', borderBottom: last ? 'none' : '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 }}>
        <Skel w={190} h={12} />
        <Skel w={130} h={11} />
      </div>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
        <Skel w={46} h={16} r={999} />
        <Skel w={72} h={10} />
      </div>
    </div>
  );
}

/** Right-side sheet showing live outreach status + per-prospect logs for a run.
 * Mirrors the import campaign's Outreach Status panel, wired to the HR
 * `/runs/{runId}/outreach-status` endpoint via getOutreachStatus. */
export function HrOutreachStatusPanel({ open, onClose, runId, runName }: {
  open: boolean; onClose: () => void; runId: string; runName: string;
}) {
  const [data, setData] = React.useState<OutreachStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Poll by chaining a timeout off each completed response rather than a fixed
  // interval, so a slow response can't let requests stack up and saturate the
  // browser's per-origin connection budget.
  React.useEffect(() => {
    if (!open) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;

    setData(null);
    setError(null);
    setLoading(true);

    const load = async () => {
      try {
        const d = await getOutreachStatus(runId);
        if (stop) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (stop) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!stop) {
          setLoading(false);
          timer = setTimeout(load, POLL_MS);
        }
      }
    };
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [open, runId]);

  const s = { pending: 0, sent: 0, failed: 0, skipped: 0, replied: 0, ...(data?.summary ?? {}) };

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1100 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(92vw, 480px)', background: 'var(--color-bg)', zIndex: 1101, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)' }}>Outreach Status</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>{runName}</div>
          </div>
          <button onClick={onClose} style={iconBtn}><X /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading && <style>{`@keyframes hrOutreachSkeleton{0%{background-position:100% 50%}100%{background-position:0 50%}}`}</style>}
          {error && <div style={{ padding: '10px 14px', background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', marginBottom: '16px' }}>{error}</div>}
          {/* Tiles read as authoritative counts, so they must not show 0 before
              the first response — indistinguishable from a run with no outreach. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: s.pending > 0 ? '12px' : '20px' }}>
            {loading ? (
              <>
                <MiniCardSkeleton /><MiniCardSkeleton /><MiniCardSkeleton /><MiniCardSkeleton />
              </>
            ) : (
              <>
                <MiniCard label="Pending" count={s.pending} c="var(--color-warning-text)" bg="var(--color-warning-bg)" live={s.pending > 0} />
                <MiniCard label="Sent" count={s.sent} c="var(--color-success-text)" bg="var(--color-success-bg)" />
                <MiniCard label="Failed" count={s.failed} c="var(--color-danger-text)" bg="var(--color-danger-bg)" />
                <MiniCard label="Skipped" count={s.skipped} c="var(--color-text-2)" bg="var(--color-surface)" />
              </>
            )}
          </div>

          {/* Live pipeline progress — visible while emails are still going out. */}
          {s.pending > 0 && (() => {
            const done = s.sent + s.failed + s.skipped + s.replied;
            const total = done + s.pending;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-2)' }}>
                    <span className="hr-outreach-status-spinner" style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--color-brand)', borderTopColor: 'transparent', display: 'inline-block' }} />
                    Sending outreach…
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-1)' }}>{done} of {total}</span>
                </div>
                <div style={{ height: '6px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-brand)', borderRadius: 'var(--radius-full)', transition: 'width .4s ease' }} />
                </div>
                <style>{`@keyframes hr-outreach-status-spin{to{transform:rotate(360deg)}}.hr-outreach-status-spinner{animation:hr-outreach-status-spin .7s linear infinite;}`}</style>
              </div>
            );
          })()}

          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>
            Outreach logs{loading ? '' : ` · ${data?.total ?? 0}`}
          </div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {loading ? (
              [0, 1, 2, 3, 4].map(i => <LogRowSkeleton key={i} last={i === 4} />)
            ) : (data?.records ?? []).length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>No activity yet.</div>
            ) : data!.records.map(r => {
              const status = r.status || 'skipped';
              const [bg, c] = STATUS[status] ?? STATUS.skipped;
              const ts = r.updatedAt || r.sentAt;
              return (
                <div key={r._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 14px', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.jobTitle}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-brand)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.prospectName || r.name || 'Unknown'} <span style={{ color: 'var(--color-text-3)' }}>@ {r.prospectCompany || r.company || '—'}</span></div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'capitalize', background: bg, color: c, padding: '3px 9px', borderRadius: 'var(--radius-full)' }}>{status}</span>
                    {localTime(ts) && (
                      <span
                        title={`${status === 'pending' ? 'Queued' : 'Updated'} at ${localTime(ts)}`}
                        style={{ fontSize: '10.5px', color: 'var(--color-text-3)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {localTime(ts)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function MiniCard({ label, count, c, bg, live = false }: { label: string; count: number; c: string; bg: string; live?: boolean }) {
  return (
    <div style={{ background: bg, borderRadius: 'var(--radius-md)', padding: '12px 14px', boxShadow: live ? `inset 0 0 0 1.5px ${c}` : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {live && <span className="hr-outreach-pending-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block' }} />}
        <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: c, opacity: 0.85 }}>{label}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: c }}>{count}</div>
      {live && <style>{`@keyframes hr-outreach-pending-pulse{0%,100%{opacity:1}50%{opacity:.25}}.hr-outreach-pending-pulse{animation:hr-outreach-pending-pulse 1s ease-in-out infinite;}`}</style>}
    </div>
  );
}

const X = () => <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>;
const iconBtn: React.CSSProperties = { width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, color: 'var(--color-text-3)' };
