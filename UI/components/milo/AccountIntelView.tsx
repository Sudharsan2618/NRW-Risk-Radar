'use client';
import React, { ReactNode } from 'react';
import {
  researchAccount,
  ResearchReport,
  CompanyProfile,
  SrcKind,
  BuyingSignalItem,
  HiringMetric,
  LeadershipHire,
  Promotion,
  IntentItem,
  OverviewBrief,
  JobPostingsResult,
  ReviewsResult,
  TopicsResult,
  ReportChange,
  VersionInfo,
  EMPTY_REPORT,
  PARTIAL_KEY,
  CachedCompany,
  fetchCompanies,
  fetchHealth,
  fetchReport,
  fetchVersions,
  fetchVersion,
} from '@/lib/accountIntel';

// ───────────────────────── source badge ─────────────────────────
const AI_SRC_STYLE: Record<SrcKind, { bg: string; color: string }> = {
  linkedin: { bg: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' },
  web: { bg: 'var(--color-surface)', color: 'var(--color-text-2)' },
  news: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
  feeds: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
  x: { bg: '#1E1F21', color: '#FFFFFF' },
};

function AISourceBadge({ kind, size = 32 }: { kind: SrcKind; size?: number }) {
  const s = AI_SRC_STYLE[kind] || AI_SRC_STYLE.web;
  const Ic: Record<SrcKind, ReactNode> = {
    linkedin: <span style={{ fontWeight: 800, fontSize: size * 0.42, letterSpacing: '-0.5px' }}>in</span>,
    web: <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.5" /><line x1="1.5" y1="8" x2="14.5" y2="8" /><path d="M8 1.5C10 4 10 12 8 14.5M8 1.5C6 4 6 12 8 14.5" /></svg>,
    news: <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><rect x="1.5" y="3" width="13" height="10" rx="1" /><line x1="4" y1="6" x2="8" y2="6" /><line x1="4" y1="8" x2="11" y2="8" /><line x1="4" y1="10" x2="11" y2="10" /></svg>,
    feeds: <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="3.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" /><path d="M3 8a5 5 0 0 1 5 5" /><path d="M3 3.5a9.5 9.5 0 0 1 9.5 9.5" /></svg>,
    x: <span style={{ fontWeight: 800, fontSize: size * 0.46 }}>𝕏</span>,
  };
  return (
    <div style={{ width: size, height: size, borderRadius: '7px', flexShrink: 0, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {Ic[kind] || Ic.web}
    </div>
  );
}

// ───────────────────────── avatar helpers ─────────────────────────
const TONES = ['var(--color-avatar-blue)', 'var(--color-avatar-purple)', 'var(--color-avatar-amber)', 'var(--color-avatar-green)', 'var(--color-avatar-pink)'];
function toneFor(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return TONES[Math.abs(h) % TONES.length];
}
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

const SIGNAL_STYLE: Record<string, { bg: string; color: string }> = {
  green: { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' },
  yellow: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
  orange: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
  red: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' },
};

const AI_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'buying', label: 'Buying Signals' },
  { id: 'jobs', label: 'Job Postings' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'topics', label: 'Topics' },
  { id: 'hiring', label: 'Hiring Trends' },
  { id: 'intent', label: 'Real-Time Intent' },
];

// ═══════════════════════ Buying Signals tab ═══════════════════════
function BuyingSignalsTab({ data, company }: { data: ResearchReport['buying_signals']; company: string }) {
  const sig = SIGNAL_STYLE[data.signal] || SIGNAL_STYLE.orange;
  return (
    <div style={{ padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--color-text-2)' }}>{company.toUpperCase()}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginTop: '2px' }}>Recent buying signals</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: 'var(--radius-full)', background: sig.bg, color: sig.color, fontSize: '12px', fontWeight: 700 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: sig.color }} />
          {data.signal_label}
        </span>
      </div>

      {data.signal_summary && (
        <div style={{ fontSize: '13px', color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', lineHeight: 1.5 }}>
          {data.signal_summary}
        </div>
      )}

      <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
        {data.items.length === 0 ? (
          <Empty msg="No buying signals found." />
        ) : data.items.map((it: BuyingSignalItem, i: number) => (
          <a key={i} href={it.url || '#'} target="_blank" rel="noreferrer" style={{
            display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '16px', alignItems: 'center',
            padding: '14px 20px', textDecoration: 'none',
            borderBottom: i === data.items.length - 1 ? 'none' : '1px solid var(--color-border)',
            background: it.highlight ? 'var(--color-brand-tint)' : 'transparent',
          }}>
            <AISourceBadge kind={it.src} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-1)', lineHeight: 1.35 }}>{it.title}</div>
              {it.sub && <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', marginTop: '4px', lineHeight: 1.4 }}>{it.sub}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{it.tag}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════ Hiring Trends tab ═══════════════════════
function HiringTrendsTab({ data, company }: { data: ResearchReport['hiring_trends']; company: string }) {
  const Card = ({ title, children, pad = true }: { title: string; children: ReactNode; pad?: boolean }) => (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-1)' }}>{title}</div>
      <div style={pad ? { padding: '18px' } : undefined}>{children}</div>
    </div>
  );

  return (
    <div style={{ padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--color-text-2)' }}>{company.toUpperCase()}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginTop: '2px' }}>Talent hub & hiring trends</div>
        </div>
        {data.derived && (
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
            Derived · best-effort
          </span>
        )}
      </div>

      {data.summary && (
        <div style={{ fontSize: '13px', color: 'var(--color-text-2)', lineHeight: 1.5 }}>{data.summary}</div>
      )}

      {data.metrics.length > 0 && (
        <Card title="Hiring metrics">
          {/* Wider min-width + room to breathe: metric detail can run long, and
              a cramped column made the text spill over its card. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {data.metrics.map((m: HiringMetric, i: number) => (
              <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '18px 20px', minHeight: '132px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-success-text)', lineHeight: 1.15, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{m.label}</div>
                {m.detail && <div style={{ fontSize: '12px', color: 'var(--color-text-3)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{m.detail}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.sources?.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-3)', fontWeight: 700 }}>Sources</span>
          {data.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" title={s.url}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 11px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '11.5px', fontWeight: 600, color: 'var(--color-brand-text)', textDecoration: 'none', maxWidth: '340px' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label || s.url}</span>
              <span aria-hidden style={{ color: 'var(--color-text-3)' }}>↗</span>
            </a>
          ))}
        </div>
      )}

      <Card title="New leadership hires">
        {data.hires.length === 0 ? <Empty msg="No recent hires found." inline /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {data.hires.map((h: LeadershipHire, i: number) => (
              <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-row-hover)' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '10px', background: toneFor(h.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 700, flexShrink: 0 }}>{initials(h.name)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text-1)' }}>{h.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-2)', marginTop: '2px' }}>{h.title}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {h.from_company && <span style={{ padding: '2px 9px', borderRadius: 'var(--radius-full)', background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)', fontSize: '11px', fontWeight: 600 }}>{h.from_company}</span>}
                    {h.start && <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)', alignSelf: 'center' }}>{h.start}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent promotions" pad={false}>
        {data.promotions.length === 0 ? <Empty msg="No promotions found." inline /> : data.promotions.map((p: Promotion, i: number) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,auto) 1fr auto', gap: '14px', alignItems: 'center', padding: '12px 18px', borderBottom: i === data.promotions.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: toneFor(p.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>{initials(p.name)}</div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)' }}>{p.name}</span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>
              <span style={{ color: 'var(--color-text-3)' }}>From:</span> {p.from_role} <span style={{ color: 'var(--color-text-3)' }}>→</span> <strong style={{ color: 'var(--color-text-1)' }}>{p.to_role}</strong>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{p.when}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ═══════════════════════ Real-Time Intent tab ═══════════════════════
/** The person's real profile picture, falling back to initials when the actor
 *  gave us no photo (or the image 404s). */
function PersonAvatar({ name, photo, size = 44 }: { name: string; photo?: string; size?: number }) {
  const [broken, setBroken] = React.useState(false);
  if (photo && !broken) {
    return (
      <img
        src={photo}
        alt={name}
        onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: 'var(--color-surface)' }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: toneFor(name || '?'), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, fontWeight: 700 }}>
      {initials(name || '?')}
    </div>
  );
}

/** Name + role, linking straight to the person's LinkedIn profile. */
function PersonLink({ it }: { it: IntentItem }) {
  const label = `${it.name}${it.role ? `, ${it.role}` : ''}`;
  if (!it.person_url) return <span style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>{label}</span>;
  return (
    <a href={it.person_url} target="_blank" rel="noreferrer" title="Open LinkedIn profile"
      style={{ fontSize: '12.5px', color: 'var(--color-brand-text)', fontWeight: 600, textDecoration: 'none' }}>
      {label}
    </a>
  );
}

function IntentPost({ it }: { it: IntentItem }) {
  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-1)', minWidth: 0 }}>{it.title}</div>
        {it.posted && <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>Posted {it.posted}</span>}
      </div>
      {it.hl && (
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', marginTop: '4px', lineHeight: 1.45 }}>
          <span style={{ fontWeight: 600 }}>Highlights:</span> {it.hl}{' '}
          {it.url && <a href={it.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-brand-text)', textDecoration: 'underline', fontWeight: 500 }}>View post</a>}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginTop: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-text-2)' }}><strong style={{ color: 'var(--color-text-1)' }}>{it.likes}</strong> Likes</span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-2)' }}><strong style={{ color: 'var(--color-text-1)' }}>{it.comments}</strong> Comments</span>
      </div>
    </div>
  );
}

/** One prospect = one card holding all of their posts (collapsed to the most
 *  recent until "Show all posts" is clicked). */
function ProspectCard({ person, posts }: { person: IntentItem; posts: IntentItem[] }) {
  const [open, setOpen] = React.useState(false);
  const shown = open ? posts : posts.slice(0, 1);
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <a href={person.person_url || undefined} target="_blank" rel="noreferrer" style={{ display: 'flex', flexShrink: 0 }}>
          <PersonAvatar name={person.name} photo={person.photo} />
        </a>
        <div style={{ minWidth: 0, flex: 1 }}>
          <PersonLink it={person} />
          <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '2px' }}>
            {posts.length} post{posts.length === 1 ? '' : 's'} in this run
          </div>
        </div>
        {posts.length > 1 && (
          <button
            onClick={() => setOpen((o) => !o)}
            style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '5px 11px', borderRadius: 'var(--radius-full)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}
          >
            {open ? 'Show less' : `Show all posts (${posts.length})`}
          </button>
        )}
      </div>
      <div style={{ marginTop: '6px' }}>
        {shown.map((p, i) => <IntentPost key={i} it={p} />)}
      </div>
    </div>
  );
}

function RealTimeIntentTab({ data, company }: { data: ResearchReport['real_time_intent']; company: string }) {
  // Group every post by the person who wrote it — this view is people-first.
  const groups = React.useMemo(() => {
    const m = new Map<string, IntentItem[]>();
    for (const it of data.intents || []) {
      const key = it.person_url || it.name;
      const arr = m.get(key);
      if (arr) arr.push(it); else m.set(key, [it]);
    }
    return [...m.values()].sort((a, b) => b.length - a.length);
  }, [data.intents]);

  return (
    <div style={TAB_WRAP}>
      <SectionHead company={company} sub={`Decision-maker posts · ${groups.length} ${groups.length === 1 ? 'person' : 'people'}`} />
      {data.summary && (
        <div style={{ fontSize: '13px', color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', lineHeight: 1.5 }}>{data.summary}</div>
      )}
      {groups.length === 0 ? (
        <div style={CARD}><Empty msg="No recent posts from this company's decision-makers." /></div>
      ) : groups.map((posts, i) => <ProspectCard key={i} person={posts[0]} posts={posts} />)}
    </div>
  );
}

function Empty({ msg, inline = false }: { msg: string; inline?: boolean }) {
  return (
    <div style={{ padding: inline ? '20px' : '40px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)' }}>{msg}</div>
  );
}

// ───────────────────────── shared building blocks ─────────────────────────
const CARD: React.CSSProperties = {
  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
  borderRadius: '12px', overflow: 'hidden',
};
const TAB_WRAP: React.CSSProperties = {
  padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: '14px',
};

function SectionHead({ company, sub, right }: { company: string; sub: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--color-text-2)' }}>{company.toUpperCase()}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginTop: '2px' }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}

function Pill({ children, bg, color }: { children: ReactNode; bg: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: 'var(--radius-full)', background: bg, color, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-2)' }}>{children}</span>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div style={CARD}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-1)' }}>{title}</div>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {items.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-brand-text)', marginTop: '7px', flexShrink: 0 }} />
            <span style={{ fontSize: '13.5px', color: 'var(--color-text-1)', lineHeight: 1.5 }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════ Overview tab ═══════════════════════
const TEMP_STYLE: Record<string, { bg: string; color: string }> = {
  hot: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' },
  warm: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
  cold: { bg: 'var(--color-surface)', color: 'var(--color-text-2)' },
};

function OverviewTab({ data, changes, company }: { data: OverviewBrief | null; changes: ReportChange[]; company: string }) {
  if (!data) return <Empty msg="No executive brief yet." />;
  const t = TEMP_STYLE[data.temperature] || TEMP_STYLE.warm;
  return (
    <div style={TAB_WRAP}>
      <SectionHead company={company} sub="Executive brief"
        right={<Pill bg={t.bg} color={t.color}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: t.color }} />{data.temperature}</Pill>} />

      <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: '20px', padding: '18px 20px' }}>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--color-text-1)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{data.score}</div>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-3)', fontWeight: 700, marginTop: '4px' }}>priority</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1.35 }}>{data.headline}</div>
          {data.summary && <div style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '6px', lineHeight: 1.5 }}>{data.summary}</div>}
        </div>
      </div>

      {changes?.length > 0 && (
        <div style={CARD}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-1)' }}>What changed since last run</div>
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {changes.map((c, i) => {
              const col = c.direction === 'up' ? 'var(--color-success-text)' : c.direction === 'down' ? 'var(--color-danger-text)' : 'var(--color-brand-text)';
              const arrow = c.direction === 'up' ? '↑' : c.direction === 'down' ? '↓' : '•';
              return (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                  <span style={{ color: col, fontWeight: 800, fontSize: '13px' }}>{arrow}</span>
                  <span style={{ fontSize: '13.5px', color: 'var(--color-text-1)' }}>{c.summary}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Bullets title="Talking points" items={data.talking_points} />
      <Bullets title="Recommended actions" items={data.recommended_actions} />
    </div>
  );
}

// ═══════════════════════ Job Postings tab ═══════════════════════
function JobPostingsTab({ data, company }: { data: JobPostingsResult | null; company: string }) {
  if (!data || !data.total_open_roles) return <Empty msg={data?.summary || 'No public job postings found.'} />;
  const depts = [...(data.departments || [])].sort((a, b) => b.open_count - a.open_count).slice(0, 8);
  const max = depts.length ? depts[0].open_count : 1;
  return (
    <div style={TAB_WRAP}>
      <SectionHead company={company} sub="Open roles (from their ATS)"
        right={data.velocity ? <Pill bg="var(--color-brand-subtle)" color="var(--color-brand-text)">{data.velocity}</Pill> : undefined} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {[{ n: String(data.total_open_roles), k: 'open roles' }, { n: data.top_department || '–', k: 'top hiring area' }].map((m, i) => (
          <div key={i} style={{ ...CARD, padding: '16px 18px' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text-1)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{m.n}</div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-3)', fontWeight: 700, marginTop: '4px' }}>{m.k}</div>
          </div>
        ))}
      </div>

      {data.signals?.length > 0 && <Bullets title="Sales signals" items={data.signals} />}

      {depts.length > 0 && (
        <div style={CARD}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-1)' }}>Hiring by department</div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {depts.map((d, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 34px', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <span style={{ height: '14px', borderRadius: '4px', background: 'var(--color-brand-text)', width: `${Math.max(2, Math.round((d.open_count / max) * 100))}%`, minWidth: '2px' }} />
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.open_count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.tech_hints?.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-3)', fontWeight: 700 }}>Tech hints</span>
          {data.tech_hints.map((t, i) => <Chip key={i}>{t}</Chip>)}
        </div>
      )}

      {data.source_url && (
        <a href={data.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>Source: {data.source_url}</a>
      )}
    </div>
  );
}

// ═══════════════════════ Reviews / VoC tab ═══════════════════════
function ReviewsTab({ data, company }: { data: ReviewsResult | null; company: string }) {
  if (!data || (!data.rating && !data.switch_triggers?.length && !data.pros?.length)) {
    return <Empty msg={data?.summary || 'No public reviews found.'} />;
  }
  const sentiment = (data.sentiment || '').toLowerCase();
  const st = sentiment === 'negative' ? TEMP_STYLE.hot : sentiment === 'mixed' ? TEMP_STYLE.warm : { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' };
  return (
    <div style={TAB_WRAP}>
      <SectionHead company={company} sub="What their customers say"
        right={data.sentiment ? <Pill bg={st.bg} color={st.color}>{data.sentiment}</Pill> : undefined} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {[{ n: data.rating != null ? `${data.rating}★` : '–', k: 'G2 rating' }, { n: String(data.review_count || 0), k: 'reviews' }].map((m, i) => (
          <div key={i} style={{ ...CARD, padding: '16px 18px' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text-1)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{m.n}</div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-3)', fontWeight: 700, marginTop: '4px' }}>{m.k}</div>
          </div>
        ))}
      </div>

      {data.summary && (
        <div style={{ fontSize: '13px', color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', lineHeight: 1.5 }}>{data.summary}</div>
      )}

      <Bullets title="Switch triggers — why users get frustrated" items={data.switch_triggers} />
      <Bullets title="Sales angles" items={data.sales_angles} />

      {[{ t: 'Pros', v: data.pros }, { t: 'Cons', v: data.cons }, { t: 'Feature gaps', v: data.feature_gaps }]
        .filter((g) => g.v?.length)
        .map((g, i) => (
          <div key={i} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-3)', fontWeight: 700, minWidth: '84px' }}>{g.t}</span>
            {g.v.map((x, j) => <Chip key={j}>{x}</Chip>)}
          </div>
        ))}

      {data.sources?.length > 0 && (
        <div style={CARD}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-1)' }}>Sources</div>
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {data.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: 'var(--color-brand-text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || s.url}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ Topics tab ═══════════════════════
const TREND_STYLE: Record<string, { bg: string; color: string }> = {
  rising: { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' },
  new: { bg: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' },
  steady: { bg: 'var(--color-surface)', color: 'var(--color-text-2)' },
  fading: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
};

function TopicsTab({ data, company }: { data: TopicsResult | null; company: string }) {
  if (!data || !data.topics?.length) return <Empty msg={data?.summary || 'No themes identified yet.'} />;
  return (
    <div style={TAB_WRAP}>
      <SectionHead company={company} sub={`What they keep talking about · last ${data.window_days || 90} days`} />
      {data.summary && (
        <div style={{ fontSize: '13px', color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', lineHeight: 1.5 }}>{data.summary}</div>
      )}
      <div style={CARD}>
        {data.topics.map((t, i) => {
          const ts = TREND_STYLE[t.trend] || TREND_STYLE.steady;
          return (
            <div key={i} style={{ padding: '14px 20px', borderBottom: i === data.topics.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>{t.label}</span>
                {t.trend && <Pill bg={ts.bg} color={ts.color}>{t.trend}</Pill>}
                {t.mentions > 0 && <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>{t.mentions} mentions</span>}
              </div>
              {t.outreach_angle && <div style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '5px', lineHeight: 1.45 }}>→ {t.outreach_angle}</div>}
              {t.evidence_urls?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {t.evidence_urls.slice(0, 4).map((u, j) => (
                    <a key={j} href={u} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: 'var(--color-brand-text)', textDecoration: 'none' }}>[{j + 1}]</a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════ Main view ═══════════════════════
interface LogEntry { stage: string; message: string; at: number }

/** Has a section actually landed? Drives the per-tab dot while streaming. */
const SECTION_FILLED: Record<string, (r: ResearchReport) => boolean> = {
  overview: (r) => !!r.overview,
  buying: (r) => (r.buying_signals?.items?.length ?? 0) > 0,
  jobs: (r) => !!r.job_postings?.total_open_roles,
  reviews: (r) => !!(r.reviews?.rating || r.reviews?.switch_triggers?.length),
  topics: (r) => (r.topics?.topics?.length ?? 0) > 0,
  hiring: (r) => (r.hiring_trends?.metrics?.length ?? 0) > 0 || (r.hiring_trends?.hires?.length ?? 0) > 0,
  intent: (r) => (r.real_time_intent?.intents?.length ?? 0) > 0,
};

const STAGE_CHIP: Record<string, { bg: string; color: string }> = {
  resolve: { bg: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' },
  cache: { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' },
  prefetch: { bg: 'var(--color-surface)', color: 'var(--color-text-2)' },
  research: { bg: 'var(--color-surface)', color: 'var(--color-text-2)' },
  buying: { bg: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' },
  hiring: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
  intent: { bg: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' },
  plan: { bg: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' },
  jobs: { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' },
  reviews: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
  topics: { bg: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' },
  overview: { bg: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' },
  done: { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' },
  error: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' },
};

export function AccountIntelView() {
  const [linkedin, setLinkedin] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [result, setResult] = React.useState<ResearchReport | null>(null);
  const [company, setCompany] = React.useState<CompanyProfile | null>(null);
  const [tab, setTab] = React.useState('overview');
  const [loading, setLoading] = React.useState(false);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [error, setError] = React.useState('');
  const [showLog, setShowLog] = React.useState(true);

  // version history (a run appends a new version; deltas live on the latest)
  const [versions, setVersions] = React.useState<VersionInfo[]>([]);
  const [viewVersion, setViewVersion] = React.useState<number | null>(null);
  // Opening a saved company reads from the DB — it must never start a run.
  const [loadingSaved, setLoadingSaved] = React.useState(false);
  const [noSavedFor, setNoSavedFor] = React.useState('');

  // company picker
  const [companies, setCompanies] = React.useState<CachedCompany[]>([]);
  const [backendOnline, setBackendOnline] = React.useState<boolean | null>(null);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);

  const abortRef = React.useRef<null | (() => void)>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // ── Load cached companies + backend health on mount ──
  const loadCompanies = React.useCallback(async () => {
    const [{ companies: list, online }, health] = await Promise.all([
      fetchCompanies(),
      fetchHealth(),
    ]);
    setCompanies(list);
    setBackendOnline(online || health !== null);
  }, []);

  React.useEffect(() => { loadCompanies(); }, [loadCompanies]);

  // ── Close dropdown on outside click ──
  React.useEffect(() => {
    if (!dropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [dropdownOpen]);

  React.useEffect(() => () => abortRef.current?.(), []);

  const start = (force = false, target?: string) => {
    const q = (target ?? linkedin).trim();
    if (!q || loading) return;
    if (target !== undefined) setLinkedin(target);
    setDropdownOpen(false);
    setLoading(true); setError(''); setLogs([]); setResult(null); setCompany(null); setTab('overview'); setShowLog(true);
    setVersions([]); setViewVersion(null); setNoSavedFor(''); setLoadingSaved(false);
    abortRef.current = researchAccount(
      { company_linkedin: q, company_website: website.trim(), force_refresh: force },
      {
        onProgress: (e) => setLogs((p) => [...p, { stage: e.stage, message: e.message, at: Date.now() }]),
        onCompany: (c) => {
          setCompany(c);
          setResult((prev) => ({ ...(prev ?? EMPTY_REPORT), company: c }));
        },
        onPartial: (stage, r) => {
          const key = PARTIAL_KEY[stage];
          if (!key) return;
          setResult((prev) => ({ ...(prev ?? EMPTY_REPORT), [key]: r }) as ResearchReport);
        },
        onComplete: (r) => {
          setResult(r);
          if (r.company) setCompany(r.company);
          setLoading(false);
          setShowLog(false);
          setViewVersion(r.version || null);
          if (r.slug) fetchVersions(r.slug).then(setVersions);
          loadCompanies(); // refresh dropdown with any newly-added company
        },
        onError: (m) => {
          setError(m);
          setLoading(false);
          setLogs((p) => [...p, { stage: 'error', message: m, at: Date.now() }]);
        },
      },
    );
  };

  /**
   * Open a company from the picker: READ-ONLY.
   *
   * Selecting a company must never trigger research — it just shows what's
   * already in the database. Researching costs real time + Apify/Firecrawl/LLM
   * spend, so it only happens when the user explicitly clicks Research/Refresh.
   * If nothing is stored yet we say so and wait for them to ask.
   */
  const openCompany = React.useCallback(async (c: CachedCompany) => {
    abortRef.current?.();            // drop any in-flight stream
    setLinkedin(c.companyLinkedin || c.slug);
    setDropdownOpen(false);
    setError(''); setLogs([]); setShowLog(false);
    setResult(null); setCompany(null);
    setVersions([]); setViewVersion(null);
    setTab('overview'); setLoading(false); setNoSavedFor('');
    setLoadingSaved(true);
    const rep = await fetchReport(c.slug);
    setLoadingSaved(false);
    if (rep) {
      setResult(rep);
      if (rep.company) setCompany(rep.company);
      setViewVersion(rep.version || null);
      fetchVersions(c.slug).then(setVersions);
    } else {
      setNoSavedFor(c.name || c.slug);
    }
  }, []);

  /** Swap the view to a previously-stored version of this report. */
  const loadVersion = React.useCallback(async (v: number) => {
    const slug = result?.slug;
    if (!slug || v === viewVersion) return;
    const rep = await fetchVersion(slug, v);
    if (rep) { setResult(rep); setViewVersion(v); if (rep.company) setCompany(rep.company); }
  }, [result?.slug, viewVersion]);

  const clear = () => {
    abortRef.current?.();
    setResult(null); setCompany(null); setError(''); setLogs([]); setLoading(false); setLinkedin('');
    setVersions([]); setViewVersion(null); setNoSavedFor(''); setLoadingSaved(false);
  };

  const companyName = company?.name || result?.company?.name || linkedin;

  // ── filtered dropdown list ──
  const q = linkedin.trim().toLowerCase();
  const querySlug = q.includes('linkedin.com/company/')
    ? q.split('linkedin.com/company/')[1].split('/')[0].split('?')[0].split('#')[0]
    : q;
  const filtered = querySlug
    ? companies.filter((c) => 
        c.name.toLowerCase().includes(querySlug) || 
        c.slug.toLowerCase().includes(querySlug) ||
        (c.companyLinkedin && c.companyLinkedin.toLowerCase().includes(querySlug))
      )
    : companies;
  const exactMatch = companies.some((c) => 
    c.slug.toLowerCase() === querySlug || 
    (c.companyLinkedin && c.companyLinkedin.toLowerCase() === q)
  );
  const showNewRow = querySlug.length > 0 && !exactMatch;

  const onComboKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setDropdownOpen(true); setHighlight((h) => Math.min(h + 1, filtered.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (dropdownOpen && filtered[highlight]) openCompany(filtered[highlight]);
      else start(false);
    } else if (e.key === 'Escape') { setDropdownOpen(false); }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Header / research form */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--color-border)', gap: '10px', flexShrink: 0, background: 'var(--color-bg)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.6px', whiteSpace: 'nowrap' }}>Account Intelligence</span>
        <div style={{ width: '1px', height: '18px', background: 'var(--color-border-2)' }} />

        {/* Company combobox */}
        <div ref={rootRef} style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-3)', pointerEvents: 'none' }}><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
            <input
              value={linkedin}
              onChange={(e) => { setLinkedin(e.target.value); setDropdownOpen(true); setHighlight(0); }}
              onFocus={() => setDropdownOpen(true)}
              onKeyDown={onComboKey}
              placeholder="Search saved companies, or type a LinkedIn slug / URL…"
              style={{ width: '100%', padding: '7px 30px 7px 32px', border: `1px solid ${dropdownOpen ? 'var(--color-brand)' : 'var(--color-border-2)'}`, borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none', color: 'var(--color-text-1)' }}
            />
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" onClick={() => setDropdownOpen((o) => !o)} style={{ position: 'absolute', right: '10px', top: '50%', transform: `translateY(-50%) rotate(${dropdownOpen ? 180 : 0}deg)`, color: 'var(--color-text-3)', cursor: 'pointer' }}><path d="M2 4L6 8L10 4" /></svg>
          </div>

          {dropdownOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 80, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Saved companies</span>
                {backendOnline === false && <span style={{ fontSize: '10.5px', color: 'var(--color-danger-text)' }}>backend offline</span>}
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '6px' }}>
                {showNewRow && (
                  <div onMouseEnter={() => setHighlight(filtered.length)} onClick={() => start(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: highlight === filtered.length ? 'var(--color-hover)' : 'transparent' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-md)', background: 'var(--color-brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="7" y1="2" x2="7" y2="12" /><line x1="2" y1="7" x2="12" y2="7" /></svg>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)' }}>Research “{linkedin.trim()}”</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>Run a fresh lookup for this company</div>
                    </div>
                  </div>
                )}
                {filtered.length === 0 && !showNewRow ? (
                  <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: '12.5px', color: 'var(--color-text-3)' }}>
                    {backendOnline === false
                      ? 'Backend offline — start the agent service to load saved companies.'
                      : companies.length === 0
                        ? 'No saved companies yet. Type a LinkedIn slug and press Enter.'
                        : 'No matches.'}
                  </div>
                ) : filtered.map((c, i) => (
                  <div key={c.slug} onMouseEnter={() => setHighlight(i)} onClick={() => openCompany(c)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: highlight === i ? 'var(--color-hover)' : 'transparent' }}>
                    {c.logo_url
                      ? <img src={c.logo_url} alt="" style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-md)', flexShrink: 0, objectFit: 'cover' }} />
                      : <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-md)', background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{initials(c.name)}</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.industry || c.slug}{c.enriched_at ? ` · ${relTime(c.enriched_at)}` : ''}</div>
                    </div>
                    {c.cached ? (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-success-text)', background: 'var(--color-success-bg)', padding: '2px 7px', borderRadius: 'var(--radius-full)', flexShrink: 0 }}>cached</span>
                    ) : (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 7px', borderRadius: 'var(--radius-full)', flexShrink: 0 }}>saved</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <input
          value={website} onChange={(e) => setWebsite(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
          placeholder="Website (optional)"
          style={{ width: '180px', padding: '7px 12px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none', color: 'var(--color-text-1)' }}
        />
        <button onClick={() => start(false)} disabled={!linkedin.trim() || loading} style={{ padding: '7px 16px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: !linkedin.trim() || loading ? 'not-allowed' : 'pointer', opacity: !linkedin.trim() || loading ? 0.5 : 1, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
          {loading ? 'Researching…' : 'Research'}
        </button>
        {(result || error) && !loading && (
          <>
            <button onClick={() => start(true)} disabled={!linkedin.trim()} title="Re-run (bypass cache)" style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)' }}>Refresh</button>
            <button onClick={clear} style={{ padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-3)', fontFamily: 'var(--font-sans)' }}>Clear</button>
          </>
        )}
      </div>

      {/* Backend offline banner */}
      {backendOnline === false && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', background: 'var(--color-warning-bg)', borderBottom: '1px solid var(--color-warning-text)', flexShrink: 0 }}>
          <span style={{ fontSize: '12.5px', color: 'var(--color-warning-text)', fontWeight: 600 }}>
            Agent backend is unreachable. Start it with <code style={{ fontFamily: 'var(--font-mono)' }}>uv run uvicorn agent_backend.api:app --port 8000</code>, then retry.
          </span>
          <button onClick={loadCompanies} style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: 'var(--color-warning-text)', background: 'none', border: '1px solid var(--color-warning-text)', borderRadius: 'var(--radius-sm)', padding: '3px 10px', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Company strip */}
      {company && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
          {company.logo_url
            ? <img src={company.logo_url} alt={company.name} style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md)', flexShrink: 0, objectFit: 'cover' }} />
            : <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md)', background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{initials(company.name)}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>{company.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>
              {[company.industry, company.headquarters, company.staff_count ? `${company.staff_count.toLocaleString()} staff` : ''].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Reports are versioned now (append-only), not cached — show which
                snapshot is on screen and when it was gathered. */}
            {!!result?.version && (
              <span title={result.enriched_at ? `Researched ${relTime(result.enriched_at)}` : undefined} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '3px 9px', borderRadius: 'var(--radius-full)' }}>
                v{result.version}{result.enriched_at ? ` · ${relTime(result.enriched_at)}` : ''}
              </span>
            )}
            {logs.length > 0 && (
              <button onClick={() => setShowLog((s) => !s)} style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '3px 10px', borderRadius: 'var(--radius-full)', cursor: 'pointer' }}>
                {showLog ? 'Hide log' : `Activity log (${logs.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs — horizontally scrollable so 7 tabs never overflow the shell */}
      {result && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, overflowX: 'auto' }}>
          {AI_TABS.map((t) => {
            const filled = SECTION_FILLED[t.id]?.(result) ?? true;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '11px 14px', fontSize: '13.5px', fontWeight: t.id === tab ? 600 : 500, color: t.id === tab ? 'var(--color-text-1)' : 'var(--color-text-2)', background: 'none', border: 'none', borderBottom: `2px solid ${t.id === tab ? 'var(--color-text-1)' : 'transparent'}`, marginBottom: '-1px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '6px', opacity: filled ? 1 : 0.55 }}>
                {t.label}
                {/* a dot marks a section that has landed — useful while streaming */}
                {filled && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: t.id === tab ? 'var(--color-brand-text)' : 'var(--color-border)' }} />}
              </button>
            );
          })}
          {versions.length > 1 && (
            <select
              value={viewVersion ?? ''}
              onChange={(e) => loadVersion(Number(e.target.value))}
              style={{ marginLeft: 'auto', fontSize: '12px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '4px 8px', cursor: 'pointer' }}
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version}{v.change_count ? ` · ${v.change_count} changes` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Activity log panel (collapsible) */}
      {logs.length > 0 && showLog && (
        <ActivityLog logs={logs} loading={loading} />
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-row-hover)' }}>
        {error && !result ? (
          <CenterState title="Research failed" body={error} tone="danger" />
        ) : loading && !result ? (
          <LoadingState logs={logs} />
        ) : loadingSaved ? (
          <CenterState title="Loading saved research…" body="Reading the stored report for this company." />
        ) : noSavedFor && !result ? (
          <CenterState
            title={`No saved research for ${noSavedFor}`}
            body="This company hasn't been researched yet. Click Research to run the agents — nothing is fetched until you ask."
          />
        ) : !result ? (
          <CenterState
            title="Research a target account"
            body="Pick a saved company to view its stored report, or type a company's LinkedIn slug / URL and hit Research. Milo's agents pull buying signals, job postings, reviews, topics, hiring trends and decision-maker intent from live sources."
          />
        ) : (
          tab === 'overview' ? <OverviewTab data={result.overview} changes={result.changes || []} company={companyName} />
            : tab === 'jobs' ? <JobPostingsTab data={result.job_postings} company={companyName} />
            : tab === 'reviews' ? <ReviewsTab data={result.reviews} company={companyName} />
            : tab === 'topics' ? <TopicsTab data={result.topics} company={companyName} />
            : tab === 'buying' ? <BuyingSignalsTab data={result.buying_signals} company={companyName} />
            : tab === 'hiring' ? <HiringTrendsTab data={result.hiring_trends} company={companyName} />
              : <RealTimeIntentTab data={result.real_time_intent} company={companyName} />
        )}
      </div>
    </div>
  );
}

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '';
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24); return `${days}d ago`;
}

function ActivityLog({ logs, loading }: { logs: LogEntry[]; loading: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs.length]);
  return (
    <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px 4px' }}>
        {loading && <span style={{ width: '12px', height: '12px', border: '2px solid var(--color-border)', borderTopColor: 'var(--color-brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />}
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Activity log</span>
      </div>
      <div ref={ref} style={{ maxHeight: '140px', overflowY: 'auto', padding: '4px 20px 10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {logs.map((l, i) => {
          const chip = STAGE_CHIP[l.stage] || STAGE_CHIP.research;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: chip.color, background: chip.bg, padding: '1px 6px', borderRadius: 'var(--radius-sm)', flexShrink: 0, minWidth: '54px', textAlign: 'center' }}>{l.stage}</span>
              <span style={{ color: 'var(--color-text-2)', flex: 1, minWidth: 0 }}>{l.message}</span>
              <span style={{ fontSize: '10.5px', color: 'var(--color-text-3)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function LoadingState({ logs }: { logs: LogEntry[] }) {
  const last = logs[logs.length - 1];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', gap: '14px' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-1)' }}>Researching…</div>
      <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>{last ? last.message : 'Starting…'}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CenterState({ title, body, tone }: { title: string; body: string; tone?: 'danger' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: tone === 'danger' ? 'var(--color-danger-bg)' : 'var(--color-brand-subtle)', color: tone === 'danger' ? 'var(--color-danger-text)' : 'var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      </div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '10px' }}>{title}</div>
      <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', maxWidth: '460px', lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}
