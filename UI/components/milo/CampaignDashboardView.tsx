'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { authStorage } from '@/lib/authStorage';

// ──────────────────────────────────────────────────────────────────────────
// Campaign performance dashboard (home screen). Fully mock data for now.
// Grounded in the design system (globals.css tokens): clean bordered cards,
// no decorative colour bars — insight categories are signalled with a small
// dot + uppercase semantic-coloured label, keeping the surface calm.
// ──────────────────────────────────────────────────────────────────────────

const caps: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: 'var(--tracking-caps)', color: 'var(--color-text-3)',
};

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstName(): string {
  const u = authStorage.getUser?.();
  const raw = u?.name || u?.email?.split('@')[0] || '';
  if (!raw) return 'there';
  const cleaned = raw.replace(/[._-]+/g, ' ').trim();
  return cleaned.split(' ')[0].replace(/^\w/, c => c.toUpperCase());
}

/* ── trend arrow ── */
type Trend = 'up' | 'down' | 'flat';
function TrendArrow({ dir }: { dir: Trend }) {
  const color = dir === 'up' ? 'var(--color-success-text)'
    : dir === 'down' ? 'var(--color-danger-text)' : 'var(--color-text-3)';
  const path = dir === 'up' ? 'M2 8L6 3L10 8'
    : dir === 'down' ? 'M2 4L6 9L10 4' : 'M2 6H10';
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={path} />
    </svg>
  );
}

/* ── KPI card ── */
interface Kpi { label: string; value: string; trend: Trend; hint: string }
const KPIS: Kpi[] = [
  { label: 'Response rate',    value: '18%', trend: 'up',   hint: 'Across 84 touches' },
  { label: 'Contact velocity', value: '12',  trend: 'up',   hint: 'Touches per week' },
  { label: 'Booking rate',     value: '9%',  trend: 'flat', hint: 'Of replied prospects' },
];

function KpiCard({ kpi }: { kpi: Kpi }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: '16px 18px',
        boxShadow: hov ? 'var(--shadow-sm)' : 'var(--shadow-none)',
        transition: 'box-shadow .15s', minWidth: 0,
      }}>
      <div style={caps}>{kpi.label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '10px 0 6px' }}>
        <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1 }}>{kpi.value}</span>
        <TrendArrow dir={kpi.trend} />
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>{kpi.hint}</div>
    </div>
  );
}

/* ── pipeline funnel ── */
interface Stage { label: string; value: number; goal?: boolean }
const STAGES: Stage[] = [
  { label: 'New',         value: 84 },
  { label: 'Contacted',   value: 66 },
  { label: 'Replied',     value: 29 },
  { label: 'Meeting',     value: 10 },
  { label: 'Opportunity', value: 5, goal: true },
];

// Circle sizing. The number lives INSIDE the circle and the diameter scales
// with the stage value (area-proportional via sqrt, so a 4× value looks 2×
// wider — perceptually honest). Bounded by [MIN_D, MAX_D] so tiny values stay
// legible and huge ones never blow out the row.
const MIN_D = 38;   // floor — still comfortably holds a formatted label
const MAX_D = 68;   // ceiling — the largest (usually first) stage
const LABEL_BAND = 20; // fixed label height so every circle centres on one line

// Compact display for large counts so the label always fits inside the circle:
// 12,340 → "12K". We keep it to whole units (≤4 chars) for legibility — the
// exact value is available on hover via the circle's title tooltip.
function compactNum(v: number): string {
  if (!Number.isFinite(v)) return '0';
  if (Math.abs(v) >= 10000) {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 0 }).format(v);
  }
  return String(v);
}

// Diameter, text, and a font size that is guaranteed to fit inside the circle.
function circleFor(value: number, maxVal: number) {
  const ratio = maxVal > 0 ? Math.max(0, value) / maxVal : 0;
  let d = MIN_D + (MAX_D - MIN_D) * Math.sqrt(Math.min(1, ratio));
  if (!Number.isFinite(d)) d = MIN_D;

  const text = compactNum(value);
  const chars = Math.max(1, text.length);
  // Start from a diameter-relative size, then shrink to fit the widest text.
  // 0.62 ≈ average glyph width / font-size for bold Figtree tabular figures.
  const fitFont = (d * 0.78) / (chars * 0.62);
  const font = Math.max(10, Math.min(d * 0.42, 20, fitFont));
  return { d, text, font };
}

function PipelineFunnel() {
  // Guard against an empty pipeline or all-zero values.
  const maxVal = STAGES.length ? Math.max(0, ...STAGES.map(s => s.value)) : 0;

  return (
    <div style={{
      background: 'var(--color-bg)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '22px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {STAGES.map((s, i) => {
          const prev = i > 0 ? STAGES[i - 1].value : null;
          // Conversion is undefined when the prior stage is 0 (no base to divide).
          const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
          const showConv = i > 0; // still render the connector, just '—' if N/A
          const { d, text, font } = circleFor(s.value, maxVal);
          // Single-hue funnel: brand throughout, success only on the goal stage.
          const fill = s.goal ? 'var(--color-success)' : 'var(--color-brand)';
          return (
            <React.Fragment key={s.label}>
              {showConv && (
                <div style={{ flex: 1, minWidth: '40px', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ height: `${LABEL_BAND}px` }} />
                  <div style={{ height: `${MAX_D}px`, marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, height: '1.5px', background: 'var(--color-border)' }} />
                    <span style={{
                      position: 'relative', background: 'var(--color-surface)', color: 'var(--color-text-2)',
                      fontSize: '11.5px', fontWeight: 600, padding: '2px 9px', borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--color-border)', whiteSpace: 'nowrap',
                    }}>{conv != null ? `${conv}%` : '—'}</span>
                  </div>
                </div>
              )}
              <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 6px' }}>
                <div style={{ ...caps, height: `${LABEL_BAND}px`, lineHeight: `${LABEL_BAND}px`, whiteSpace: 'nowrap' }}>{s.label}</div>
                <div style={{ height: `${MAX_D}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '8px' }}>
                  <div title={`${s.label}: ${s.value.toLocaleString()}`} style={{
                    width: `${d}px`, height: `${d}px`, borderRadius: '50%', background: fill,
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: `${font}px`, fontWeight: 700, lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                  }}>{text}</div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ── recent activity ── */
interface Activity { text: string; meta: string; time: string; tone: 'brand' | 'success' | 'neutral' }
const ACTIVITY: Activity[] = [
  { text: 'Agent drafted an email to Priya Nair', meta: 'Acme Corp', time: '20 min ago', tone: 'brand' },
  { text: 'Reply received from Daniel Cho', meta: 'Northwind', time: '1 hr ago', tone: 'success' },
  { text: 'Meeting booked with Sarah Lin', meta: 'Vertex Labs', time: '2 hr ago', tone: 'success' },
  { text: 'Invite accepted — Michael Ford', meta: 'BluePeak', time: '3 hr ago', tone: 'brand' },
  { text: 'Follow-up sequence sent to 12 prospects', meta: 'Automotive segment', time: '5 hr ago', tone: 'neutral' },
];
const TONE_DOT: Record<Activity['tone'], string> = {
  brand: 'var(--color-brand)', success: 'var(--color-success)', neutral: 'var(--color-border-2)',
};

function RecentActivity() {
  return (
    <div style={{
      background: 'var(--color-bg)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    }}>
      {ACTIVITY.map((a, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 18px',
          borderBottom: i < ACTIVITY.length - 1 ? '1px solid var(--color-border)' : 'none',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: TONE_DOT[a.tone], flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '13.5px', color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginTop: '1px' }}>{a.meta}</div>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-text-3)', flexShrink: 0 }}>{a.time}</span>
        </div>
      ))}
    </div>
  );
}

/* ── strategic insights (right rail) ── */
type Category = 'diagnostic' | 'opportunity' | 'warning';
const CAT_META: Record<Category, { label: string; color: string }> = {
  diagnostic:  { label: 'Diagnostic',  color: 'var(--color-brand-text)' },
  opportunity: { label: 'Opportunity', color: 'var(--color-success-text)' },
  warning:     { label: 'Warning',     color: 'var(--color-warning-text)' },
};
interface Insight { category: Category; title: string; body: string; action: string; route: string }
const INSIGHTS: Insight[] = [
  {
    category: 'diagnostic',
    title: 'Response rate plateaued despite higher velocity',
    body: 'Touches per week rose 20% but replies held flat — the newest sequences may be diluting relevance. Review the latest drafts before scaling further.',
    action: 'Review drafts', route: '/outreach-templates',
  },
  {
    category: 'opportunity',
    title: 'Automotive segment is outperforming 2.3×',
    body: 'Automotive prospects reply at 41% vs 18% overall. Reallocating touches toward this segment while it is hot could lift booking rate.',
    action: 'Go to LinkedIn', route: '/my-tasks',
  },
  {
    category: 'warning',
    title: 'Follow-up rigor is slipping',
    body: '34% of replied prospects have no scheduled follow-up. Booking rate will fall if the gap widens — prioritise the meeting stage.',
    action: 'Go to My Tasks', route: '/my-tasks',
  },
];

function InsightCard({ insight }: { insight: Insight }) {
  const router = useRouter();
  const [hov, setHov] = React.useState(false);
  const meta = CAT_META[insight.category];
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: '15px 16px',
        boxShadow: hov ? 'var(--shadow-sm)' : 'var(--shadow-none)', transition: 'box-shadow .15s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '9px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.color }} />
        <span style={{ ...caps, color: meta.color }}>{meta.label}</span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 'var(--leading-tight)', marginBottom: '6px' }}>{insight.title}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', lineHeight: 'var(--leading-normal)', marginBottom: '12px' }}>{insight.body}</div>
      <button
        onClick={() => router.push(insight.route)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px', background: 'var(--color-bg)', color: 'var(--color-brand)',
          border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)',
          fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
          transition: 'background .12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-brand-subtle)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg)'; }}>
        {insight.action}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" /></svg>
      </button>
    </div>
  );
}

function StrategicInsights() {
  const [q, setQ] = React.useState('');
  const [sent, setSent] = React.useState<string | null>(null);

  const ask = () => {
    if (!q.trim()) return;
    setSent(q.trim());
    setQ('');
  };

  return (
    <aside style={{
      flex: '40 1 0', minWidth: '360px', maxWidth: '560px',
      borderLeft: '1px solid var(--color-border)', background: 'var(--color-surface)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ ...caps, color: 'var(--color-text-1)', letterSpacing: 'var(--tracking-caps)' }}>Strategic insights</span>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-success)', boxShadow: '0 0 0 3px var(--color-success-bg)' }} />
          </div>
          <span style={{
            fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)',
            color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)',
            padding: '3px 9px', borderRadius: 'var(--radius-full)',
          }}>Deep analysis</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginTop: '5px' }}>
          Powered by deep analysis · Updated 8:42 AM
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ ...caps, marginBottom: '12px' }}>Insight cards</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {INSIGHTS.map((ins, i) => <InsightCard key={i} insight={ins} />)}
          {sent && (
            <div style={{
              background: 'var(--color-brand-subtle)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', padding: '13px 15px',
            }}>
              <div style={{ ...caps, color: 'var(--color-brand-text)', marginBottom: '6px' }}>Your question</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-1)', marginBottom: '8px' }}>{sent}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', lineHeight: 'var(--leading-normal)' }}>
                Deep analysis is a preview — connect the analytics engine to get a grounded answer here.
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)', padding: '12px 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)',
          padding: '4px 4px 4px 12px', background: 'var(--color-bg)',
        }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ask(); }}
            placeholder="Ask why this is happening, or how to improve it…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-1)',
            }} />
          <button onClick={ask} title="Ask" style={{
            width: '30px', height: '30px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: q.trim() ? 'var(--color-brand)' : 'var(--color-surface)',
            color: q.trim() ? '#fff' : 'var(--color-text-3)',
            cursor: q.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background .12s',
          }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8l12-5-5 12-2.5-4.5L2 8z" /></svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ── main view ── */
export function CampaignDashboardView() {
  const name = React.useMemo(firstName, []);
  const greet = React.useMemo(greetingWord, []);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
      {/* Left: performance */}
      <div style={{ flex: '60 1 0', overflowY: 'auto', minWidth: 0, padding: '28px 32px 40px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>
          {greet}, {name}.{' '}
          <span style={{ fontWeight: 500, color: 'var(--color-text-2)' }}>Here's how your campaign is performing.</span>
        </div>

        <div style={{ ...caps, margin: '28px 0 12px' }}>Campaign performance</div>
        <div style={{ display: 'flex', gap: '14px' }}>
          {KPIS.map(k => <KpiCard key={k.label} kpi={k} />)}
        </div>

        <div style={{ ...caps, margin: '30px 0 12px' }}>Pipeline funnel</div>
        <PipelineFunnel />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '30px 0 12px' }}>
          <span style={caps}>Recent activity</span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>Last 24 hours</span>
        </div>
        <RecentActivity />
      </div>

      {/* Right: strategic insights */}
      <StrategicInsights />
    </div>
  );
}
