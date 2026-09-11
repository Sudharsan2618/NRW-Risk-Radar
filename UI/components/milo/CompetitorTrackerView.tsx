'use client';
import React, { ReactNode } from 'react';

interface Account { id: string; name: string; industry: string; initials: string }

const AI_ACCOUNTS: Account[] = [
  { id: 'acme',     name: 'Acme Inc.',          industry: 'B2B SaaS',       initials: 'AI' },
  { id: 'globex',   name: 'Globex Corporation', industry: 'Logistics',      initials: 'GC' },
  { id: 'initech',  name: 'Initech',            industry: 'Fintech',        initials: 'IN' },
  { id: 'umbrella', name: 'Umbrella LLC',       industry: 'Healthcare',     initials: 'UM' },
  { id: 'stark',    name: 'Stark Industries',   industry: 'Manufacturing',  initials: 'SI' },
  { id: 'wayne',    name: 'Wayne Enterprises',  industry: 'Conglomerate',   initials: 'WE' },
  { id: 'cyberdyne',name: 'Cyberdyne Systems',  industry: 'AI / Robotics',  initials: 'CS' },
  { id: 'tyrell',   name: 'Tyrell Corp',        industry: 'Bioengineering', initials: 'TC' },
  { id: 'soylent',  name: 'Soylent Corp',       industry: 'Food & Beverage',initials: 'SC' },
  { id: 'massive',  name: 'Massive Dynamic',    industry: 'Research',       initials: 'MD' },
];

const AI_TABS = [
  { id: 'buying',  label: 'Buying Signals' },
  { id: 'hiring',  label: 'Hiring Trends' },
  { id: 'intent',  label: 'Real-Time Intent' },
];

type SrcKind = 'linkedin' | 'web' | 'news' | 'feeds' | 'x';
const AI_SRC_STYLE: Record<SrcKind, { bg: string; color: string }> = {
  linkedin: { bg: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' },
  web:      { bg: 'var(--color-surface)',      color: 'var(--color-text-2)' },
  news:     { bg: 'var(--color-warning-bg)',   color: 'var(--color-warning-text)' },
  feeds:    { bg: 'var(--color-warning-bg)',   color: 'var(--color-warning-text)' },
  x:        { bg: '#1E1F21',                   color: '#FFFFFF' },
};

function AISourceBadge({ kind, size = 32 }: { kind: SrcKind; size?: number }) {
  const s = AI_SRC_STYLE[kind] || AI_SRC_STYLE.web;
  const Ic: Record<SrcKind, ReactNode> = {
    linkedin: <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: size * 0.42, letterSpacing: '-0.5px' }}>in</span>,
    web: <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.5" /><line x1="1.5" y1="8" x2="14.5" y2="8" /><path d="M8 1.5C10 4 10 12 8 14.5M8 1.5C6 4 6 12 8 14.5" /></svg>,
    news: <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><rect x="1.5" y="3" width="13" height="10" rx="1" /><line x1="4" y1="6" x2="8" y2="6" /><line x1="4" y1="8" x2="11" y2="8" /><line x1="4" y1="10" x2="11" y2="10" /></svg>,
    feeds: <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="3.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" /><path d="M3 8a5 5 0 0 1 5 5" /><path d="M3 3.5a9.5 9.5 0 0 1 9.5 9.5" /></svg>,
    x: <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: size * 0.46 }}>𝕏</span>,
  };
  return (
    <div style={{
      width: size, height: size, borderRadius: '7px', flexShrink: 0,
      background: s.bg, color: s.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{Ic[kind] || Ic.web}</div>
  );
}

type Tone = 'B' | 'P' | 'A' | 'G' | 'K';
const AI_AV_TONE: Record<Tone, string> = {
  B: 'var(--color-avatar-blue)',
  P: 'var(--color-avatar-purple)',
  A: 'var(--color-avatar-amber)',
  G: 'var(--color-avatar-green)',
  K: 'var(--color-avatar-pink)',
};

interface Hire { name: string; title: string; from: string; start: string; tone: Tone }
const AI_HIRES: Hire[] = [
  { name: 'Sarah Jones',    title: 'Chief Marketing Officer',  from: 'ex-Google',     start: 'Q1 2024', tone: 'B' },
  { name: 'David Kim',      title: 'Chief Technology Officer', from: 'ex-Salesforce', start: 'Q1 2024', tone: 'P' },
  { name: 'Alex Rodriguez', title: 'VP of Product',            from: 'ex-Stripe',     start: 'Q1 2024', tone: 'A' },
];

interface Promo { name: string; init: string; tone: Tone; fromRole: string; toRole: string; when: string }
const AI_PROMOS: Promo[] = [
  { name: 'Maria Garcia', init: 'MG', tone: 'P', fromRole: 'Director of Engineering', toRole: 'VP of Engineering', when: 'Jan 2024' },
  { name: 'Ben Smith',    init: 'BS', tone: 'B', fromRole: 'Sr. Product Manager',     toRole: 'Head of Product',   when: 'Feb 2024' },
  { name: 'Chloe Dubois', init: 'CD', tone: 'A', fromRole: 'HR Specialist',           toRole: 'HR Director',       when: 'Mar 2024' },
];

interface Intent { src: SrcKind; name: string; role: string; title: string; hl: string; posted: string; likes: string; comments: string }
const AI_INTENTS: Intent[] = [
  { src: 'linkedin', name: 'Sarah Chen',     role: 'CEO',          title: 'Announcing Our Q4 Strategic Direction', hl: 'Key focus on global market expansion. Accelerating product innovation.', posted: '2h ago', likes: '1.8k', comments: '92' },
  { src: 'x',        name: 'David Kim',      role: 'CTO',          title: 'Thoughts on AI Integration and Ethics', hl: 'Ensuring responsible development. Leveraging predictive algorithms.',    posted: '5h ago', likes: '1.1k', comments: '150' },
  { src: 'linkedin', name: 'Jessica Miller', role: 'VP Marketing', title: 'Redefining Customer Engagement in SaaS', hl: 'Community-driven growth. Personalized user experiences.',                posted: '1d ago', likes: '2.2k', comments: '110' },
  { src: 'linkedin', name: 'Michael Lee',    role: 'CFO',          title: 'Fiscal Resilience and Future Investment', hl: 'Strong Q3 performance. Strategic M&A pipeline.',                         posted: '2d ago', likes: '800',  comments: '45' },
  { src: 'x',        name: 'Alex Ramirez',   role: 'VP Product',   title: 'User-Centric Design Philosophy',         hl: 'Continuous feedback loops. Streamlined workflows.',                       posted: '3d ago', likes: '1.4k', comments: '70' },
];

interface BuyingItem { src: SrcKind; title: string; when: string; tag: string; highlight?: boolean; sub?: string }
const AI_BUYING: BuyingItem[] = [
  { src: 'linkedin', title: 'Appoints Sarah Chen as Chief Revenue Officer.', when: '2 days ago', tag: 'Executive Announcement' },
  { src: 'web',      title: 'Launches new AI-powered product recommendation engine.', when: '4 days ago', tag: 'Company Blog Post' },
  { src: 'news',     title: 'Signs major strategic partnership with global logistics leader.', when: '1 week ago', tag: 'Industry News', highlight: true },
  { src: 'feeds',    title: 'Significant growth in back-office job postings detected.', when: '2 weeks ago', tag: 'Job Feeds', sub: 'An insight highlights a 33% increase in related roles.' },
  { src: 'linkedin', title: 'Webinar: Future of Digital Transformation in Enterprise.', when: 'Register now', tag: 'Online Event' },
  { src: 'web',      title: 'New case study: helps manufacturing clients save 20% on costs.', when: '10 days ago', tag: 'Website' },
  { src: 'news',     title: 'CEO interviewed by Tech Leadership Journal on market trends.', when: '2 weeks ago', tag: 'Media Coverage' },
  { src: 'feeds',    title: 'Files new patent for blockchain-based supply chain tracking.', when: 'Recent activity', tag: 'Intellectual Property' },
];

function AccountCombobox({ account, onPick }: { account: Account | null; onPick: (a: Account) => void }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [hi, setHi] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const list = q
    ? AI_ACCOUNTS.filter(a => a.name.toLowerCase().includes(q) || a.industry.toLowerCase().includes(q))
    : AI_ACCOUNTS;

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  React.useEffect(() => { setHi(0); }, [query]);

  const pick = (a: Account) => { onPick(a); setOpen(false); setQuery(''); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(i => Math.min(i + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (list[hi]) pick(list[hi]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth: '320px' }}>
      <button
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 0); }}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '6px 10px 6px 8px',
          background: open ? 'var(--color-surface)' : 'var(--color-bg)',
          border: `1px solid ${open ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
          borderRadius: '8px', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', width: '100%',
        }}
      >
        {account ? (
          <>
            <div style={{
              width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
              background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700, letterSpacing: '.3px',
            }}>{account.initials}</div>
            <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{account.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '2px' }}>{account.industry}</div>
            </div>
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ color: 'var(--color-text-3)', flexShrink: 0 }}>
              <circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" />
            </svg>
            <span style={{ fontSize: '14px', color: 'var(--color-text-3)', flex: 1, textAlign: 'left' }}>Search and select an account…</span>
          </>
        )}
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--color-text-3)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .15s' }}>
          <path d="M2 4L6 8L10 4" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(16,24,40,.10), 0 1px 3px rgba(16,24,40,.06)',
          zIndex: 80, overflow: 'hidden',
        }}>
          <div style={{ padding: '10px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '7px' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" style={{ color: 'var(--color-text-3)' }}>
                <circle cx="6" cy="6" r="4.5" /><line x1="9" y1="9" x2="13" y2="13" />
              </svg>
              <input
                ref={inputRef} autoFocus value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type a company or industry…"
                style={{
                  border: 'none', background: 'transparent', outline: 'none', width: '100%',
                  fontSize: '13.5px', color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)',
                }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-3)', display: 'flex', padding: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" /></svg>
                </button>
              )}
            </div>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '6px' }}>
            {list.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)' }}>
                No accounts match “{query}”
              </div>
            ) : list.map((a, i) => {
              const isHi = i === hi;
              const isSel = account?.id === a.id;
              return (
                <div key={a.id}
                  onMouseEnter={() => setHi(i)} onClick={() => pick(a)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '7px', cursor: 'pointer',
                    background: isHi ? 'var(--color-hover)' : 'transparent',
                  }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0,
                    background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700,
                  }}>{a.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>{a.industry}</div>
                  </div>
                  {isSel && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--color-brand)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2.5,7.5 5.5,10.5 11.5,3.5" /></svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AIEmptyState() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <div style={{
        width: '68px', height: '68px', borderRadius: '16px',
        background: 'var(--color-brand-subtle)', color: 'var(--color-brand)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><circle cx="11" cy="11" r="3" /><line x1="11" y1="11" x2="17" y2="5" />
        </svg>
      </div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '10px', whiteSpace: 'nowrap' }}>
        Pick an account to begin
      </div>
      <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', maxWidth: '460px', textAlign: 'center', lineHeight: 1.55 }}>
        Use the search above to find a target account. Milo will pull together its buying signals, hiring trends, and real-time intent in one place.
      </div>
    </div>
  );
}

const SRC_VALUES: Record<string, 'all' | SrcKind> = {
  'All sources': 'all', LinkedIn: 'linkedin', Web: 'web', News: 'news', Feeds: 'feeds',
};

function ToolbarSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        appearance: 'none', WebkitAppearance: 'none',
        padding: '7px 30px 7px 12px', border: '1px solid var(--color-border-2)', borderRadius: '8px',
        background: 'var(--color-bg)', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-1)',
        fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none',
      }}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-3)' }}>
        <path d="M2 4L6 8L10 4" />
      </svg>
    </div>
  );
}

function BuyingSignalsTab({ account }: { account: Account }) {
  const [query, setQuery] = React.useState('');
  const [src, setSrc] = React.useState('All sources');
  const [period, setPeriod] = React.useState('Last 30 days');

  const srcKey = SRC_VALUES[src] ?? 'all';
  const q = query.trim().toLowerCase();
  const items = AI_BUYING.filter(b =>
    (srcKey === 'all' ? true : b.src === srcKey) &&
    (!q || (b.title + b.tag + (b.sub || '')).toLowerCase().includes(q))
  );

  return (
    <div style={{ padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--color-text-2)' }}>{account.name.toUpperCase()}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginTop: '2px' }}>Recent buying signals</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-2)', borderRadius: '8px', minWidth: '220px' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--color-text-3)' }}>
              <circle cx="5.5" cy="5.5" r="4" /><line x1="8.5" y1="8.5" x2="12" y2="12" />
            </svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search signals…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', flex: 1, fontFamily: 'var(--font-sans)' }} />
          </div>
          <ToolbarSelect value={src} onChange={setSrc} options={['All sources', 'LinkedIn', 'Web', 'News', 'Feeds']} />
          <ToolbarSelect value={period} onChange={setPeriod} options={['Last 7 days', 'Last 30 days', 'Last 90 days']} />
        </div>
      </div>

      <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
        {items.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)' }}>
            No signals match this filter.
          </div>
        ) : (
          <div>
          {items.map((it, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '16px',
              alignItems: 'center', padding: '14px 20px',
              borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--color-border)',
              background: it.highlight ? 'var(--color-brand-tint)' : 'transparent',
              cursor: 'pointer', transition: 'background .12s',
            }}>
              <AISourceBadge kind={it.src} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-1)', lineHeight: 1.35 }}>{it.title}</div>
                {it.sub && (
                  <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', marginTop: '4px', lineHeight: 1.4 }}>{it.sub}</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{it.when}</span>
                <span style={{
                  display: 'inline-flex', padding: '3px 10px', borderRadius: '999px',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-2)', whiteSpace: 'nowrap',
                }}>{it.tag}</span>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HiringChart() {
  const W = 720, H = 130, P = 28;
  const pts = [55, 95, 130, 165, 205, 235];
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const max = 250;
  const stepX = (W - P * 2) / (pts.length - 1);
  const xy = pts.map((v, i) => [P + i * stepX, H - P - (v / max) * (H - P * 1.6)] as const);
  const linePath = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L${xy[xy.length - 1][0]} ${H - P} L${xy[0][0]} ${H - P} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="130" style={{ display: 'block' }}>
      {[0, .25, .5, .75, 1].map((t, i) => {
        const y = H - P - t * (H - P * 1.6);
        return <line key={i} x1={P} x2={W - P / 2} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="3 3" />;
      })}
      {[0, 100, 200].map((v, i) => {
        const y = H - P - (v / max) * (H - P * 1.6);
        return <text key={i} x={P - 6} y={y + 3} textAnchor="end" fontSize="9.5" fill="var(--color-text-3)" fontFamily="var(--font-sans)">{v}</text>;
      })}
      {labels.map((l, i) => (
        <text key={i} x={P + i * stepX} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-text-3)" fontFamily="var(--font-sans)">{l}</text>
      ))}
      <path d={areaPath} fill="var(--color-brand)" opacity="0.10" />
      <path d={linePath} fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinejoin="round" />
      {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="var(--color-bg)" stroke="var(--color-brand)" strokeWidth="1.8" />)}
    </svg>
  );
}

function HiringTrendsTab({ account }: { account: Account }) {
  const [query, setQuery] = React.useState('');
  const [dept, setDept] = React.useState('All departments');
  const [seniority, setSeniority] = React.useState('All levels');
  const [period, setPeriod] = React.useState('Q1 2024');

  const TrendCard = ({ title, icon, right, children, pad = true }: { title: string; icon: ReactNode; right?: ReactNode; children: ReactNode; pad?: boolean }) => (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--color-border)', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
          <span style={{ color: 'var(--color-brand)', display: 'flex', flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-1)', whiteSpace: 'nowrap' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>{right}</div>
      </div>
      <div style={pad ? { padding: '18px' } : undefined}>{children}</div>
    </div>
  );

  const FiltersBtn = (
    <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', border: '1px solid var(--color-border-2)', borderRadius: '6px', background: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 500, color: 'var(--color-text-2)', fontFamily: 'var(--font-sans)' }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1.5" y1="3" x2="10.5" y2="3" /><line x1="3.5" y1="6" x2="8.5" y2="6" /><line x1="5" y1="9" x2="7" y2="9" /></svg>
      Filters
    </button>
  );
  const DotsBtn = (
    <button style={{ width: '26px', height: '26px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '6px', color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="3" cy="7" r="1.2" fill="currentColor" /><circle cx="7" cy="7" r="1.2" fill="currentColor" /><circle cx="11" cy="7" r="1.2" fill="currentColor" /></svg>
    </button>
  );

  return (
    <div style={{ padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--color-text-2)' }}>{account.name.toUpperCase()}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginTop: '2px' }}>Talent hub & hiring trends</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-2)', borderRadius: '8px', minWidth: '220px' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--color-text-3)' }}>
              <circle cx="5.5" cy="5.5" r="4" /><line x1="8.5" y1="8.5" x2="12" y2="12" />
            </svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search hires…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', flex: 1, fontFamily: 'var(--font-sans)' }} />
          </div>
          <ToolbarSelect value={dept}      onChange={setDept}      options={['All departments', 'Engineering', 'Product', 'Marketing', 'Sales']} />
          <ToolbarSelect value={seniority} onChange={setSeniority} options={['All levels', 'C-suite', 'VP', 'Director', 'Manager']} />
          <ToolbarSelect value={period}    onChange={setPeriod}    options={['Q1 2024', 'Q4 2023', 'Last 12 months']} />
        </div>
      </div>

      <TrendCard
        title="New leadership hires"
        icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="12" height="9" rx="1.5" /><path d="M6 5V3.5A1 1 0 0 1 7 2.5H9A1 1 0 0 1 10 3.5V5" /></svg>}
        right={<>{FiltersBtn}{DotsBtn}</>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {AI_HIRES.map((h, i) => (
            <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--color-row-hover)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '10px',
                  background: AI_AV_TONE[h.tone], color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: 700, flexShrink: 0,
                }}>{h.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '.4px', marginTop: '2px' }}>{h.title}</div>
                  <span style={{
                    display: 'inline-block', marginTop: '6px', padding: '2px 9px', borderRadius: '999px',
                    background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)',
                    fontSize: '11px', fontWeight: 600,
                  }}>{h.from}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>Start date</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-1)' }}>{h.start}</span>
              </div>
            </div>
          ))}
        </div>
      </TrendCard>

      <TrendCard
        title="Recent promotions"
        icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6" r="3.5" /><polyline points="5,9 4,14 8,12 12,14 11,9" /></svg>}
        right={<>{FiltersBtn}{DotsBtn}</>}
        pad={false}
      >
        {AI_PROMOS.map((p, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: 'minmax(160px, auto) minmax(0, 1fr) minmax(200px, auto) auto', gap: '14px',
            alignItems: 'center', padding: '12px 18px',
            borderBottom: i === AI_PROMOS.length - 1 ? 'none' : '1px solid var(--color-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: AI_AV_TONE[p.tone], color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0,
              }}>{p.init}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ color: 'var(--color-text-3)' }}>From:</span> {p.fromRole}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--color-text-2)', minWidth: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--color-success-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="2" y1="7" x2="11" y2="7" /><polyline points="7,3 11,7 7,11" /></svg>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>Promoted to</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-1)', whiteSpace: 'nowrap' }}>{p.toRole}</div>
              </div>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>{p.when}</div>
          </div>
        ))}
      </TrendCard>

      <TrendCard
        title="Hiring metrics & trends overview"
        icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="13" x2="14" y2="13" /><polyline points="3,10 6.5,6 9.5,8.5 13,4" /></svg>}
        right={<>{FiltersBtn}{DotsBtn}</>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '14px' }}>
          <div style={{ gridColumn: '1 / 2', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '18px 20px', background: 'var(--color-brand-tint)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-success-text)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="4" /><polyline points="6,10 12,4 18,10" /></svg>
              <div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-success-text)', lineHeight: 1 }}>33%</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: '4px' }}>Increased Back-Office Hiring</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-2)', marginTop: '4px' }}>+58 new roles, Q/Q</div>
              </div>
            </div>
          </div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-success-text)' }}>+10%</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Tech Hire</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-2)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600 }}>Hiring volume (Q/Q)</div>
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '6px' }}>Total new hires: 215</div>
          </div>

          <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-success-text)' }}>+15%</span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Overall hiring</span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-2)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600 }}>Volume (Q/Q)</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '4px' }}>Total new hires: 215</div>
          </div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-success-text)' }}>+10%</span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Tech hire growth</span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-2)', marginTop: '4px' }}>Focus on AI & Dev</div>
          </div>

          <div style={{ gridColumn: '1 / 3', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-1)' }}>Monthly hiring volume (Jan – Mar 2024)</span>
              <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>Roles per month</span>
            </div>
            <HiringChart />
          </div>
        </div>
      </TrendCard>
    </div>
  );
}

function RealTimeIntentTab({ account }: { account: Account }) {
  const [query, setQuery] = React.useState('');
  const [src, setSrc] = React.useState('All sources');
  const [group, setGroup] = React.useState('Leadership');
  const [period, setPeriod] = React.useState('Last 7 days');

  const q = query.trim().toLowerCase();
  const items = AI_INTENTS.filter(it => !q || (it.name + it.title + it.hl).toLowerCase().includes(q));

  return (
    <div style={{ padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--color-text-2)' }}>{account.name.toUpperCase()}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, marginTop: '2px' }}>Leadership intent stream</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-2)', borderRadius: '8px', minWidth: '220px' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--color-text-3)' }}>
              <circle cx="5.5" cy="5.5" r="4" /><line x1="8.5" y1="8.5" x2="12" y2="12" />
            </svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search intents…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', flex: 1, fontFamily: 'var(--font-sans)' }} />
          </div>
          <ToolbarSelect value={src}    onChange={setSrc}    options={['All sources', 'LinkedIn', 'X', 'News']} />
          <ToolbarSelect value={group}  onChange={setGroup}  options={['Leadership', 'Marketing', 'Engineering', 'Product']} />
          <ToolbarSelect value={period} onChange={setPeriod} options={['Last 7 days', 'Last 30 days', 'Last 90 days']} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--color-text-1)' }}>Real-time intents for {account.name}</div>
        {items.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
            No intents match this filter.
          </div>
        ) : items.map((it, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '48px 1fr', gap: '14px',
            alignItems: 'center', padding: '14px 16px',
            background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '10px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <AISourceBadge kind={it.src} size={36} />
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-1)' }}>{it.name.split(' ')[0]}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>{it.name}, {it.role}</span>
                <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>Posted {it.posted}</span>
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-1)', marginTop: '4px' }}>{it.title}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', marginTop: '4px', lineHeight: 1.4 }}>
                <span style={{ fontWeight: 600 }}>Highlights:</span> {it.hl}{' '}
                <a href="#" onClick={e => e.preventDefault()} style={{ color: 'var(--color-brand)', textDecoration: 'underline', fontWeight: 500 }}>More..</a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginTop: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h2v6H3zM5 6l2.5-4.5a1 1 0 0 1 1.9.5V5h2.5a1 1 0 0 1 1 1.3l-1.5 5a1 1 0 0 1-1 .7H5z" /></svg>
                  <strong style={{ color: 'var(--color-text-1)' }}>{it.likes}</strong> Likes
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3.5h10v6.5H6L3 12V3.5z" /></svg>
                  <strong style={{ color: 'var(--color-text-1)' }}>{it.comments}</strong> Comments
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompetitorTrackerView() {
  const [account, setAccount] = React.useState<Account | null>(null);
  const [tab, setTab] = React.useState('buying');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 20px', borderBottom: '1px solid var(--color-border)',
        gap: '12px', flexShrink: 0, background: 'var(--color-bg)',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.6px', whiteSpace: 'nowrap' }}>
          Competitor Tracker
        </span>
        <div style={{ width: '1px', height: '18px', background: 'var(--color-border-2)' }} />
        <AccountCombobox account={account} onPick={(a) => { setAccount(a); setTab('buying'); }} />
        {account && (
          <button onClick={() => setAccount(null)} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '5px 9px', background: 'none', border: 'none', cursor: 'pointer',
            borderRadius: '6px', fontSize: '12px', color: 'var(--color-text-3)', fontFamily: 'var(--font-sans)',
          }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1.5" y1="1.5" x2="9.5" y2="9.5" /><line x1="9.5" y1="1.5" x2="1.5" y2="9.5" /></svg>
            Clear
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button style={{ padding: '5px 13px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Add to list</button>
          <button style={{ padding: '5px 13px', border: '1px solid var(--color-border-2)', background: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)' }}>Export</button>
        </div>
      </div>

      {account && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          {AI_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '11px 14px', fontSize: '13.5px',
              fontWeight: t.id === tab ? 600 : 500,
              color: t.id === tab ? 'var(--color-text-1)' : 'var(--color-text-2)',
              background: 'none', border: 'none',
              borderBottom: `2px solid ${t.id === tab ? 'var(--color-text-1)' : 'transparent'}`,
              marginBottom: '-1px', cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-sans)',
            }}>{t.label}</button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-row-hover)' }}>
        {!account ? <AIEmptyState /> : (
          tab === 'buying' ? <BuyingSignalsTab account={account} /> :
          tab === 'hiring' ? <HiringTrendsTab account={account} /> :
                             <RealTimeIntentTab account={account} />
        )}
      </div>
    </div>
  );
}
