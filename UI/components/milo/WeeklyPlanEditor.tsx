'use client';
import React from 'react';
import type { WeeklyPlan } from '@/lib/leadFunnelApi';

/* ═══════════════════════════════════════════════════════════════════════════
   WeeklyPlanEditor — the shared per-day commitment grid.
   Self-contained: manages its own plan/pins/weekends state, renders the grid +
   "Copy Mon → all" + weekends toggle + a Save button. Used by the campaign
   Settings tabs (lead-funnel + HR). Linking rule: editing Monday live-fills every
   active day that hasn't been individually edited ("pinned"); editing any other
   day pins it so Monday no longer overrides it.
   ═══════════════════════════════════════════════════════════════════════════ */

type ChannelId = 'email' | 'linkedin' | 'calls';
const CHANNELS: { id: ChannelId; label: string; color: string }[] = [
  { id: 'email', label: 'Emails', color: 'var(--color-brand)' },
  { id: 'linkedin', label: 'LinkedIn', color: 'var(--color-avatar-blue)' },
  { id: 'calls', label: 'Phone Calls', color: 'var(--color-warning)' },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEKDAY_COUNT = 5;
const isWeekend = (i: number) => i >= WEEKDAY_COUNT;

type Plan = Record<ChannelId, number[]>;
const emptyPlan = (): Plan => ({ email: Array(7).fill(0), linkedin: Array(7).fill(0), calls: Array(7).fill(0) });

const toPlan = (wp: WeeklyPlan | undefined): Plan => {
  const row = (a: number[] | undefined) => {
    const r = (a ?? []).slice(0, 7).map(n => Math.max(0, Math.floor(Number(n) || 0)));
    while (r.length < 7) r.push(0);
    return r;
  };
  return { email: row(wp?.email), linkedin: row(wp?.linkedin), calls: row(wp?.calls) };
};

const caps: React.CSSProperties = { fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-text-3)' };

function StepCell({ value, disabled, onChange, accent }: { value: number; disabled?: boolean; onChange: (v: number) => void; accent: string }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <input
      type="number" min={0} inputMode="numeric"
      value={disabled ? '' : value} disabled={disabled}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      onChange={e => onChange(Math.max(0, Math.min(999, Math.floor(Number(e.target.value) || 0))))}
      style={{
        width: '44px', textAlign: 'center', padding: '6px 4px', fontSize: '13px', fontWeight: 600,
        fontFamily: 'var(--font-sans)', color: value > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)',
        background: disabled ? 'var(--color-surface)' : 'var(--color-bg)',
        border: `1.5px solid ${focus ? accent : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-sm)', outline: 'none',
        boxShadow: focus ? `0 0 0 3px ${accent}22` : 'none', transition: 'border-color .12s, box-shadow .12s',
      }}
    />
  );
}

export function WeeklyPlanEditor({ initialPlan, onSave, saving }: {
  initialPlan: WeeklyPlan | undefined;
  onSave: (plan: WeeklyPlan) => Promise<void> | void;
  saving?: boolean;
}) {
  const seeded = React.useMemo(() => toPlan(initialPlan), [initialPlan]);
  const seededWeekends = CHANNELS.some(ch => seeded[ch.id].slice(WEEKDAY_COUNT).some(v => v > 0));

  const [plan, setPlan] = React.useState<Plan>(seeded);
  const [includeWeekends, setIncludeWeekends] = React.useState(seededWeekends);
  const [pinned, setPinned] = React.useState<Set<string>>(new Set());
  const [dirty, setDirty] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Re-seed when the source plan changes (e.g. after a successful save upstream).
  React.useEffect(() => { setPlan(seeded); setPinned(new Set()); setIncludeWeekends(seededWeekends); setDirty(false); }, [seeded, seededWeekends]);

  const dayActive = (i: number) => includeWeekends || !isWeekend(i);
  const activeDays = includeWeekends ? 7 : WEEKDAY_COUNT;

  const setCell = (ch: ChannelId, day: number, v: number) => {
    setDirty(true); setSaved(false);
    if (day === 0) {
      setPlan(p => ({ ...p, [ch]: p[ch].map((old, i) =>
        i === 0 ? v : (dayActive(i) && !pinned.has(`${ch}:${i}`) ? v : old)) }));
    } else {
      setPinned(prev => { const n = new Set(prev); n.add(`${ch}:${day}`); return n; });
      setPlan(p => ({ ...p, [ch]: p[ch].map((old, i) => (i === day ? v : old)) }));
    }
  };

  const copyMonday = () => {
    setDirty(true); setSaved(false); setPinned(new Set());
    setPlan(p => {
      const next = emptyPlan();
      (Object.keys(p) as ChannelId[]).forEach(ch => { next[ch] = DAYS.map((_, i) => (dayActive(i) ? p[ch][0] : 0)); });
      return next;
    });
  };

  const toggleWeekends = () => setIncludeWeekends(v => {
    const next = !v;
    if (next) setPlan(p => {
      const out = { ...p };
      (Object.keys(p) as ChannelId[]).forEach(ch => {
        out[ch] = p[ch].map((old, i) => (isWeekend(i) && !pinned.has(`${ch}:${i}`) ? p[ch][0] : old));
      });
      return out;
    });
    setDirty(true); setSaved(false);
    return next;
  });

  const channelWeekly = (ch: ChannelId) => plan[ch].reduce((s, v, i) => s + (dayActive(i) ? v : 0), 0);
  const dayTotal = (i: number) => dayActive(i) ? CHANNELS.reduce((s, ch) => s + plan[ch.id][i], 0) : 0;
  const weeklyTotal = CHANNELS.reduce((s, ch) => s + channelWeekly(ch.id), 0);

  const doSave = async () => {
    setErr(null);
    const out: WeeklyPlan = { email: [], linkedin: [], calls: [] };
    (Object.keys(plan) as ChannelId[]).forEach(ch => { out[ch] = plan[ch].map((v, i) => (dayActive(i) ? v : 0)); });
    try { await onSave(out); setDirty(false); setSaved(true); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not save the weekly plan'); }
  };

  return (
    <div>
      {/* controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>Weekly goal: <strong style={{ color: 'var(--color-brand-text)' }}>{weeklyTotal} touches / week</strong> · {activeDays} active days</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button type="button" onClick={copyMonday}
            style={{ padding: '5px 11px', fontSize: '12px', fontWeight: 600, background: 'var(--color-bg)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Copy Mon → all</button>
          <button type="button" onClick={toggleWeekends}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-full)', background: 'var(--color-bg)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-2)' }}>
            <span style={{ width: 30, height: 16, borderRadius: 999, background: includeWeekends ? 'var(--color-brand)' : 'var(--color-border-2)', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: includeWeekends ? 16 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
            </span>
            Weekends
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {/* day header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0 8px', minWidth: 'fit-content' }}>
          <div style={{ width: '120px', flexShrink: 0 }} />
          {DAYS.map((d, i) => (
            <div key={d} style={{ width: '44px', textAlign: 'center', flexShrink: 0, ...caps, color: dayActive(i) ? 'var(--color-text-2)' : 'var(--color-text-3)', opacity: dayActive(i) ? 1 : 0.5 }}>{d}</div>
          ))}
          <div style={{ width: '58px', textAlign: 'center', flexShrink: 0, ...caps, color: 'var(--color-brand-text)' }}>Week</div>
        </div>

        {/* channel rows */}
        {CHANNELS.map(ch => (
          <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderTop: '1px solid var(--color-border)', minWidth: 'fit-content' }}>
            <div style={{ width: '120px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)' }}>{ch.label}</div>
            {DAYS.map((d, i) => (
              <div key={d} style={{ width: '44px', flexShrink: 0 }}>
                <StepCell value={plan[ch.id][i]} disabled={!dayActive(i)} accent={ch.color} onChange={v => setCell(ch.id, i, v)} />
              </div>
            ))}
            <div style={{ width: '58px', textAlign: 'center', flexShrink: 0, fontSize: '15px', fontWeight: 700, color: ch.color }}>{channelWeekly(ch.id)}</div>
          </div>
        ))}

        {/* daily totals */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0 0', borderTop: '1.5px solid var(--color-border-2)', marginTop: '2px', minWidth: 'fit-content' }}>
          <div style={{ width: '120px', flexShrink: 0, ...caps, color: 'var(--color-text-2)' }}>Daily total</div>
          {DAYS.map((d, i) => (
            <div key={d} style={{ width: '44px', textAlign: 'center', flexShrink: 0, fontSize: '13.5px', fontWeight: 700, color: dayActive(i) ? 'var(--color-text-1)' : 'var(--color-text-3)', opacity: dayActive(i) ? 1 : 0.5 }}>{dayTotal(i)}</div>
          ))}
          <div style={{ width: '58px', textAlign: 'center', flexShrink: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-brand-text)' }}>{weeklyTotal}</div>
        </div>
      </div>

      {/* save row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
        {err && <span style={{ fontSize: '12px', color: 'var(--color-danger-text)' }}>{err}</span>}
        {saved && !err && <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-success-text)' }}>Saved ✓</span>}
        <button type="button" onClick={doSave} disabled={saving || !dirty}
          style={{ marginLeft: 'auto', padding: '8px 18px', background: (saving || !dirty) ? 'var(--color-border-2)' : 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: (saving || !dirty) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
          {saving ? 'Saving…' : 'Save weekly plan'}
        </button>
      </div>
    </div>
  );
}
