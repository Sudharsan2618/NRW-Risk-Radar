'use client';

/**
 * When a campaign's automation runs — and what that time means for everyone else.
 *
 * The zone is stored as an IANA NAME, never an offset, so daylight saving is handled
 * by the tz database: "15:00 Europe/Berlin" stays 15:00 in Berlin through both
 * transitions and only the underlying UTC instant moves. The backend reads the same
 * database through Python's `zoneinfo`, so both sides always agree.
 *
 * Luxon does the zone arithmetic; the dropdowns are the app's shared
 * SingleSelectDropdown / TimezoneSelect — the same components the campaign-create
 * screen uses, so the timezone picker is identical everywhere and searchable by
 * friendly name (e.g. "Pacific Daylight Time"), backed by the curated list in
 * ./timezones.
 */

import React from 'react';
import { DateTime } from 'luxon';
import { SingleSelectDropdown } from './Dropdowns';
import { TimezoneSelect } from './TimezoneSelect';

export interface WeeklyPlanShape {
  email?: number[];
  linkedin?: number[];
  calls?: number[];
}

export interface AutomationScheduleProps {
  timezone: string;
  time: string;
  /** Drives the "runs on" summary — each channel is gated by its own row. */
  plan?: WeeklyPlanShape;
  /** Read-only until the user clicks Edit Details, matching the rest of Settings. */
  editable?: boolean;
  saving?: boolean;
  onChange: (next: { timezone: string; time: string }) => void;
}

interface Opt { value: string; label: string }

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Granularity of the time dropdown. 30 minutes covers every realistic slot without
 *  a 1,440-row list. */
const STEP_MINUTES = 30;

/** Canonical IANA name, so aliases collapse: Asia/Calcutta → Asia/Kolkata.
 *  Without this the comparison list showed the same zone twice under two names. */
function canonicalZone(zone: string): string {
  try {
    const resolved = Intl.DateTimeFormat('en-US', { timeZone: zone })
      .resolvedOptions().timeZone;
    return resolved || zone;
  } catch {
    return zone;
  }
}

function useTimeOptions(current: string): Opt[] {
  return React.useMemo(() => {
    const out: Opt[] = [];
    for (let m = 0; m < 24 * 60; m += STEP_MINUTES) {
      const dt = DateTime.fromObject({ hour: Math.floor(m / 60), minute: m % 60 });
      out.push({ value: dt.toFormat('HH:mm'), label: dt.toFormat('HH:mm  (h:mm a)') });
    }
    // A campaign already saved at, say, 15:20 must still show its own value.
    if (current && !out.some(o => o.value === current)) {
      out.unshift({ value: current, label: current });
    }
    return out;
  }, [current]);
}

/** The next moment this schedule fires, as a real instant. */
function nextRun(time: string, zone: string): DateTime | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time || '');
  if (!m) return null;
  const dt = DateTime.fromObject(
    { hour: Number(m[1]), minute: Number(m[2]), second: 0, millisecond: 0 },
    { zone },
  );
  if (!dt.isValid) return null;
  return dt <= DateTime.now() ? dt.plus({ days: 1 }) : dt;
}

/** Which weekdays the automation runs, and on which channels. A day with 0 for a
 *  channel does not run that channel; 0 on both runs nothing at all. */
function runsOn(plan?: WeeklyPlanShape): string {
  if (!plan) return '';
  const email = plan.email || [];
  const linkedin = plan.linkedin || [];
  const days = DAY_LABELS.map((label, i) => {
    const e = Number(email[i] || 0) > 0;
    const l = Number(linkedin[i] || 0) > 0;
    if (!e && !l) return null;
    return { label, both: e && l, emailOnly: e && !l, linkedinOnly: !e && l };
  }).filter(Boolean) as { label: string; both: boolean; emailOnly: boolean; linkedinOnly: boolean }[];

  if (days.length === 0) return 'Never — no channel has a goal on any day.';
  const group = (pick: (d: typeof days[0]) => boolean, name: string) => {
    const list = days.filter(pick).map(d => d.label);
    return list.length ? `${list.join(', ')} · ${name}` : null;
  };
  return [
    group(d => d.both, 'email + LinkedIn'),
    group(d => d.emailOnly, 'email only'),
    group(d => d.linkedinOnly, 'LinkedIn only'),
  ].filter(Boolean).join('   ·   ');
}

export function AutomationSchedule({
  timezone, time, plan, editable, saving, onChange,
}: AutomationScheduleProps) {
  const timeOptions = useTimeOptions(time);
  const next = nextRun(time, timezone);
  const localZone = canonicalZone(DateTime.local().zoneName || 'UTC');
  const campaignZone = canonicalZone(timezone);

  // The same instant, in the zones the team works in — de-duplicated by CANONICAL
  // name so an alias (Asia/Calcutta) can't list the same zone twice.
  const comparisons = React.useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const z of [localZone, campaignZone, 'Europe/Berlin', 'Asia/Kolkata', 'America/Toronto']) {
      const c = canonicalZone(z);
      if (!c || seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
    return out;
  }, [localZone, campaignZone]);

  return (
    <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {editable ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '150px', flexShrink: 0, ...(saving ? { opacity: 0.6, pointerEvents: 'none' as const } : {}) }}>
            <SingleSelectDropdown
              value={time}
              options={timeOptions}
              onChange={v => onChange({ timezone, time: v })}
              placeholder="Time…"
              searchable
              searchPlaceholder="Search time"
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TimezoneSelect
              value={timezone}
              onChange={v => onChange({ timezone: v, time })}
              disabled={saving}
            />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textAlign: 'right' }}>
          {time} <span style={{ fontWeight: 500, color: 'var(--color-text-2)' }}>{timezone}</span>
        </div>
      )}

      {saving && <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>Saving…</div>}

      {next && !saving && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-2)' }}>
            Next run {next.toRelative()} — {next.toFormat('ccc d LLL, HH:mm')}
          </div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {comparisons.map((z, i) => {
              const shown = next.setZone(z);
              const isSource = z === campaignZone;
              return (
                <div key={z} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '10px', padding: '5px 10px', fontSize: '11.5px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                  background: isSource ? 'var(--color-brand-subtle)' : 'transparent',
                }}>
                  <span style={{ color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {z.replace(/_/g, ' ')}{z === localZone ? ' (you)' : ''}
                  </span>
                  <span style={{
                    fontWeight: 700, flexShrink: 0,
                    color: isSource ? 'var(--color-brand-text)' : 'var(--color-text-1)',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}>
                    {shown.toFormat('HH:mm')}
                    <span style={{ fontWeight: 500, color: 'var(--color-text-3)' }}>
                      {' '}{shown.toFormat('ccc')}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {plan && (
        <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700, color: 'var(--color-text-2)' }}>Runs: </span>
          {runsOn(plan)}
        </div>
      )}
    </div>
  );
}

export default AutomationSchedule;
