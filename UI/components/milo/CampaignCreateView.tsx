'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { createCampaign, createSchedule, getIcpConfig, type IcpConfig, type RunConfig, type ScheduleCreateBody, type ScheduleFrequency } from '@/lib/hrApi';
import { type Option, CheckBox, MultiSelectDropdown, SingleSelectDropdown } from './Dropdowns';
import { TimezoneSelect } from './TimezoneSelect';
import { buildWeekdayPlan } from '@/lib/weeklyPlan';

const FREQ_OPTIONS: { value: ScheduleFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'repeat', label: 'Repeat (pick days)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'once', label: 'Once' },
];
const DAYS = [
  { value: 0, short: 'Sun', full: 'Sunday' },
  { value: 1, short: 'Mon', full: 'Monday' },
  { value: 2, short: 'Tue', full: 'Tuesday' },
  { value: 3, short: 'Wed', full: 'Wednesday' },
  { value: 4, short: 'Thu', full: 'Thursday' },
  { value: 5, short: 'Fri', full: 'Friday' },
  { value: 6, short: 'Sat', full: 'Saturday' },
];

const Icon = ({ d, color = 'var(--color-brand)' }: { d: React.ReactNode; color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {d}
  </svg>
);

const sectionStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '20px',
};

const sectionTitle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)',
  marginBottom: '16px',
};

const labelCaps: React.CSSProperties = {
  fontSize: '10.5px', fontWeight: 700,
  color: 'var(--color-text-3)',
  textTransform: 'uppercase', letterSpacing: '0.7px',
  marginBottom: '6px', display: 'block',
};

const numericInput: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '15px', fontWeight: 600,
  color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)',
  outline: 'none',
};

export function CampaignCreateView() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  // Industries carry the backend slug in `id` (targetIndustries needs slugs).
  const [industries, setIndustries] = React.useState<Option[]>([]);
  const [titles, setTitles] = React.useState<Option[]>([]);
  const [cities, setCities] = React.useState<Option[]>([]);
  const [titleSearch, setTitleSearch] = React.useState('');
  const [showSelectedOnly, setShowSelectedOnly] = React.useState(false);
  const [customTitle, setCustomTitle] = React.useState('');
  const [resultsPerBatch, setResultsPerBatch] = React.useState('50');
  const [maxPostingAge, setMaxPostingAge] = React.useState('24');
  const [jobType, setJobType] = React.useState('Full-Time Only');
  // Per-channel Monday goals — the rest of the week is auto-filled on weekdays.
  // Email feeds the My-Tasks daily goal; LinkedIn = invites/day; Calls = calls/day.
  const [dailyEmailGoal, setDailyEmailGoal] = React.useState(3);
  const [dailyLinkedinGoal, setDailyLinkedinGoal] = React.useState(0);
  const [dailyCallsGoal, setDailyCallsGoal] = React.useState(0);
  const [sources, setSources] = React.useState<string[]>(['linkedin']);

  // ── Scheduling (optional automatic runs) ──
  const [scheduleEnabled, setScheduleEnabled] = React.useState(false);
  const [frequency, setFrequency] = React.useState<ScheduleFrequency>('daily');
  const [timeOfDay, setTimeOfDay] = React.useState('09:00');
  const [daysOfWeek, setDaysOfWeek] = React.useState<number[]>([1, 2, 3, 4, 5]);
  const [dayOfWeek, setDayOfWeek] = React.useState(1);
  const [dayOfMonth, setDayOfMonth] = React.useState(1);
  const [runAt, setRunAt] = React.useState('');
  const [timezone, setTimezone] = React.useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
  });

  const [icp, setIcp] = React.useState<IcpConfig | null>(null);
  const [loadingIcp, setLoadingIcp] = React.useState(true);
  const [icpError, setIcpError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [createdCampaignId, setCreatedCampaignId] = React.useState<string | null>(null);

  // Load the ICP config so the option lists reflect the backend's canonical
  // industries (slugs), titles and locations.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingIcp(true);
      setIcpError(null);
      try {
        const cfg = await getIcpConfig();
        if (cancelled) return;
        setIcp(cfg);
        setIndustries(
          cfg.industries.map(i => ({ id: i.slug, name: i.displayName, selected: i.isTarget }))
        );
        setTitles(
          cfg.titles
            .filter(t => t.isActive)
            .map((t, idx) => ({ id: 't' + idx, name: t.title, selected: t.isDefault }))
        );
        setCities(
          cfg.locations
            .filter(l => l.isActive)
            .map((l, idx) => ({ id: 'l' + idx, name: l.location, selected: l.isDefault }))
        );
      } catch (e) {
        if (!cancelled) setIcpError(e instanceof Error ? e.message : 'Failed to load ICP config');
      } finally {
        if (!cancelled) setLoadingIcp(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleIndustry = (id: string) =>
    setIndustries(arr => arr.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  const toggleTitle = (id: string) =>
    setTitles(arr => arr.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  const toggleCity = (id: string) =>
    setCities(arr => arr.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  const toggleSource = (s: string) =>
    setSources(arr => arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s]);
  const toggleDay = (d: number) =>
    setDaysOfWeek(arr => arr.includes(d) ? arr.filter(x => x !== d) : [...arr, d]);

  const addCustomTitle = () => {
    const trimmed = customTitle.trim();
    if (!trimmed) return;
    setTitles(arr => [...arr, { id: 'custom-' + Date.now(), name: trimmed, selected: true }]);
    setCustomTitle('');
  };

  const selectedTitleCount = titles.filter(t => t.selected).length;
  const selectedIndustryCount = industries.filter(i => i.selected).length;
  const filteredTitles = titles.filter(t =>
    t.name.toLowerCase().includes(titleSearch.toLowerCase()) &&
    (!showSelectedOnly || t.selected)
  );

  const scheduleValid = () => {
    if (!scheduleEnabled) return true;
    if (frequency === 'once') return !!runAt;
    if (!timeOfDay) return false;
    if (frequency === 'repeat') return daysOfWeek.length > 0;
    return true; // daily / weekly / monthly have safe defaults
  };

  const canCreate =
    name.trim().length > 0 &&
    sources.length > 0 &&
    selectedIndustryCount > 0 &&
    scheduleValid() &&
    !submitting &&
    !loadingIcp;

  const handleCreate = async () => {
    if (!canCreate) return;
    setSubmitting(true);
    setSubmitError(null);
    const runConfig: RunConfig = {
      searchTitles: titles.filter(t => t.selected).map(t => t.name),
      searchLocations: cities.filter(c => c.selected).map(c => c.name),
      targetIndustries: industries.filter(i => i.selected).map(i => i.id), // slugs
      hoursOld: parseInt(maxPostingAge) || 24,
      resultsPerSearch: parseInt(resultsPerBatch) || 50,
      siteName: sources,
      icpConfigSnapshot: icp ? { icpConfigId: icp.id, version: icp.version } : null,
    };
    try {
      // Reuse an already-created campaign id if a previous schedule attempt failed,
      // so retrying doesn't create a duplicate campaign.
      let campaignId = createdCampaignId;
      if (!campaignId) {
        const created = await createCampaign({
          name: name.trim(), runConfig, jobType, dailyEmailGoal,
          weeklyPlan: buildWeekdayPlan(dailyEmailGoal, dailyLinkedinGoal, dailyCallsGoal),
        });
        campaignId = created.id!;
        setCreatedCampaignId(campaignId);
      }

      if (scheduleEnabled) {
        const payload: ScheduleCreateBody = {
          name: name.trim(),
          campaignId,
          runConfig,
          frequency,
          timezone,
        };
        if (frequency === 'once') {
          payload.runAt = new Date(runAt).toISOString();
        } else {
          payload.timeOfDay = timeOfDay;
          if (frequency === 'repeat') payload.daysOfWeek = [...daysOfWeek].sort((a, b) => a - b);
          if (frequency === 'weekly') payload.dayOfWeek = dayOfWeek;
          if (frequency === 'monthly') payload.dayOfMonth = dayOfMonth;
        }
        await createSchedule(payload);
      }

      router.push(`/campaigns/${campaignId}`);
    } catch (e) {
      const base = createdCampaignId
        ? 'Campaign was created, but the schedule failed: '
        : 'Failed to create campaign: ';
      setSubmitError(base + (e instanceof Error ? e.message : 'Unknown error'));
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '10px 20px',
        borderBottom: '1px solid var(--color-border)', gap: '8px', flexShrink: 0,
      }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>New Campaign</span>
        <span style={{
          fontSize: '11.5px', fontWeight: 600,
          color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)',
          padding: '3px 10px', borderRadius: 'var(--radius-full)',
        }}>Draft</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {submitError && (
            <span style={{ fontSize: '12px', color: 'var(--color-danger-text)', fontWeight: 600 }}>{submitError}</span>
          )}
          <button onClick={() => router.back()} style={{
            padding: '6px 14px', border: '1px solid var(--color-border-2)', background: 'none',
            borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)',
          }}>Cancel</button>
          <button onClick={handleCreate} disabled={!canCreate} style={{
            padding: '6px 16px', background: 'var(--color-brand)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600,
            cursor: canCreate ? 'pointer' : 'not-allowed', opacity: canCreate ? 1 : 0.5,
            fontFamily: 'var(--font-sans)',
          }}>{submitting ? 'Creating…' : 'Create campaign'}</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-row-hover)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 24px 40px' }}>
          {/* Intro */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', margin: 0, marginBottom: '6px' }}>
              Target Customer Profile
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--color-text-2)', margin: 0, maxWidth: '640px', lineHeight: 1.55 }}>
              Define your Ideal Customer Profile parameters. Milo will use these criteria to curate and score high-intent leads across global job boards and professional networks.
            </p>
          </div>

          {icpError && (
            <div style={{
              padding: '12px 16px', marginBottom: '16px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)',
              fontSize: '13px', fontWeight: 600, border: '1px solid var(--color-danger-border)',
            }}>
              Could not load ICP configuration from the backend: {icpError}
            </div>
          )}

          {/* Campaign Name */}
          <section style={{ ...sectionStyle, marginBottom: '16px' }}>
            <label style={labelCaps}>Campaign Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. BC Healthcare Q2 outreach"
              style={{
                width: '100%', padding: '9px 12px',
                background: '#fff',
                border: '1px solid var(--color-border-2)',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px', color: 'var(--color-text-1)',
                fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
          </section>

          {loadingIcp ? (
            <div style={{ ...sectionStyle, textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>
              Loading targeting options…
            </div>
          ) : (
          /* Two-column grid */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'flex-start' }}>
            {/* LEFT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Target Industries */}
              <section style={sectionStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={sectionTitle as React.CSSProperties}>
                    <Icon d={<><rect x="2.5" y="6" width="13" height="9.5" rx="1.2" /><path d="M5.5 6V4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v2" /></>} />
                    Target Industries
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                    Multi-Select
                  </span>
                </div>
                {industries.length === 0 ? (
                  <span style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>No industries configured in ICP.</span>
                ) : (
                  <MultiSelectDropdown options={industries} onToggle={toggleIndustry} placeholder="Select industries…" searchPlaceholder="Search industries" />
                )}
              </section>

              {/* Executive Search Titles */}
              <section style={sectionStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={sectionTitle as React.CSSProperties}>
                    <Icon d={<><circle cx="9" cy="9" r="6.5" /><polyline points="6.5,9.2 8.3,11.5 12,6.5" /></>} />
                    Executive Search Titles
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-2)' }}>
                    {selectedTitleCount} / {titles.length} selected
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={titleSearch}
                    onChange={e => setTitleSearch(e.target.value)}
                    placeholder="Search titles..."
                    style={{
                      flex: 1, padding: '8px 12px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13px', color: 'var(--color-text-1)',
                      fontFamily: 'var(--font-sans)', outline: 'none',
                    }}
                  />
                  <button onClick={() => setShowSelectedOnly(s => !s)} style={pillBtn}>
                    {showSelectedOnly ? 'Show All' : 'Selected Only'}
                  </button>
                  <button onClick={() => setTitles(arr => arr.map(t => ({ ...t, selected: true })))} style={pillBtn}>
                    Select All
                  </button>
                  <button onClick={() => setTitles(arr => arr.map(t => ({ ...t, selected: false })))} style={pillBtn}>
                    Unselect All
                  </button>
                </div>

                <div style={{ maxHeight: '288px', overflowY: 'auto', paddingRight: '4px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {filteredTitles.map(t => (
                      <label key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: 'var(--radius-md)',
                        background: t.selected ? 'var(--color-brand-tint)' : 'var(--color-surface)',
                        border: `1px solid ${t.selected ? 'var(--color-brand-tint)' : 'transparent'}`,
                        cursor: 'pointer', transition: 'background .12s',
                      }}>
                        <CheckBox checked={t.selected} onChange={() => toggleTitle(t.id)} />
                        <span style={{
                          fontSize: '13px', fontWeight: 500,
                          color: t.selected ? 'var(--color-text-1)' : 'var(--color-text-2)',
                        }}>
                          {t.name}
                        </span>
                      </label>
                    ))}
                  </div>
                  {filteredTitles.length === 0 && (
                    <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                      No titles match this filter.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '8px' }}>
                  <input
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCustomTitle(); }}
                    placeholder="Add custom title..."
                    style={{
                      flex: 1, padding: '8px 12px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13px', color: 'var(--color-text-1)',
                      fontFamily: 'var(--font-sans)', outline: 'none',
                    }}
                  />
                  <button onClick={addCustomTitle} style={{
                    padding: '8px 14px', background: 'var(--color-text-1)', color: '#fff',
                    border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <line x1="7" y1="2" x2="7" y2="12" /><line x1="2" y1="7" x2="12" y2="7" />
                    </svg>
                  </button>
                </div>
              </section>

              {/* Pipeline Configuration */}
              <section style={sectionStyle}>
                <div style={sectionTitle as React.CSSProperties}>
                  <Icon d={<><line x1="2" y1="13" x2="14" y2="13" /><polyline points="3,10 6.5,6 9.5,8.5 13,4" /></>} />
                  Pipeline Configuration
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                  <div>
                    <label style={labelCaps}>Results per Batch</label>
                    <input type="number" value={resultsPerBatch} onChange={e => setResultsPerBatch(e.target.value)} style={numericInput} />
                  </div>
                  <div>
                    <label style={labelCaps}>Daily Email Goal</label>
                    <input type="number" min={1} max={50} value={dailyEmailGoal}
                      onChange={e => setDailyEmailGoal(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                      style={numericInput} title="Companies to email from this campaign per day — summed into My Tasks" />
                  </div>
                  <div>
                    <label style={labelCaps}>Daily LinkedIn Goal</label>
                    <input type="number" min={0} max={50} value={dailyLinkedinGoal}
                      onChange={e => setDailyLinkedinGoal(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                      style={numericInput} title="LinkedIn invites to send from this campaign per day — auto-filled across weekdays, editable later" />
                  </div>
                  <div>
                    <label style={labelCaps}>Daily Phone Goal</label>
                    <input type="number" min={0} max={50} value={dailyCallsGoal}
                      onChange={e => setDailyCallsGoal(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                      style={numericInput} title="Discovery calls to make from this campaign per day — auto-filled across weekdays, editable later" />
                  </div>
                  <div>
                    <label style={labelCaps}>Max Posting Age (hrs)</label>
                    <input type="number" value={maxPostingAge} onChange={e => setMaxPostingAge(e.target.value)} style={numericInput} />
                  </div>
                  <div>
                    <label style={labelCaps}>Job Type</label>
                    <select value={jobType} onChange={e => setJobType(e.target.value)} style={{
                      width: '100%', padding: '10px 12px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13.5px', color: 'var(--color-text-1)',
                      fontFamily: 'var(--font-sans)', outline: 'none', appearance: 'none',
                    }}>
                      <option>Full-Time Only</option>
                      <option>All Types</option>
                      <option>Contract</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelCaps}>Active Sources</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[{ id: 'linkedin', label: 'LinkedIn' }, { id: 'indeed', label: 'Indeed' }].map(s => {
                        const on = sources.includes(s.id);
                        return (
                          <button key={s.id} onClick={() => toggleSource(s.id)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '8px 12px', borderRadius: 'var(--radius-md)',
                            border: `1px solid ${on ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
                            background: on ? 'var(--color-brand)' : 'var(--color-surface)',
                            color: on ? '#fff' : 'var(--color-text-2)',
                            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                          }}>
                            {on && (
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="2,6.5 5,9.5 10,3.5" />
                              </svg>
                            )}
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <section style={sectionStyle}>
                <div style={sectionTitle as React.CSSProperties}>
                  <Icon d={<><path d="M9 1.5c-3 0-5.5 2.4-5.5 5.5 0 4 5.5 9.5 5.5 9.5s5.5-5.5 5.5-9.5c0-3.1-2.5-5.5-5.5-5.5z" /><circle cx="9" cy="7" r="2" /></>} />
                  Geography
                </div>
                {cities.length === 0 ? (
                  <span style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>No locations configured in ICP.</span>
                ) : (
                  <MultiSelectDropdown options={cities} onToggle={toggleCity} placeholder="Select locations…" searchPlaceholder="Search locations" />
                )}
              </section>

              {/* Schedule (optional automatic runs) */}
              <section style={sectionStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <div style={sectionTitle as React.CSSProperties}>
                      <Icon d={<><rect x="2.5" y="3.5" width="13" height="12" rx="1.5" /><line x1="2.5" y1="7" x2="15.5" y2="7" /><line x1="6" y1="1.5" x2="6" y2="5" /><line x1="12" y1="1.5" x2="12" y2="5" /></>} />
                      Schedule
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginTop: '4px', lineHeight: 1.45 }}>
                      Run this campaign automatically. Automated and manual runs both appear under the campaign.
                    </div>
                  </div>
                  <Switch on={scheduleEnabled} onToggle={() => setScheduleEnabled(v => !v)} />
                </div>

                {scheduleEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                    <div>
                      <label style={labelCaps}>Frequency</label>
                      <div style={{ marginTop: '6px' }}>
                        <SingleSelectDropdown
                          value={frequency}
                          options={FREQ_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                          onChange={v => setFrequency(v as ScheduleFrequency)}
                        />
                      </div>
                    </div>

                    {frequency === 'once' ? (
                      <div>
                        <label style={labelCaps}>Run at</label>
                        <input type="datetime-local" value={runAt} onChange={e => setRunAt(e.target.value)} style={selectStyle} />
                      </div>
                    ) : (
                      <div>
                        <label style={labelCaps}>Time of day</label>
                        <input type="time" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} style={selectStyle} />
                      </div>
                    )}

                    {frequency === 'repeat' && (
                      <div>
                        <label style={labelCaps}>Days of week</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {DAYS.map(d => {
                            const active = daysOfWeek.includes(d.value);
                            return (
                              <button key={d.value} onClick={() => toggleDay(d.value)} style={{
                                padding: '6px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)',
                                border: `1px solid ${active ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
                                background: active ? 'var(--color-brand)' : 'var(--color-bg)',
                                color: active ? '#fff' : 'var(--color-text-2)', transition: 'background .12s',
                              }}>{d.short}</button>
                            );
                          })}
                        </div>
                        {daysOfWeek.length === 0 && <div style={{ fontSize: '11.5px', color: 'var(--color-danger-text)', marginTop: '6px' }}>Select at least one day.</div>}
                      </div>
                    )}

                    {frequency === 'weekly' && (
                      <div>
                        <label style={labelCaps}>Day of week</label>
                        <div style={{ marginTop: '6px' }}>
                          <SingleSelectDropdown
                            value={String(dayOfWeek)}
                            options={DAYS.map(d => ({ value: String(d.value), label: d.full }))}
                            onChange={v => setDayOfWeek(Number(v))}
                          />
                        </div>
                      </div>
                    )}

                    {frequency === 'monthly' && (
                      <div>
                        <label style={labelCaps}>Day of month</label>
                        <input type="number" min={1} max={31} value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))} style={selectStyle} />
                      </div>
                    )}

                    {frequency !== 'once' && (
                      <div>
                        <label style={labelCaps}>Timezone</label>
                        <div style={{ marginTop: '6px' }}>
                          <TimezoneSelect value={timezone} onChange={setTimezone} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', marginTop: '6px',
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)', fontSize: '13.5px', color: 'var(--color-text-1)',
  fontFamily: 'var(--font-sans)', outline: 'none', appearance: 'none',
};

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} role="switch" aria-checked={on} style={{
      flexShrink: 0, width: '38px', height: '22px', borderRadius: 'var(--radius-full)',
      border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
      background: on ? 'var(--color-brand)' : 'var(--color-border-2)', transition: 'background .15s',
    }}>
      <span style={{
        position: 'absolute', top: '2px', left: on ? '18px' : '2px',
        width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
        transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

const pillBtn: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid var(--color-border-2)',
  background: 'var(--color-bg)',
  borderRadius: 'var(--radius-md)',
  fontSize: '12px', fontWeight: 500,
  color: 'var(--color-text-2)', cursor: 'pointer',
  fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
};

