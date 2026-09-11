'use client';
import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { ProspectCard } from '@/components/ui/ProspectCard';
import { EmptyState, EmptyIcons } from '@/components/ui/EmptyState';
import { COMPOSE_BODY_HEIGHT, COMPOSE_DOCK_PADDING } from './composeLayout';
import Link from 'next/link';
import {
  fetchLinkedInAccounts, fetchLinkedInWorklist, markLinkedInTaskDone, syncLinkedInAccepted, fetchLinkedInDraft, fetchLinkedInIntent,
  sourceLinkedInUrl, sendLinkedInInvite, checkLinkedInConnection,
  sendLinkedInMessage, refreshLinkedInIntent,
  enrichLinkedInProfile, fetchLinkedInProfile, fetchCommunicationHistory,
  type LinkedInAccount, type LinkedInProspect, type LinkedInStatus,
  type LinkedinPost, type LinkedInProfileDoc, type CommEvent,
} from '@/lib/leadFunnelApi';
import { formatDateTime } from '@/lib/datetime';

/** Counters the LinkedIn board reports up so the My-Tasks ring/tab reflect the
 *  real per-day invite worklist. */
export interface LinkedInStats { done: number; goal: number }

/* ── shared bits ── */

/** Creation time (epoch seconds) from an ObjectId's first 4 bytes — orders accounts
 *  by when their campaign was created, consistent with the sidebar + My Tasks. */
function oidTime(id?: string | null): number {
  return id && /^[0-9a-fA-F]{24}$/.test(id) ? parseInt(id.slice(0, 8), 16) : -Infinity;
}

const primaryBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const ghostBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-bg)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const liCaps: React.CSSProperties = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--color-text-3)' };
const sectionTitle: React.CSSProperties = { fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--color-text-1)' };

// Brand-tinted icon chip that gives each board section a distinct marker.
function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', flexShrink: 0, background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' }}>{children}</span>
  );
}
const InvitesIcon = (
  <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="6" r="2.6" /><path d="M2.5 15c0-2.5 2-4.3 4.5-4.3s4.5 1.8 4.5 4.3" /><line x1="14" y1="5.5" x2="14" y2="10.5" /><line x1="11.5" y1="8" x2="16.5" y2="8" />
  </svg>
);
const AccountsIcon = (
  <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="2.5" width="8" height="13" rx="1" /><path d="M11 6.5h4v9h-4" /><line x1="5.5" y1="5.5" x2="8.5" y2="5.5" /><line x1="5.5" y1="8" x2="8.5" y2="8" /><line x1="5.5" y1="10.5" x2="8.5" y2="10.5" /><line x1="13" y1="9" x2="13" y2="9.5" /><line x1="13" y1="12" x2="13" y2="12.5" />
  </svg>
);

/* ── skeleton loader ── */

const shimmer: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--color-surface) 25%, var(--color-border) 37%, var(--color-surface) 63%)',
  backgroundSize: '400% 100%', animation: 'liSkeleton 1.4s ease infinite',
};
function Skel({ w, h = 12, r = 6, style }: { w: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return <div style={{ width: w, height: h, borderRadius: r, ...shimmer, ...style }} />;
}
function LinkedInSkeleton() {
  const card = (key: number) => (
    <div key={key} style={{ width: 240, flexShrink: 0, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Skel w={120} h={14} /><Skel w={20} h={20} r={4} />
      </div>
      <Skel w={90} h={11} /><Skel w={150} h={11} />
      <Skel w={80} h={22} r={11} style={{ marginTop: '4px' }} />
    </div>
  );
  const row = (key: number) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <Skel w={200} h={13} /><Skel w={140} h={11} />
      </div>
      <Skel w={70} h={11} />
    </div>
  );
  return (
    <>
      <style>{`@keyframes liSkeleton{0%{background-position:100% 50%}100%{background-position:0 50%}}`}</style>
      <div style={{ flex: '40 1 0', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ padding: '20px 24px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Skel w={22} h={22} r={6} /><Skel w={110} h={12} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>{[0, 1, 2].map(card)}</div>
        </div>
        <div style={{ padding: '8px 0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 24px 12px' }}>
            <Skel w={22} h={22} r={6} /><Skel w={130} h={12} />
          </div>
          <div style={{ borderTop: '1px solid var(--color-border)' }}>{[0, 1, 2, 3, 4, 5].map(row)}</div>
        </div>
      </div>
      <aside style={{ flex: '60 1 0', minWidth: '360px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skel w={170} h={16} /><Skel w={120} h={12} />
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
          <Skel w={90} h={11} />
          <Skel w="100%" h={12} /><Skel w="92%" h={12} /><Skel w="96%" h={12} /><Skel w="70%" h={12} />
          <div style={{ height: '6px' }} />
          <Skel w="100%" h={12} /><Skel w="88%" h={12} /><Skel w="94%" h={12} /><Skel w="60%" h={12} />
        </div>
      </aside>
    </>
  );
}

const STATUS_META: Record<LinkedInStatus, { label: string; variant: React.ComponentProps<typeof Badge>['variant'] }> = {
  needs_url:   { label: 'Needs URL',   variant: 'neutral' },
  url_sourced: { label: 'Ready',       variant: 'info' },
  invite_sent: { label: 'Invite sent', variant: 'warning' },
  connected:   { label: 'Connected',   variant: 'success' },
  // Stored as `messaged`; shown as "Contacted" because that is the outcome the
  // board reports. Renaming the stored value would need a data migration.
  messaged:    { label: 'Contacted',   variant: 'active' },
  failed:      { label: 'Failed',      variant: 'danger' },
};

function LinkedInBadge({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden>
      <rect width="24" height="24" rx="4" fill="var(--color-avatar-blue)" />
      <path d="M7 9.5h2.1V17H7zM8.05 6.2a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM10.8 9.5h2v1.02c.28-.53 1.05-1.18 2.27-1.18 2 0 2.6 1.18 2.6 3.18V17h-2.1v-3.1c0-.84-.3-1.42-1.06-1.42-.66 0-1.02.45-1.2.88-.06.16-.07.38-.07.6V17h-2.1z" fill="#fff" />
    </svg>
  );
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* ── collapsible profile section (Apify) ── */

function fmtRange(a?: string | null, b?: string | null): string {
  if (!a && !b) return '';
  return `${a || '?'} – ${b || 'Present'}`;
}

// Count of an account's prospects that are actionable (a URL is sourced, i.e.
// every status except "needs_url"). Uses the whole-account statusRollup.
function actionableCount(a: LinkedInAccount): number {
  return Object.entries(a.statusRollup || {})
    .reduce((n, [status, count]) => (status === 'needs_url' ? n : n + (count || 0)), 0);
}

function ProfileSection({ prospect }: { prospect: LinkedInProspect }) {
  const [open, setOpen] = React.useState(true);
  const [doc, setDoc] = React.useState<LinkedInProfileDoc | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [enriching, setEnriching] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  // Guards against re-firing the auto-enrich for the same prospect after a failure.
  const autoTried = React.useRef<string | null>(null);

  const enrich = React.useCallback(async () => {
    setEnriching(true); setErr(null);
    try { const r = await enrichLinkedInProfile(prospect.id, prospect.runId); setDoc(r.profile); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Enrichment failed'); }
    finally { setEnriching(false); }
  }, [prospect.id, prospect.runId]);

  const load = React.useCallback(async () => {
    setLoading(true); setErr(null);
    let existing: LinkedInProfileDoc | null = null;
    try { const r = await fetchLinkedInProfile(prospect.id); existing = r.profile; setDoc(r.profile); }
    catch { setDoc(null); }
    finally { setLoading(false); }
    // Opening a card auto-enriches it if it hasn't been enriched yet (no button).
    if (!existing?.profile && autoTried.current !== prospect.id) {
      autoTried.current = prospect.id;
      enrich();
    }
  }, [prospect.id, enrich]);

  React.useEffect(() => { load(); }, [load]);

  const p = doc?.profile;
  const cap: React.CSSProperties = { ...liCaps, fontSize: '10px', color: 'var(--color-text-3)', margin: '12px 0 6px' };

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', cursor: 'pointer' }}>
        <span style={liCaps}>Profile</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {doc?.connectionsCount != null && <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>{doc.connectionsCount}+ connections</span>}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-3)', transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s' }}><path d="M2 4L6 8L10 4" /></svg>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 18px 14px' }}>
          {loading || (enriching && !p) ? (
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', padding: '4px 0' }}>
              {enriching ? 'Enriching profile…' : 'Loading…'}
            </div>
          ) : !p ? (
            <EmptyState align="left" icon={EmptyIcons.document}
              title={err ? 'Couldn’t enrich this profile' : 'No profile yet'}
              body={err
                ? 'The automatic enrichment didn’t come back with anything for this prospect.'
                : 'Nothing has been pulled from LinkedIn for this prospect so far.'}
              action={
                <>
                  <button onClick={enrich} disabled={enriching} style={{ ...primaryBtn, opacity: enriching ? 0.6 : 1 }}>
                    {enriching ? 'Enriching…' : 'Retry enrichment'}
                  </button>
                  {err && <div style={{ fontSize: '11.5px', color: 'var(--color-danger-text)', marginTop: '8px' }}>{err}</div>}
                </>
              } />
          ) : (
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-1)', lineHeight: 1.55 }}>
              {p.headline && <div style={{ fontWeight: 600, marginBottom: '2px' }}>{p.headline}</div>}
              <div style={{ color: 'var(--color-text-2)', fontSize: '12px' }}>
                {[p.currentTitle, p.currentCompany].filter(Boolean).join(' · ')}
                {p.totalYears ? ` · ${p.totalYears} yrs exp` : ''}
              </div>
              {p.location && <div style={{ color: 'var(--color-text-3)', fontSize: '11.5px', marginTop: '2px' }}>{p.location}</div>}

              {p.summary && (<><div style={cap}>About</div>
                <div style={{ color: 'var(--color-text-2)', whiteSpace: 'pre-wrap' }}>{p.summary}</div></>)}

              {!!p.experience?.length && (<><div style={cap}>Experience</div>
                {p.experience.slice(0, 6).map((e, i) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    <div style={{ color: 'var(--color-text-2)', fontSize: '12px' }}>{e.company_name}{e.location ? ` · ${e.location}` : ''}</div>
                    <div style={{ color: 'var(--color-text-3)', fontSize: '11px' }}>{fmtRange(e.starts_at, e.ends_at)}</div>
                  </div>
                ))}</>)}

              {!!p.education?.length && (<><div style={cap}>Education</div>
                {p.education.slice(0, 4).map((e, i) => (
                  <div key={i} style={{ marginBottom: '6px' }}>
                    <div style={{ fontWeight: 600 }}>{e.school_name}</div>
                    <div style={{ color: 'var(--color-text-2)', fontSize: '12px' }}>{[e.degree_name, e.field_of_study].filter(Boolean).join(', ')}</div>
                  </div>
                ))}</>)}

              {!!p.skills?.length && (<><div style={cap}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {p.skills.slice(0, 18).map((s, i) => (
                    <span key={i} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' }}>{s}</span>
                  ))}
                </div></>)}

              {!!p.certifications?.length && (<><div style={cap}>Certifications</div>
                {p.certifications.slice(0, 6).map((c, i) => (
                  <div key={i} style={{ color: 'var(--color-text-2)' }}>{c.name}{c.authority ? ` — ${c.authority}` : ''}</div>
                ))}</>)}

              {!!p.languages?.length && (<><div style={cap}>Languages</div>
                <div style={{ color: 'var(--color-text-2)' }}>{p.languages.map(l => l.name + (l.proficiency ? ` (${l.proficiency})` : '')).join(', ')}</div></>)}

              <button onClick={enrich} disabled={enriching} style={{ ...ghostBtn, padding: '4px 10px', fontSize: '11.5px', marginTop: '12px', opacity: enriching ? 0.6 : 1 }}>
                {enriching ? 'Refreshing…' : 'Refresh profile'}
              </button>
              {err && <div style={{ fontSize: '11.5px', color: 'var(--color-danger-text)', marginTop: '8px' }}>{err}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── communication history timeline (email + LinkedIn) ── */

const COMM_LABEL: Record<CommEvent['type'], string> = {
  email_sent: 'Email sent',
  email_reply: 'Replied',
  email_failed: 'Email failed / bounced',
  invite_sent: 'LinkedIn invite sent',
  invite_accepted: 'Invite accepted',
  message_sent: 'Follow-up sent',
};

function CommIcon({ channel }: { channel: CommEvent['channel'] }) {
  if (channel === 'email') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
      </svg>
    );
  }
  return <LinkedInBadge size={13} />;
}

function CommunicationHistory({ prospectId, runId }: { prospectId: string; runId?: string | null }) {
  const [events, setEvents] = React.useState<CommEvent[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCommunicationHistory(prospectId, runId)
      .then(r => { if (alive) setEvents(r.events || []); })
      .catch(() => { if (alive) setEvents([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [prospectId, runId]);

  const count = events?.length ?? 0;

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '14px 18px 10px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={liCaps}>Communication history</span>
          {count > 0 && <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-3)', background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: '999px', padding: '1px 7px' }}>{count}</span>}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--color-text-3)" strokeWidth="2" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="2,4 6,8 10,4" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px' }}>
          {loading ? (
            <div style={{ fontSize: '13px', color: 'var(--color-text-3)', padding: '8px 0' }}>Loading…</div>
          ) : count === 0 ? (
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', padding: '8px 0' }}>No contact yet — outreach starts once this prospect is in scope.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {(events as CommEvent[]).map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', padding: '9px 0', borderBottom: i < count - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%', background: e.channel === 'email' ? 'var(--color-brand-subtle)' : 'var(--color-brand)', color: e.channel === 'email' ? 'var(--color-brand)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CommIcon channel={e.channel} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)' }}>{COMM_LABEL[e.type]}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{e.at ? formatDateTime(e.at) : ''}</span>
                    </div>
                    {e.subject ? <div style={{ fontSize: '11.5px', color: 'var(--color-text-2)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject}</div> : null}
                     {e.snippet && e.type !== 'email_sent' ? <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '1px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.snippet}</div> : null}
                     {e.channel === 'linkedin' && (e.accountUsername || e.accountUserId) ? <div style={{ fontSize: '10.5px', color: 'var(--color-text-3)', marginTop: '2px' }}>Account: {e.accountUsername || e.accountUserId}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── intent panel (latest posts) ── */

function IntentPanel({ prospect, onClose, onRefresh, onAction, onDone, doneBusy }: {
  prospect: LinkedInProspect; onClose: () => void; onRefresh: () => void;
  onAction: (kind: 'source' | 'invite' | 'check' | 'message', draft?: string) => Promise<boolean>;
  /** Marks this prospect's invite task done for today (drops it from the worklist
   *  and pulls in the next candidate). Undefined for non-worklist prospects. */
  onDone?: () => void;
  doneBusy?: boolean;
}) {
  const [posts, setPosts] = React.useState<LinkedinPost[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastAt, setLastAt] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchLinkedInIntent(prospect.id);
      setPosts(r.posts || []);
      setLastAt(r.lastEnrichedAt);
    } catch { setPosts([]); }
    finally { setLoading(false); }
  }, [prospect.id]);

  React.useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshLinkedInIntent(prospect.id, prospect.runId, 10);
      // Enrichment is async; poll the intent a few times.
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 2500));
        const r = await fetchLinkedInIntent(prospect.id);
        if ((r.posts?.length ?? 0) > 0) { setPosts(r.posts); setLastAt(r.lastEnrichedAt); break; }
      }
      onRefresh();
    } finally { setRefreshing(false); }
  };

  const canScrape = prospect.linkedin.status === 'connected' || prospect.linkedin.status === 'messaged';

  return (
    <aside style={{ flex: '60 1 0', minWidth: '360px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {prospect.linkedin.profileUrl ? (
                <a href={prospect.linkedin.profileUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                  {prospect.name}
                </a>
              ) : (
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)' }}>{prospect.name}</span>
              )}
              <LinkedInBadge />
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', marginTop: '3px' }}>{prospect.title}</div>
          </div>
          <button onClick={onClose} title="Close" style={{ width: '26px', height: '26px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-3)', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ProfileSection prospect={prospect} />
        <CommunicationHistory prospectId={prospect.id} runId={prospect.runId} />
        <div style={{ padding: '14px 18px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={liCaps}>Real-time intent</span>
          {canScrape && (
            <button onClick={refresh} disabled={refreshing} style={{ ...ghostBtn, padding: '4px 10px', fontSize: '11.5px', opacity: refreshing ? 0.6 : 1 }}>
              {refreshing ? 'Scraping…' : 'Refresh posts'}
            </button>
          )}
        </div>
        {lastAt && <div style={{ padding: '0 18px 6px', fontSize: '11px', color: 'var(--color-text-3)' }}>Updated {timeAgo(lastAt)}</div>}
        <div style={{ padding: '8px 18px 18px' }}>
        {loading ? (
          <div style={{ fontSize: '13px', color: 'var(--color-text-3)', padding: '12px 0' }}>Loading…</div>
        ) : !posts || posts.length === 0 ? (
          <EmptyState icon={EmptyIcons.pulse}
            title={canScrape ? 'No posts scraped yet' : 'Intent unlocks after connecting'}
            body={canScrape
              ? 'Use “Refresh posts” above to pull their latest LinkedIn activity.'
              : 'Once this prospect accepts your invite, their recent posts and reactions show up here.'} />
        ) : posts.map((p, i) => (
          <div key={p.urnId || i} style={{ display: 'flex', gap: '10px', padding: '12px 0', borderBottom: i < posts.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <LinkedInBadge size={18} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-2)' }}>LinkedIn</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>· {timeAgo(p.postedAt)}</span>
              </div>
              <div style={{ fontSize: '12.5px', lineHeight: 1.5, color: 'var(--color-text-1)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {p.text || '(media post)'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '4px' }}>
                {p.reactions?.total ?? 0} reactions · {p.comments ?? 0} comments · {p.shares ?? 0} shares
              </div>
              {p.postUrl && <a href={p.postUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-brand)', textDecoration: 'none' }}>Open post ↗</a>}
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* pinned compose dock — same anatomy and height as the Emails tab's draft
          dock (header · recipient · COMPOSE_BODY_HEIGHT body · action bar) so the
          panel doesn't change length when you switch tabs */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: COMPOSE_DOCK_PADDING }}>
        <ActionBar prospect={prospect} onAction={onAction} onDone={onDone} doneBusy={doneBusy} embedded />
      </div>
    </aside>
  );
}

/* ── contextual action bar (source / invite / check / message) ── */

function ActionBar({ prospect, onAction, onDone, doneBusy = false, embedded = false }: {
  prospect: LinkedInProspect;
  onAction: (kind: 'source' | 'invite' | 'check' | 'message', draft?: string) => Promise<boolean>;
  onDone?: () => void;
  doneBusy?: boolean;
  embedded?: boolean;
}) {
  const status = prospect.linkedin.status;
  // "Mark as done" replaces the per-card skip: it's only meaningful for pending
  // invite candidates (not yet invited/connected/messaged). Once the worklist task
  // is done, the button flips to a non-actionable "Done" chip.
  const isTaskDone = prospect.taskStatus === 'done';
  const canMarkDone = !!onDone && (isTaskDone || (status !== 'invite_sent' && status !== 'connected' && status !== 'messaged'));
  const [draft, setDraft] = React.useState('');
  const [templateConfigured, setTemplateConfigured] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [showMessage, setShowMessage] = React.useState(false);
  // Invites are queued and paced server-side (durable send queue) — no frontend cooldown.
  const isInviteFlow = status === 'url_sourced' || status === 'failed';
  const isMessageFlow = status === 'connected' || status === 'messaged';
  const draftType: 'invite' | 'message' | null = isInviteFlow ? 'invite' : isMessageFlow ? 'message' : null;

  React.useEffect(() => {
    setShowMessage(false);
    let alive = true;
    // Pre-fetch the default template for BOTH flows: the connection message (shown
    // straight away) and the invite note (revealed when the user clicks "Add
    // Message"). The backend resolves this to the campaign's default LinkedIn
    // template, or the user's first template.
    if (draftType) {
        fetchLinkedInDraft(prospect.id, prospect.runId, draftType)
        .then(r => { if (alive) { setDraft(r.draft); setTemplateConfigured(r.templateConfigured !== false); } })
        .catch(() => { if (alive) { setDraft(''); setTemplateConfigured(false); } });
    } else { setDraft(''); setTemplateConfigured(true); }
    return () => { alive = false; };
  }, [prospect.id, prospect.runId, draftType]);

  const run = async (kind: 'source' | 'invite' | 'check' | 'message') => {
    setBusy(true);
    try {
      // The invite note stays opt-in: only send template text the user actually
      // revealed via "Add Message" (an un-opened note must not burn the monthly
      // personalized-invite quota). Messages always send the composed draft.
      const outgoing = kind === 'invite' ? (showMessage ? draft : '') : draft;
      await onAction(kind, outgoing || undefined);
    } finally { setBusy(false); }
  };

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // The note box is always the same height whether or not a note is being
  // written — an empty state stands in for the textarea. Rendering the textarea
  // only on demand is what made this dock collapse to a third of the Emails
  // dock's height. It also has to stay opt-in: a note the user never opened must
  // not be sent, because personalized invites are a monthly quota.
  const composing = showMessage || isMessageFlow;
  const noteLabel = isInviteFlow ? 'Invite note' : isMessageFlow
    ? (templateConfigured ? 'Message' : 'Write follow-up message') : 'LinkedIn task';

  const body = composing ? (
    <textarea
      ref={textareaRef}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      maxLength={isInviteFlow ? 300 : undefined}
      placeholder={isMessageFlow && !templateConfigured
        ? 'No follow-up template is set for this campaign. Write your message…'
        : `Write your ${isInviteFlow ? 'invite message' : 'message'}…`}
      style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '12.5px', lineHeight: 1.6, fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)', border: 0, borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', resize: 'none', display: 'block' }}
    />
  ) : status === 'needs_url' ? (
    <EmptyState variant="panel" icon={EmptyIcons.search}
      title="No LinkedIn profile yet"
      body="Source this prospect's profile URL to unlock the invite." />
  ) : isInviteFlow ? (
    <EmptyState variant="panel" icon={EmptyIcons.userPlus}
      title="Sending without a note"
      body={<>Plain invites are unlimited. Choose <strong>Add Message</strong> to attach a personalized note — those draw from your monthly quota.</>} />
  ) : (
    <EmptyState variant="panel" icon={EmptyIcons.check}
      title="Invite sent"
      body="Check back for the acceptance, then a message box opens here." />
  );

  return (
    <div style={embedded
      ? { padding: 0, background: 'transparent' }
      : { padding: '12px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span style={liCaps}>{noteLabel}</span>
        {isInviteFlow && composing && (
          <span style={{ fontSize: '11px', color: draft.length > 280 ? 'var(--color-danger-text)' : 'var(--color-text-3)' }}>
            {draft.length}/300
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', marginBottom: '12px', fontSize: '12.5px', lineHeight: 1.6 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ color: 'var(--color-text-3)' }}>To </span>
          <span style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>{prospect.name}</span>
        </div>
        <span style={{ width: '1px', height: '13px', background: 'var(--color-border-2)', flexShrink: 0 }} />
        <Badge variant={STATUS_META[status].variant}>{STATUS_META[status].label}</Badge>
        {prospect.linkedin.error && <span style={{ fontSize: '11px', color: 'var(--color-danger-text)' }}>{prospect.linkedin.error}</span>}
      </div>

      <div style={{ height: `${COMPOSE_BODY_HEIGHT}px`, display: 'flex', border: `1px solid ${composing ? 'var(--color-brand)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', overflow: 'hidden' }}>
        {body}
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-border)' }}>
        {canMarkDone && (
          isTaskDone ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: 'auto', padding: '7px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--color-success-text)', background: 'var(--color-success-subtle)', borderRadius: 'var(--radius-md)' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2.5,7.5 6,11 11.5,3.5" /></svg>
              Done
            </span>
          ) : (
            <button style={{ ...ghostBtn, opacity: doneBusy ? 0.6 : 1, cursor: doneBusy ? 'default' : 'pointer', marginRight: 'auto' }}
              disabled={doneBusy}
              title="Mark this invite done for today (counts toward your daily LinkedIn goal)"
              onClick={() => onDone?.()}>{doneBusy ? 'Marking…' : 'Mark as done'}</button>
          )
        )}
        {status === 'needs_url' && <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => run('source')}>{busy ? 'Sourcing…' : 'Source LinkedIn URL'}</button>}
        {isInviteFlow && (
          <>
            {(() => {
              const q = prospect.queueStatus;
              const disabled = busy || !!q;
              return (
                <button style={{ ...primaryBtn, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                  disabled={disabled}
                  title={q ? 'This invite is queued to send' : 'Send a LinkedIn connection invite'}
                  onClick={() => run('invite')}>
                  {busy ? 'Queuing…' : q === 'sending' ? 'Sending…' : q ? 'Queued' : 'Send invite'}
                </button>
              );
            })()}
            {/* Toggles visibility only — the pre-fetched template draft is kept so
                removing and re-adding a note doesn't lose it. `run()` already
                sends an empty note whenever this is closed. */}
            {!showMessage
              ? <button style={ghostBtn} onClick={() => { setShowMessage(true); setTimeout(() => textareaRef.current?.focus(), 50); }}>Add Message</button>
              : <button style={ghostBtn} onClick={() => setShowMessage(false)}>Remove message</button>
            }
          </>
        )}
        {status === 'invite_sent' && <button style={{ ...ghostBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => run('check')}>{busy ? 'Checking…' : 'Check if accepted'}</button>}
        {/* No "Add Message" here: the message box is always open in this flow. */}
        {isMessageFlow && (
           <button style={{ ...primaryBtn, opacity: busy || !draft.trim() ? 0.6 : 1 }} disabled={busy || !draft.trim()} onClick={() => run('message')}>{busy ? 'Sending…' : status === 'messaged' ? 'Send another message' : 'Send message'}</button>
        )}
      </div>
    </div>
  );
}

/* ── account row ── */

function AccountRow({ acc, expanded, onToggle, selectedProspect, onSelect, followUpMode = false }: {
  acc: LinkedInAccount; expanded: boolean; onToggle: () => void;
  selectedProspect: LinkedInProspect | null; onSelect: (p: LinkedInProspect) => void;
  followUpMode?: boolean;
}) {
  const [hov, setHov] = React.useState(false);
  // Follow-up mode lists everyone we emailed (even those still needing a sourced
  // URL); the normal pipeline view hides un-sourced prospects. Marked-done tasks
  // sink to the end of the card row (parity with the Emails tab).
  const visibleProspects = (followUpMode ? acc.prospects : acc.prospects.filter(p => p.linkedin.status !== 'needs_url'))
    .slice()
    .sort((a, b) => Number(a.taskStatus === 'done') - Number(b.taskStatus === 'done'));
  const shownCount = followUpMode ? acc.prospects.length : actionableCount(acc);
  // Every task in this account handled today → dim + strike the whole row (parity
  // with the Emails tab); the board also sinks these accounts to the bottom.
  const allDone = followUpMode && acc.prospects.length > 0 && acc.prospects.every(p => p.taskStatus === 'done');
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)', opacity: allDone ? 0.6 : 1 }}>
      <div onClick={onToggle} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', cursor: 'pointer', background: hov || expanded ? 'var(--color-row-hover)' : 'var(--color-bg)', minHeight: '50px' }}>
        {allDone && (
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}><circle cx="7" cy="7" r="7" fill="var(--color-success, var(--color-brand))" /><polyline points="4,7.2 6.2,9.2 10,4.8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: allDone ? 'line-through' : 'none' }}>{acc.companyName}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[acc.industry, acc.location].filter(Boolean).join(' · ') || `${shownCount} prospect${shownCount === 1 ? '' : 's'}`}
          </div>
        </div>
        <span style={{ fontSize: '11.5px', color: 'var(--color-text-2)' }}>{shownCount} prospect{shownCount === 1 ? '' : 's'}</span>
        {followUpMode && (() => {
          // Inline campaign label (matches the Emails "Initiate new contact" rows);
          // falls back to the run name when the account has no campaign.
          const label = acc.campaignName || acc.runName;
          if (!label) return null;
          const isRun = !acc.campaignName;
          return (
            <span title={`${isRun ? 'Run' : 'Campaign'}: ${label}`}
              style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '3px 9px', borderRadius: 'var(--radius-full)', flexShrink: 0, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </span>
          );
        })()}
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-text-3)', transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s' }}>
          <path d="M2 4L6 8L10 4" />
        </svg>
      </div>

      {expanded && (
        <div style={{ padding: '4px 20px 18px 24px', background: 'var(--color-row-hover)' }}>
          {visibleProspects.length === 0 ? (
            <EmptyState align="left" icon={EmptyIcons.users}
              title={followUpMode ? 'No prospects to follow up here' : 'No sourced profiles yet'}
              body={followUpMode
                ? 'Everyone at this account has either replied or been contacted on LinkedIn already.'
                : 'This account\'s prospects need a LinkedIn URL sourced before they can be invited.'} />
          ) : (
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '10px 0 4px' }}>
              {visibleProspects.map(p => (
                <ProspectCard
                  key={p.id}
                  name={p.name}
                  role={p.title || ''}
                  selected={p.id === selectedProspect?.id}
                  onClick={() => onSelect(p)}
                  width={220}
                  done={p.taskStatus === 'done'}
                  badge={p.taskStatus === 'done'
                    ? <Badge variant="success">Done</Badge>
                    : <Badge variant={STATUS_META[p.linkedin.status].variant}>{STATUS_META[p.linkedin.status].label}</Badge>}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── main board ── */

export function LinkedInBoardLive({ campaignId, goal, onStats }: { campaignId?: string | null; goal?: number; onStats?: (s: LinkedInStats) => void }) {
  const [accounts, setAccounts] = React.useState<LinkedInAccount[]>([]);
  const [recent, setRecent] = React.useState<LinkedInProspect[]>([]);
  const [followUps, setFollowUps] = React.useState<LinkedInAccount[]>([]);
  const [followUpWindow, setFollowUpWindow] = React.useState<number | null>(null);
  // Bounded worklist counters (invites done / today's per-campaign goal).
  const [wlGoal, setWlGoal] = React.useState(0);
  const [wlDone, setWlDone] = React.useState(0);
  const [markingId, setMarkingId] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [syncNote, setSyncNote] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<LinkedInProspect | null>(null);

  const onStatsRef = React.useRef(onStats);
  React.useEffect(() => { onStatsRef.current = onStats; }, [onStats]);

  const load = React.useCallback(async (keepSelection = false) => {
    try {
      // Accounts (recently-accepted) + the bounded invite worklist (per-campaign,
      // per-day goal) in parallel; a worklist failure must not blank the whole board.
      const [r, wl] = await Promise.all([
        fetchLinkedInAccounts(campaignId ?? undefined, 1, 50),
        fetchLinkedInWorklist().catch(() => ({ accounts: [] as LinkedInAccount[], windowDays: 0, goal: 0, done: 0 })),
      ]);
      setAccounts(r.accounts);
      setRecent(r.recentlyConnected);
      setFollowUps(wl.accounts);
      setFollowUpWindow(wl.windowDays || null);
      setWlGoal(wl.goal || 0);
      setWlDone(wl.done || 0);
      onStatsRef.current?.({ done: wl.done || 0, goal: wl.goal || 0 });
      setError(null);
      if (!keepSelection) {
        // Auto-select a prospect on first load so the side panel opens by default.
        const firstAcc = wl.accounts.find(a => a.prospects.length > 0) ?? r.accounts.find(a => a.prospects.length > 0);
        const auto = r.recentlyConnected[0] ?? firstAcc?.prospects[0] ?? null;
        const autoCompany = r.recentlyConnected[0]?.companyName ?? firstAcc?.companyName ?? null;
        if (auto) setSelected(s => s ?? auto);
        setExpanded(e => e ?? autoCompany);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load LinkedIn accounts');
    } finally { setLoading(false); }
  }, [campaignId]);

  React.useEffect(() => { load(); }, [load]);

  // Live-sync accepted invites from the user's own LinkedIn connections, then reload.
  const syncAccepted = React.useCallback(async () => {
    setSyncing(true); setSyncNote(null);
    try {
      const r = await syncLinkedInAccepted(campaignId ?? undefined);
      await load(true);
      setSyncNote(r.matched > 0 ? `${r.matched} newly accepted` : 'No new acceptances');
    } catch (e) {
      setSyncNote(e instanceof Error ? e.message : 'Sync failed — is LinkedIn connected?');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncNote(null), 4000);
    }
  }, [campaignId, load]);

  // Patch one prospect's state locally across accounts + follow-ups + recent + selection.
  const patchProspect = React.useCallback((id: string, patch: Partial<LinkedInProspect['linkedin']>) => {
    const apply = (p: LinkedInProspect): LinkedInProspect =>
      p.id === id ? { ...p, linkedin: { ...p.linkedin, ...patch } } : p;
    const patchAccts = (accs: LinkedInAccount[]) => accs.map(a => ({ ...a, prospects: a.prospects.map(apply) }));
    setAccounts(patchAccts);
    setFollowUps(patchAccts);
    setRecent(rs => rs.map(apply));
    setSelected(s => (s && s.id === id ? { ...s, linkedin: { ...s.linkedin, ...patch } } : s));
  }, []);

  const handleAction = React.useCallback(async (
    prospect: LinkedInProspect,
    kind: 'source' | 'invite' | 'check' | 'message',
    draft?: string,
  ): Promise<boolean> => {
    try {
      if (kind === 'source') {
        const r = await sourceLinkedInUrl(prospect.id, prospect.runId);
        patchProspect(prospect.id, { status: r.status, profileUrl: r.profileUrl, error: null });
      } else if (kind === 'invite') {
        await sendLinkedInInvite(prospect.id, prospect.runId, draft);
        // Queued on the durable, per-user-paced send queue. The reload brings the live
        // queueStatus chip; the lifecycle status advances to invite_sent once the worker
        // actually sends it.
        patchProspect(prospect.id, { error: null });
        load(true);
      } else if (kind === 'check') {
        const r = await checkLinkedInConnection(prospect.id, prospect.runId);
        patchProspect(prospect.id, { status: r.status });
        if (r.connected) load(true);
      } else if (kind === 'message') {
        const r = await sendLinkedInMessage(prospect.id, prospect.runId, draft);
        patchProspect(prospect.id, { status: r.status, error: null });
        // Messaging is what retires someone from the accepted-invites queue, and
        // that list is built server-side. Without this reload the card stayed put
        // until the next manual refresh, still asking to be contacted.
        load(true);
      }
      return true;
    } catch (e) {
      // Rate-limit back-off is now handled server-side by the send queue; here we just
      // surface the specific reason (expired session, no URL, not connected, etc.).
      patchProspect(prospect.id, { error: e instanceof Error ? e.message : 'Action failed' });
      return false;
    }
  }, [patchProspect, load]);

  // Mark one invite task done for today → keeps its slot and counts toward the
  // day's goal, so the done/goal counter (e.g. 2/6) advances. Counters + ring
  // update from the response; the completed card stays with a "Done" state.
  const handleMarkDone = React.useCallback(async (prospect: LinkedInProspect) => {
    setMarkingId(prospect.id);
    try {
      const res = await markLinkedInTaskDone(prospect.id);
      setFollowUps(res.accounts);
      setFollowUpWindow(res.windowDays || null);
      setWlGoal(res.goal || 0);
      setWlDone(res.done || 0);
      onStatsRef.current?.({ done: res.done || 0, goal: res.goal || 0 });
      // Reflect the completed task on the open panel so its button flips to "Done".
      setSelected(s => (s && s.id === prospect.id ? { ...s, taskStatus: 'done' } : s));
    } catch {
      /* leave the card in place on failure */
    } finally {
      setMarkingId(null);
    }
  }, []);

  if (loading) return <LinkedInSkeleton />;
  if (error) return <div style={{ flex: 1, padding: '40px', color: 'var(--color-danger-text)' }}>{error}</div>;

  if (accounts.length === 0) {
    return (
      <EmptyState variant="page" tone="brand" icon={EmptyIcons.linkedin}
        title="No accounts yet"
        body="Imported companies show up here as accounts, and their prospects flow into the invite → connect → message pipeline."
        action={
          <Link href="/campaigns" style={{ textDecoration: 'none' }}>
            <button style={{ ...primaryBtn, padding: '9px 22px', fontSize: '13.5px' }}>Create a campaign →</button>
          </Link>
        } />
    );
  }

  // Accepted invites = people who accepted and have NOT been messaged yet. The
  // server drops them the moment they are messaged, so this is a queue that can be
  // worked to empty — it is no longer a "recent N" window, hence the header no
  // longer says "recently".
  const recentInvites = recent;

  return (
    <>
      <style>{`@keyframes liSpin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ flex: '40 1 0', overflowY: 'auto', minWidth: 0 }}>
        {/* Recently Accepted Invites — connections that accepted, live-syncable */}
        <div>
          <div style={{ background: 'var(--color-surface)', borderLeft: '4px solid var(--color-brand)', padding: '14px 24px 14px 20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)' }}>
            <SectionIcon>{InvitesIcon}</SectionIcon>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Accepted Invites</span>
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>Waiting for your first message</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '3px 9px', borderRadius: 'var(--radius-full)' }}>{recentInvites.length}</span>
            {/* "Sync from LinkedIn" button temporarily removed per request; the
                syncAccepted handler + state are kept intact for easy re-add. */}
          </div>
          {recentInvites.length > 0 ? (
            <div style={{ padding: '14px 24px 14px', display: 'flex', gap: '12px', overflowX: 'auto' }}>
              {recentInvites.map(p => (
                <ProspectCard
                  key={p.id}
                  name={p.name}
                  role={p.title || ''}
                   company={p.companyName}
                  selected={selected?.id === p.id}
                  onClick={() => {
                    setSelected(p);
                    if (p.companyName) setExpanded(p.companyName);
                  }}
                   icon={<LinkedInBadge />}
                   width={240}
                   badge={
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
                       {p.campaignName && (
                         <span title={`Campaign: ${p.campaignName}`} style={{ maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: 600, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '3px 8px', borderRadius: 'var(--radius-full)' }}>
                           {p.campaignName}
                         </span>
                       )}
                       <Badge variant={STATUS_META[p.linkedin.status].variant}>{STATUS_META[p.linkedin.status].label}</Badge>
                     </div>
                   }
                 />
              ))}
            </div>
          ) : (
            <EmptyState icon={EmptyIcons.userPlus}
              title="No accepted invites yet"
              body="When someone accepts your connection request they land here, waiting for a first message." />
          )}
        </div>

        {/* Follow-up the contacts — bounded to each campaign's per-day LinkedIn goal.
            Emailed with no reply past the window; skipping one pulls in the next. */}
        <div style={{ borderTop: '3px solid var(--color-border)' }}>
          <div style={{ background: 'var(--color-surface)', borderLeft: '4px solid var(--color-brand)', padding: '14px 24px 14px 20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)' }}>
            <SectionIcon>{AccountsIcon}</SectionIcon>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Follow-up the contacts</span>
            {followUpWindow != null && (
              <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>
                No email reply in {followUpWindow}+ day{followUpWindow === 1 ? '' : 's'}
              </span>
            )}
            <span title="Invites sent today / your daily LinkedIn goal" style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '3px 9px', borderRadius: 'var(--radius-full)', marginLeft: 'auto' }}>{wlDone}/{wlGoal}</span>
          </div>
          <div>
            {followUps.length === 0 ? (
              wlGoal === 0 ? (
                <EmptyState icon={EmptyIcons.users}
                  title="No LinkedIn follow-up goal today"
                  body="Your recently accepted invites are shown above. Set a LinkedIn goal for today to add follow-up tasks here." />
              ) : (
              wlDone >= wlGoal && wlGoal > 0 ? (
                <EmptyState icon={EmptyIcons.check} tone="success"
                  title={`All ${wlGoal} invite${wlGoal === 1 ? '' : 's'} done for today`}
                  body="Nice work — new follow-up candidates appear tomorrow." />
              ) : (
                <EmptyState icon={EmptyIcons.users}
                  title="Nobody to follow up yet"
                  body={`Prospects show up here once an outreach email has gone unanswered for ${followUpWindow ?? 2}+ days.`} />
              )
              )
            ) : [...followUps]
              // Fully-done accounts sink to the bottom (parity with the Emails tab);
              // otherwise newest campaign first (by campaign creation), matching the
              // sidebar + My Tasks worklist. Stable sort keeps the backend's
              // most-overdue order within each campaign; no-campaign accounts last.
              .sort((a, b) => {
                const doneW = (acc: LinkedInAccount) => (acc.prospects.length > 0 && acc.prospects.every(p => p.taskStatus === 'done')) ? 1 : 0;
                return (doneW(a) - doneW(b)) || (oidTime(b.campaignId) - oidTime(a.campaignId));
              })
              .map(acc => (
                <AccountRow key={acc.companyName} acc={acc}
                  expanded={expanded === acc.companyName}
                  onToggle={() => setExpanded(e => e === acc.companyName ? null : acc.companyName)}
                  selectedProspect={selected}
                  onSelect={setSelected}
                  followUpMode />
              ))}
          </div>
        </div>
      </div>

      {selected ? (
        <IntentPanel prospect={selected} onClose={() => setSelected(null)} onRefresh={() => load(true)}
          onAction={(kind, draft) => handleAction(selected, kind, draft)}
          onDone={() => handleMarkDone(selected)}
          doneBusy={markingId === selected.id} />
      ) : (
        /* Keeps the two-column layout intact when nothing is open — closing a
           prospect used to reflow the whole board to full width. */
        <aside style={{ flex: '60 1 0', minWidth: '360px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
          <EmptyState variant="panel" icon={EmptyIcons.linkedin}
            title="No prospect selected"
            body="Pick someone from the accepted invites or a follow-up account to see their profile, live intent and invite composer." />
        </aside>
      )}
    </>
  );
}
