'use client';
import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/milo/ConfirmDialog';
import { listImportCampaigns, updateImportCampaign, fetchMyTasksToday, fetchWeeklyProgress, type WeeklyPlan, type WeeklyProgress } from '@/lib/leadFunnelApi';
import { listCampaigns as listHrCampaigns, updateCampaign as updateHrCampaign } from '@/lib/hrApi';

/* ═══════════════════════════════════════════════════════════════════════════
   Weekly Goals — MOCK / DUMMY UI
   ---------------------------------------------------------------------------
   Pick a campaign on the left → answer the per-day commitment questions on the
   right → the weekly goal is calculated live from those inputs (per channel,
   per day, and the grand weekly total). All data here is static placeholder
   data; nothing is persisted. Built entirely on the design-system tokens and
   the two-pane + section-header + right-rail conventions used across Milo.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── channel model ── */

type ChannelId = 'email' | 'linkedin' | 'calls';

interface ChannelDef {
  id: ChannelId;
  label: string;
  color: string;
  question: string;
  icon: React.ReactNode;
}

const CHANNELS: ChannelDef[] = [
  {
    id: 'email', label: 'Emails', color: 'var(--color-brand)',
    question: 'How many outreach emails will you send',
    icon: <><rect x="2" y="4" width="14" height="10" rx="1.5" /><polyline points="2.5,5 9,10 15.5,5" /></>,
  },
  {
    id: 'linkedin', label: 'LinkedIn', color: 'var(--color-avatar-blue)',
    question: 'How many LinkedIn invites will you send',
    icon: <><rect x="2.5" y="2.5" width="13" height="13" rx="2" /><line x1="5.5" y1="8" x2="5.5" y2="12.5" /><circle cx="5.5" cy="5.4" r="0.9" fill="currentColor" stroke="none" /><path d="M8.5 12.5V8.5M8.5 10c0-1 .9-1.8 2-1.8s2 .8 2 2.2V12.5" /></>,
  },
  {
    id: 'calls', label: 'Phone Calls', color: 'var(--color-warning)',
    question: 'How many discovery calls will you make',
    icon: <path d="M4 4.5c0-1 .8-2 1.8-2h1.2c.4 0 .8.3.9.7L8.7 6c.1.4 0 .8-.3 1L7.3 8a8 8 0 0 0 3.5 3.5l1-1.1c.3-.3.7-.4 1.1-.3l2.6.7c.4.1.7.5.7.9v1.2c0 1-1 1.9-2 1.8C8 14.4 4 10.4 4 4.5z" strokeLinejoin="round" />,
  },
];
const CHANNEL_BY_ID: Record<ChannelId, ChannelDef> = Object.fromEntries(CHANNELS.map(c => [c.id, c])) as Record<ChannelId, ChannelDef>;

/* ── days ── */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEKDAY_COUNT = 5; // Mon–Fri
const isWeekend = (i: number) => i >= WEEKDAY_COUNT;

/** Per-channel array of 7 daily values (Mon…Sun). */
type Plan = Record<ChannelId, number[]>;

const emptyPlan = (): Plan => ({ email: Array(7).fill(0), linkedin: Array(7).fill(0), calls: Array(7).fill(0) });

/** Seed a weekday-only plan from a single per-day value per channel. */
const weekdayPlan = (email: number, linkedin: number, calls: number): Plan => ({
  email: DAYS.map((_, i) => (isWeekend(i) ? 0 : email)),
  linkedin: DAYS.map((_, i) => (isWeekend(i) ? 0 : linkedin)),
  calls: DAYS.map((_, i) => (isWeekend(i) ? 0 : calls)),
});

/* ── campaign model (real data from both systems) ──
   Two campaign systems feed this screen: lead-funnel "Import" campaigns
   (listImportCampaigns) and HR/search "Search" campaigns (hr listCampaigns).
   They're normalised into one shape. Until a saved weekly plan is loaded, the
   planner seeds from the campaign's per-day email goal (weekdays only). */

type CampaignSource = 'lead_funnel' | 'hr';

interface Campaign {
  id: string;
  source: CampaignSource;
  name: string;
  kind: 'Search' | 'Import';
  industry: string;
  prospects: number;
  dailyEmailGoal: number;
  status: string;
  defaultPlan: Plan;
}

const DEFAULT_EMAIL_GOAL = 3;

/** Placeholder plan seeded from the email goal when a campaign has no saved plan. */
const deriveDefaultPlan = (dailyEmailGoal: number): Plan =>
  weekdayPlan(Math.max(0, dailyEmailGoal || 0), 0, 0);

/** Coerce an API weekly plan into a full 7-length-per-channel local Plan. */
const toPlan = (wp: WeeklyPlan | undefined, dailyEmailGoal: number): Plan => {
  if (!wp) return deriveDefaultPlan(dailyEmailGoal);
  const row = (a: number[] | undefined) => {
    const r = (a ?? []).slice(0, 7).map(n => Math.max(0, Math.floor(Number(n) || 0)));
    while (r.length < 7) r.push(0);
    return r;
  };
  return { email: row(wp.email), linkedin: row(wp.linkedin), calls: row(wp.calls) };
};

/* ── shared style bits (mirrors LinkedInBoardLive / EmailBoardLive) ── */

const primaryBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const ghostBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-bg)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const caps: React.CSSProperties = { fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-text-3)' };

function SectionIcon({ children, color = 'var(--color-brand-text)' }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', flexShrink: 0, background: 'var(--color-brand-subtle)', color }}>
      <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
    </span>
  );
}

function ChannelGlyph({ ch, size = 14, color }: { ch: ChannelDef; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color ?? ch.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ch.icon}</svg>
  );
}

/* ── channel-mix donut with the weekly total in the centre ── */

function MixDonut({ segments, total, size = 132 }: { segments: { value: number; color: string }[]; total: number; size?: number }) {
  const sw = 12;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const sum = segments.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--color-border)" strokeWidth={sw} />
        {sum > 0 && segments.map((seg, i) => {
          const frac = seg.value / sum;
          const dash = frac * c;
          const el = (
            <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={seg.color} strokeWidth={sw}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset}
              style={{ transition: 'stroke-dasharray .4s ease, stroke-dashoffset .4s ease' }} />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size < 110 ? '20px' : '30px', fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1 }}>{total}</span>
        <span style={{ ...caps, marginTop: '2px', fontSize: size < 110 ? '9px' : '10.5px' }}>per week</span>
      </div>
    </div>
  );
}

/* ── compact number stepper cell ── */

function StepCell({ value, disabled, onChange, accent }: { value: number; disabled?: boolean; onChange: (v: number) => void; accent: string }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <input
      type="number" min={0} inputMode="numeric"
      value={disabled ? '' : value}
      disabled={disabled}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onChange={e => onChange(Math.max(0, Math.min(999, Math.floor(Number(e.target.value) || 0))))}
      style={{
        width: '46px', textAlign: 'center', padding: '7px 4px', fontSize: '13px', fontWeight: 600,
        fontFamily: 'var(--font-sans)', color: value > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)',
        background: disabled ? 'var(--color-surface)' : 'var(--color-bg)',
        border: `1.5px solid ${focus ? accent : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-sm)', outline: 'none',
        boxShadow: focus ? `0 0 0 3px ${accent}22` : 'none',
        transition: 'border-color .12s, box-shadow .12s',
      }}
    />
  );
}

/* ── stat tile ── */

function StatTile({ label, value, color, ch }: { label: string; value: number; color: string; ch: ChannelDef }) {
  return (
    <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', background: 'var(--color-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
        <span style={{ display: 'inline-flex', width: 20, height: 20, borderRadius: 'var(--radius-sm)', alignItems: 'center', justifyContent: 'center', background: color, opacity: 0.14 }} />
        <span style={{ marginLeft: '-27px', display: 'inline-flex' }}><ChannelGlyph ch={ch} size={13} color={color} /></span>
        <span style={{ ...caps, color: 'var(--color-text-2)' }}>{label}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '3px' }}>per week</div>
    </div>
  );
}

/* ── left rail: campaign list ── */

function CampaignRow({ c, selected, onSelect }: { c: Campaign; selected: boolean; onSelect: () => void }) {
  const [hov, setHov] = React.useState(false);
  const weekly = CHANNELS.reduce((s, ch) => s + c.defaultPlan[ch.id].reduce((a, b) => a + b, 0), 0);
  return (
    <div onClick={onSelect} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 20px', cursor: 'pointer',
        minHeight: '54px', borderBottom: '1px solid var(--color-border)',
        borderLeft: `3px solid ${selected ? 'var(--color-brand)' : 'transparent'}`,
        background: selected ? 'var(--color-brand-subtle)' : hov ? 'var(--color-row-hover)' : 'var(--color-bg)',
      }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', flexShrink: 0, background: 'var(--color-surface)', color: 'var(--color-text-2)' }}>
        <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.5" y="2.5" width="13" height="13" rx="1.8" /><line x1="2.5" y1="7.5" x2="15.5" y2="7.5" /><line x1="7.5" y1="2.5" x2="7.5" y2="15.5" />
        </svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[c.industry, c.prospects > 0 ? `${c.prospects} prospects` : null].filter(Boolean).join(' · ')}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        <Badge variant={selected ? 'info' : 'neutral'}>{weekly}/wk</Badge>
        <span style={{ fontSize: '10.5px', color: 'var(--color-text-3)' }}>{c.kind}</span>
      </div>
    </div>
  );
}

/* ── right pane: per-day questionnaire + live weekly calc ── */

function GoalPlanner({ campaign, onClose, onSaved }: { campaign: Campaign; onClose: () => void; onSaved: (plan: Plan) => void }) {
  const seededWeekends =
    campaign.defaultPlan.email.slice(WEEKDAY_COUNT).some(v => v > 0)
    || campaign.defaultPlan.linkedin.slice(WEEKDAY_COUNT).some(v => v > 0)
    || campaign.defaultPlan.calls.slice(WEEKDAY_COUNT).some(v => v > 0);

  const [plan, setPlan] = React.useState<Plan>(campaign.defaultPlan);
  const [includeWeekends, setIncludeWeekends] = React.useState(seededWeekends);
  // Days the user has individually edited (keyed `${channel}:${dayIndex}`). Monday is
  // the master and is never pinned; editing Monday fills every UNPINNED active day.
  const [pinned, setPinned] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const [savedTick, setSavedTick] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);

  const activeDays = includeWeekends ? 7 : WEEKDAY_COUNT;
  const dayActive = (i: number) => includeWeekends || !isWeekend(i);

  const setCell = (ch: ChannelId, day: number, v: number) => {
    setSavedTick(false);
    if (day === 0) {
      // Editing Monday live-fills every active day that hasn't been pinned.
      setPlan(p => ({ ...p, [ch]: p[ch].map((old, i) =>
        i === 0 ? v : (dayActive(i) && !pinned.has(`${ch}:${i}`) ? v : old)) }));
    } else {
      // Editing another day pins it — Monday no longer overrides it.
      setPinned(prev => { const n = new Set(prev); n.add(`${ch}:${day}`); return n; });
      setPlan(p => ({ ...p, [ch]: p[ch].map((old, i) => (i === day ? v : old)) }));
    }
  };

  // Re-link everything: clear pins and copy Monday across all active days.
  const copyMonday = () => {
    setSavedTick(false);
    setPinned(new Set());
    setPlan(p => {
      const next = emptyPlan();
      (Object.keys(p) as ChannelId[]).forEach(ch => {
        next[ch] = DAYS.map((_, i) => (dayActive(i) ? p[ch][0] : 0));
      });
      return next;
    });
  };

  const reset = () => { setPlan(campaign.defaultPlan); setPinned(new Set()); setIncludeWeekends(seededWeekends); setSavedTick(false); setSaveErr(null); };

  // Zero out inactive (weekend-off) days so the stored plan matches what's shown.
  const planToSave = (): Plan => {
    const out = emptyPlan();
    (Object.keys(plan) as ChannelId[]).forEach(ch => {
      out[ch] = plan[ch].map((v, i) => (dayActive(i) ? v : 0));
    });
    return out;
  };

  // Today's board was already built from the OLD goal, and it is never rebuilt
  // mid-day — the worklist is seeded once, by the daily rollover. So a new goal has
  // no effect until the next list. Saying so up front avoids the reasonable
  // assumption that raising the goal adds accounts to the screen right now.
  const [confirmSave, setConfirmSave] = React.useState(false);

  const save = async () => {
    setSaving(true); setSaveErr(null);
    const next = planToSave();
    try {
      if (campaign.source === 'lead_funnel') await updateImportCampaign(campaign.id, { weeklyPlan: next });
      else await updateHrCampaign(campaign.id, { weeklyPlan: next });
      onSaved(next);
      setPlan(next);
      setSavedTick(true);
      setConfirmSave(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Could not save the weekly goal');
    } finally { setSaving(false); }
  };

  /* ── live calculations ── */
  const channelWeekly = (ch: ChannelId) =>
    plan[ch].reduce((s, v, i) => s + (dayActive(i) ? v : 0), 0);
  const dayTotal = (i: number) =>
    dayActive(i) ? CHANNELS.reduce((s, ch) => s + plan[ch.id][i], 0) : 0;
  const weeklyTotal = CHANNELS.reduce((s, ch) => s + channelWeekly(ch.id), 0);

  const segments = CHANNELS.map(ch => ({ value: channelWeekly(ch.id), color: ch.color }));

  return (
    <aside style={{ flex: '60 1 0', minWidth: '460px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* header */}
      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-1)' }}>{campaign.name}</span>
            <Badge variant="info">{campaign.kind}</Badge>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', marginTop: '3px' }}>
            Set your daily commitment.
          </div>
        </div>
        <button onClick={onClose} title="Close" style={{ width: '26px', height: '26px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-3)', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
        </button>
      </div>

      {/* scrolling body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* summary card */}
        <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <div style={{ display: 'flex', gap: '22px', alignItems: 'center', flexWrap: 'wrap' }}>
            <MixDonut segments={segments} total={weeklyTotal} />
            <div style={{ flex: 1, minWidth: '260px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                {CHANNELS.map(ch => (
                  <StatTile key={ch.id} ch={ch} label={ch.label} value={channelWeekly(ch.id)} color={ch.color} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* per-day questionnaire */}
        <div style={{ background: 'var(--color-surface)', borderLeft: '4px solid var(--color-brand)', padding: '13px 22px 13px 18px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)' }}>
          <SectionIcon><rect x="2.5" y="3.5" width="13" height="11" rx="1.5" /><line x1="2.5" y1="7" x2="15.5" y2="7" /><line x1="6" y1="1.5" x2="6" y2="5" /><line x1="12" y1="1.5" x2="12" y2="5" /></SectionIcon>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Per-day commitment</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* weekends toggle — enabling fills Sat/Sun from Monday for unpinned days */}
            <button onClick={() => setIncludeWeekends(v => {
              const next = !v;
              if (next) setPlan(p => {
                const out = { ...p };
                (Object.keys(p) as ChannelId[]).forEach(ch => {
                  out[ch] = p[ch].map((old, i) => (isWeekend(i) && !pinned.has(`${ch}:${i}`) ? p[ch][0] : old));
                });
                return out;
              });
              setSavedTick(false);
              return next;
            })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-full)', background: 'var(--color-bg)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-2)' }}>
              <span style={{ width: 30, height: 16, borderRadius: 999, background: includeWeekends ? 'var(--color-brand)' : 'var(--color-border-2)', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2, left: includeWeekends ? 16 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
              </span>
              Weekends
            </button>
          </div>
        </div>

        <div style={{ padding: '10px 22px 20px', overflowX: 'auto' }}>
          {/* day header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0 10px', minWidth: 'fit-content' }}>
            <div style={{ width: '150px', flexShrink: 0 }} />
            {DAYS.map((d, i) => (
              <div key={d} style={{ width: '46px', textAlign: 'center', flexShrink: 0, ...caps, color: dayActive(i) ? 'var(--color-text-2)' : 'var(--color-text-3)', opacity: dayActive(i) ? 1 : 0.5 }}>{d}</div>
            ))}
            <div style={{ width: '64px', textAlign: 'center', flexShrink: 0, ...caps, color: 'var(--color-brand-text)' }}>Week</div>
          </div>

          {/* channel rows */}
          {CHANNELS.map(ch => (
            <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 0', borderTop: '1px solid var(--color-border)', minWidth: 'fit-content' }}>
              <div style={{ width: '150px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 'var(--radius-sm)', flexShrink: 0, background: 'var(--color-surface)' }}>
                  <ChannelGlyph ch={ch} size={14} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)' }}>{ch.label}</div>
                </div>
              </div>
              {DAYS.map((d, i) => (
                <div key={d} style={{ width: '46px', flexShrink: 0 }}>
                  <StepCell value={plan[ch.id][i]} disabled={!dayActive(i)} accent={ch.color} onChange={v => setCell(ch.id, i, v)} />
                </div>
              ))}
              <div style={{ width: '64px', textAlign: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: ch.color }}>{channelWeekly(ch.id)}</span>
              </div>
            </div>
          ))}

          {/* daily totals footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 0 0', borderTop: '1.5px solid var(--color-border-2)', marginTop: '2px', minWidth: 'fit-content' }}>
            <div style={{ width: '150px', flexShrink: 0, fontSize: '12px', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Daily total</div>
            {DAYS.map((d, i) => (
              <div key={d} style={{ width: '46px', textAlign: 'center', flexShrink: 0, fontSize: '13.5px', fontWeight: 700, color: dayActive(i) ? 'var(--color-text-1)' : 'var(--color-text-3)', opacity: dayActive(i) ? 1 : 0.5 }}>{dayTotal(i)}</div>
            ))}
            <div style={{ width: '64px', textAlign: 'center', flexShrink: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-brand-text)' }}>{weeklyTotal}</div>
          </div>
        </div>
      </div>

      {/* pinned action bar */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '14px 22px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {saveErr && <span style={{ fontSize: '12px', color: 'var(--color-danger-text)', maxWidth: '220px' }}>{saveErr}</span>}
          {savedTick && !saveErr && <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-success-text)' }}>Saved ✓</span>}
          <button onClick={reset} disabled={saving} style={ghostBtn}>Reset</button>
          <button onClick={() => { setSaveErr(null); setConfirmSave(true); }} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving…' : 'Save weekly goal'}</button>
          <ConfirmDialog
            open={confirmSave}
            title="Apply this goal from the next task list?"
            message={
              <>
                Today&rsquo;s task list stays as it is — it was already built from the
                current goal, and the list is only rebuilt once a day.
                <br /><br />
                <strong>{campaign.name}</strong> will use the new goal from its next
                task list onward.
              </>
            }
            confirmLabel="Yes, save it"
            cancelLabel="Cancel"
            loading={saving}
            loadingLabel="Saving…"
            error={saveErr}
            onConfirm={save}
            onCancel={() => { if (!saving) { setConfirmSave(false); setSaveErr(null); } }}
          />
        </div>
      </div>
    </aside>
  );
}

/* ── main view ── */

/** Normalise a lead-funnel import campaign into the unified shape. */
function fromImportCampaign(c: Awaited<ReturnType<typeof listImportCampaigns>>['campaigns'][number]): Campaign {
  const goal = typeof c.dailyEmailGoal === 'number' ? c.dailyEmailGoal : DEFAULT_EMAIL_GOAL;
  return {
    id: c._id, source: 'lead_funnel', name: c.name, kind: 'Import',
    industry: c.industry || '—', prospects: 0, dailyEmailGoal: goal,
    status: c.status || 'active', defaultPlan: toPlan(c.weeklyPlan, goal),
  };
}

/** Normalise an HR/search campaign into the unified shape. */
function fromHrCampaign(c: Awaited<ReturnType<typeof listHrCampaigns>>[number]): Campaign {
  const goal = typeof c.dailyEmailGoal === 'number' ? c.dailyEmailGoal : DEFAULT_EMAIL_GOAL;
  return {
    id: c.id, source: 'hr', name: c.name, kind: 'Search',
    industry: c.jobType || c.source || '—', prospects: c.stats?.totalProspects ?? 0,
    dailyEmailGoal: goal, status: c.status || 'active', defaultPlan: toPlan(c.weeklyPlan, goal),
  };
}

export function WeeklyGoalsView() {
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string>('');
  // Current daily streak (from My Tasks) + this week's per-day actuals — surfaced
  // here so the user sees real progress (sent/done) against the plan, now that
  // automated first contact also counts toward them.
  const [streak, setStreak] = React.useState<number | null>(null);
  const [progress, setProgress] = React.useState<WeeklyProgress | null>(null);

  React.useEffect(() => {
    // Best-effort: progress is a nicety, so a failure never blocks the screen.
    fetchMyTasksToday().then(d => setStreak(d.streak)).catch(() => setStreak(null));
    fetchWeeklyProgress().then(setProgress).catch(() => setProgress(null));
  }, []);

  React.useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    // Both systems are optional — one failing shouldn't blank the whole list.
    Promise.allSettled([listImportCampaigns(), listHrCampaigns()])
      .then(([imp, hr]) => {
        if (!alive) return;
        const list: Campaign[] = [];
        // Only ACTIVE campaigns set goals here — a paused campaign is not being worked,
        // so it has no weekly target to track. Collaborators set no goals either, so
        // Weekly Goals shows only ACTIVE campaigns you OWN.
        const isActive = (s?: string) => (s || 'active') === 'active';
        if (imp.status === 'fulfilled') list.push(...imp.value.campaigns.filter(c => c.myRole !== 'collaborator' && isActive(c.status)).map(fromImportCampaign));
        if (hr.status === 'fulfilled') list.push(...hr.value.filter(c => !c.isLegacy && isActive(c.status)).map(fromHrCampaign));
        if (imp.status === 'rejected' && hr.status === 'rejected') {
          setError('Could not load campaigns.');
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        setCampaigns(list);
        setSelectedId(prev => (prev && list.some(c => c.id === prev)) ? prev : (list[0]?.id ?? ''));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const selected = campaigns.find(c => c.id === selectedId) ?? null;

  const overallStats = React.useMemo(() => {
    let emailTotal = 0;
    let linkedinTotal = 0;
    let callsTotal = 0;

    campaigns.forEach(c => {
      emailTotal += c.defaultPlan.email.reduce((a, b) => a + b, 0);
      linkedinTotal += c.defaultPlan.linkedin.reduce((a, b) => a + b, 0);
      callsTotal += c.defaultPlan.calls.reduce((a, b) => a + b, 0);
    });

    const grandTotal = emailTotal + linkedinTotal + callsTotal;
    const segments = [
      { value: emailTotal, color: CHANNELS[0].color },
      { value: linkedinTotal, color: CHANNELS[1].color },
      { value: callsTotal, color: CHANNELS[2].color },
    ];

    return { emailTotal, linkedinTotal, callsTotal, grandTotal, segments };
  }, [campaigns]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--color-border)', gap: '10px', flexShrink: 0 }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>Weekly Goals</span>
        <span style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>Pick a campaign and set a per-day commitment.</span>
      </div>

      {/* body: campaign list + planner */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* left rail: campaigns + overall status */}
        <div style={{ flex: '40 1 0', overflowY: 'auto', minWidth: '320px' }}>
          {/* overall status section header */}
          <div style={{ background: 'var(--color-surface)', borderLeft: '4px solid var(--color-brand)', padding: '14px 24px 14px 20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)' }}>
            <SectionIcon><circle cx="9" cy="9" r="7" /><polyline points="9 5 9 9 12 11" /></SectionIcon>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Overall Status</span>
            {streak !== null && (
              <span
                title={streak > 0
                  ? `${streak}-day streak — days you hit your daily goal in a row (automated first contact counts too)`
                  : 'No streak yet — hit your daily goal to start one (automated first contact counts too)'}
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700,
                  color: streak > 0 ? 'var(--color-warning-text)' : 'var(--color-text-3)',
                  background: streak > 0 ? 'var(--color-warning-bg)' : 'var(--color-bg)',
                  border: streak > 0 ? 'none' : '1px solid var(--color-border)',
                  padding: '3px 10px', borderRadius: 'var(--radius-full)' }}
              >
                <span aria-hidden style={{ fontSize: '13px', lineHeight: 1, filter: streak > 0 ? 'none' : 'grayscale(1)' }}>🔥</span>
                {streak > 0 ? `${streak}-day streak` : 'No streak yet'}
              </span>
            )}
            {!loading && <Badge variant="info" style={{ marginLeft: streak !== null ? '0' : 'auto' }}>{overallStats.grandTotal}/wk total</Badge>}
          </div>

          {/* overall status card */}
          {!loading && (
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <MixDonut segments={overallStats.segments} total={overallStats.grandTotal} size={96} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {CHANNELS.map(ch => {
                    const val = ch.id === 'email' ? overallStats.emailTotal : ch.id === 'linkedin' ? overallStats.linkedinTotal : overallStats.callsTotal;
                    return (
                      <div key={ch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <ChannelGlyph ch={ch} size={13} color={ch.color} />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.label}</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)' }}>{val}<span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--color-text-3)', marginLeft: '3px' }}>/wk</span></span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* This week's actuals — what actually got sent/done per day (all
                  campaigns), so the plan above is read against real progress. */}
              {progress && (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ ...caps, fontSize: '10.5px' }}>This week · done</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                      <span style={{ color: CHANNELS[0].color, fontWeight: 700 }}>{progress.emailWeekDone}</span> email
                      {' · '}
                      <span style={{ color: CHANNELS[1].color, fontWeight: 700 }}>{progress.linkedinWeekDone}</span> LinkedIn
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
                    {progress.days.map(d => {
                      const total = d.emailDone + d.linkedinDone;
                      return (
                        <div key={d.date}
                          title={`${DAYS[d.weekday]}: ${d.emailDone} email · ${d.linkedinDone} LinkedIn`}
                          style={{
                            textAlign: 'center', padding: '6px 2px', borderRadius: 'var(--radius-md)',
                            background: d.isToday ? 'var(--color-brand-subtle)' : 'var(--color-bg)',
                            border: `1px solid ${d.isToday ? 'var(--color-brand)' : 'var(--color-border)'}`,
                          }}>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: d.isToday ? 'var(--color-brand-text)' : 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{DAYS[d.weekday]}</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: total > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)', marginTop: '2px' }}>{total}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* campaigns section header */}
          <div style={{ background: 'var(--color-surface)', borderLeft: '4px solid var(--color-brand)', padding: '14px 24px 14px 20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)' }}>
            <SectionIcon><rect x="2.5" y="2.5" width="13" height="13" rx="1.8" /><line x1="2.5" y1="7.5" x2="15.5" y2="7.5" /><line x1="7.5" y1="2.5" x2="7.5" y2="15.5" /></SectionIcon>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Campaigns</span>
            {!loading && <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '3px 9px', borderRadius: 'var(--radius-full)', marginLeft: 'auto' }}>{campaigns.length}</span>}
          </div>
          {loading ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)' }}>Loading campaigns…</div>
          ) : error ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-danger-text)' }}>{error}</div>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)' }}>No campaigns yet. Create one to set a weekly goal.</div>
          ) : campaigns.map(c => (
            <CampaignRow key={c.id} c={c} selected={c.id === selectedId} onSelect={() => setSelectedId(c.id)} />
          ))}
        </div>

        {/* right pane: planner */}
        {selected
          ? <GoalPlanner key={selected.id} campaign={selected} onClose={() => setSelectedId('')}
              onSaved={plan => setCampaigns(prev => prev.map(c => c.id === selected.id ? { ...c, defaultPlan: plan, dailyEmailGoal: plan.email[0] } : c))} />
          : (
            <div style={{ flex: '60 1 0', minWidth: '460px', borderLeft: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-2)', marginBottom: '6px' }}>{loading ? 'Loading…' : 'Select a campaign'}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-3)', lineHeight: 1.6, maxWidth: '320px' }}>Choose a campaign on the left to set its per-day commitment and see the weekly goal calculated live.</div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
