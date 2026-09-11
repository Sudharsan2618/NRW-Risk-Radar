'use client';
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  fetchEmailSenders, fetchActiveUsers, createImportCampaign, importFileToRun, fetchOutreachTemplates,
  type EmailSender, type ActiveUser, type ImportFileResult, type OutreachTemplate,
} from '@/lib/leadFunnelApi';
import { type Option, MultiSelectDropdown, SingleSelectDropdown } from './Dropdowns';
import { buildWeekdayPlan } from '@/lib/weeklyPlan';

// ICP management levels → Apollo person_seniorities values.
const ICP_LEVELS: { value: string; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'founder', label: 'Founder' },
  { value: 'c_suite', label: 'C suite' },
  { value: 'partner', label: 'Partner' },
  { value: 'vp', label: 'Vp' },
  { value: 'head', label: 'Head' },
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
];

const Icon = ({ d, color = 'var(--color-brand)' }: { d: React.ReactNode; color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{d}</svg>
);

const sectionStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px',
};
const sectionTitle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)',
};
const labelCaps: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)',
  textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '2px',
};

interface TagInputProps {
  label: string;
  hint?: string;
  tags: string[];
  placeholder?: string;
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}

function TagInput({ label, hint, tags, placeholder, onAdd, onRemove }: TagInputProps) {
  const [val, setVal] = React.useState('');
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const clean = val.trim().replace(/,$/, '');
      if (clean && !tags.includes(clean)) {
        onAdd(clean);
        setVal('');
      }
    }
  };
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={labelCaps}>{label}</label>
      {hint && <p style={{ fontSize: '12px', color: 'var(--color-text-3)', margin: '0 0 6px', lineHeight: 1.4 }}>{hint}</p>}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '6px 10px',
        background: '#fff', border: '1px solid var(--color-border-2)',
        borderRadius: 'var(--radius-md)', minHeight: '38px', alignItems: 'center'
      }}>
        {tags.map(t => (
          <span key={t} style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '2px 8px', borderRadius: '4px', background: 'var(--color-surface)',
            border: '1px solid var(--color-border)', fontSize: '12.5px', fontWeight: 600,
            color: 'var(--color-text-1)', userSelect: 'none'
          }}>
            {t}
            <button type="button" onClick={() => onRemove(t)} style={{
              border: 'none', background: 'none', padding: 0, cursor: 'pointer',
              fontSize: '14px', fontWeight: 700, color: 'var(--color-text-3)',
              display: 'flex', alignItems: 'center', lineHeight: 1
            }}>×</button>
          </span>
        ))}
        <input
          type="text"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            const clean = val.trim();
            if (clean && !tags.includes(clean)) {
              onAdd(clean);
              setVal('');
            }
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{
            flex: 1, minWidth: '100px', border: 'none', outline: 'none',
            fontSize: '13.5px', color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)',
            background: 'transparent', padding: '2px 0'
          }}
        />
      </div>
    </div>
  );
}

export function CampaignImportView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');

  const [importType, setImportType] = React.useState<'prospects' | 'companies'>('prospects');
  const [name, setName] = React.useState('');
  // Per-channel Monday goals — the rest of the week is auto-filled on weekdays.
  // Email = companies/day (summed into the My-Tasks goal); LinkedIn = invites/day;
  // Calls = discovery calls/day. All editable later in Settings / Weekly Goals.
  const [dailyEmailGoal, setDailyEmailGoal] = React.useState(3);
  const [dailyLinkedinGoal, setDailyLinkedinGoal] = React.useState(0);
  const [dailyCallsGoal, setDailyCallsGoal] = React.useState(0);

  // ICP — Apollo management levels (person_seniorities). Used for company discovery.
  const [seniorities, setSeniorities] = React.useState<Option[]>(
    ICP_LEVELS.map(l => ({ id: l.value, name: l.label, selected: false }))
  );
  const toggleSeniority = (id: string) => setSeniorities(arr => arr.map(s => s.id === id ? { ...s, selected: !s.selected } : s));

  const [includeTitles, setIncludeTitles] = React.useState<string[]>([]);
  const [excludeTitles, setExcludeTitles] = React.useState<string[]>([]);
  const [departments, setDepartments] = React.useState<string[]>([]);

  const [owners, setOwners] = React.useState<Option[]>([]);
  // Default outreach templates for this campaign (empty = offer all in the panel).
  const [templates, setTemplates] = React.useState<Option[]>([]);
  const [senders, setSenders] = React.useState<EmailSender[]>([]);
  const [senderId, setSenderId] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    if (typeParam === 'companies') {
      setImportType('companies');
    } else {
      setImportType('prospects');
    }
    setFile(null);
  }, [typeParam]);

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<ImportFileResult | null>(null);
  const [createdCampaignId, setCreatedCampaignId] = React.useState<string | null>(null);
  const [createdRunId, setCreatedRunId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setLoadError(null);
      try {
        const [senderResp, users, tmplResp] = await Promise.all([
          fetchEmailSenders().catch(() => ({ success: false, senders: [] as EmailSender[] })),
          fetchActiveUsers().catch(() => [] as ActiveUser[]),
          fetchOutreachTemplates().catch(() => ({ success: false, templates: [] as OutreachTemplate[], total: 0 })),
        ]);
        if (cancelled) return;
        setSenders(senderResp.senders);
        const def = senderResp.senders.find(s => s.default) || senderResp.senders[0];
        if (def) setSenderId(def.id);
        setOwners(users.map(u => ({ id: u.id, name: u.full_name || u.email, selected: false })));
        setTemplates(tmplResp.templates.map(t => ({ id: t._id, name: t.name || `${t.industry} · ${t.persona}`, selected: false })));
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load options');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleOwner = (id: string) => setOwners(arr => arr.map(o => o.id === id ? { ...o, selected: !o.selected } : o));
  const toggleTemplate = (id: string) => setTemplates(arr => arr.map(t => t.id === id ? { ...t, selected: !t.selected } : t));

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (/\.(csv|xlsx|xls)$/i.test(f.name)) { setFile(f); setSubmitError(null); }
    else setSubmitError('Please upload a .csv or .xlsx file.');
  };

  const senderOptions = senders.map(s => ({ value: s.id, label: `${s.name} · ${s.email}` }));

  const canSubmit = name.trim().length > 0 && !!senderId && !!file && !submitting && !loading;

  const handleSubmit = async () => {
    if (!canSubmit || !file) return;
    setSubmitting(true); setSubmitError(null);
    try {
      // Reuse the campaign/run from a previous failed attempt so retrying the
      // import doesn't create a duplicate campaign.
      let runId = createdRunId;
      if (!createdCampaignId || !runId) {
        const sender = senders.find(s => s.id === senderId);
        const res = await createImportCampaign({
          name: name.trim(),
          industry: 'Imported',
          owners: owners.filter(o => o.selected).map(o => o.id),
          senderEmail: sender?.email,
          senderEngine: sender?.engine,
          importType,
          dailyEmailGoal,
          weeklyPlan: buildWeekdayPlan(dailyEmailGoal, dailyLinkedinGoal, dailyCallsGoal),
          defaultTemplateIds: templates.filter(t => t.selected).map(t => t.id),
          seniorities: importType === 'companies' ? seniorities.filter(s => s.selected).map(s => s.id) : undefined,
          titles: importType === 'companies' && includeTitles.length > 0 ? includeTitles : undefined,
          excludeTitles: importType === 'companies' && excludeTitles.length > 0 ? excludeTitles : undefined,
          departments: importType === 'companies' && departments.length > 0 ? departments : undefined,
        });
        runId = res.runId;
        setCreatedCampaignId(res.campaignId);
        setCreatedRunId(res.runId);
      }

      const result = await importFileToRun(runId, file);
      if (!result.success) throw new Error(result.error || 'Import failed');
      setDone(result);
    } catch (e) {
      const base = createdCampaignId ? 'Campaign created, but the import failed: ' : 'Failed to create import campaign: ';
      setSubmitError(base + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--color-border)', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>Import Leads</span>
        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>Draft</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {submitError && <span style={{ fontSize: '12px', color: 'var(--color-danger-text)', fontWeight: 600, maxWidth: '420px' }}>{submitError}</span>}
          <button onClick={() => router.push('/dashboard')} style={{ padding: '6px 14px', border: '1px solid var(--color-border-2)', background: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)' }}>Cancel</button>
          {!done && (
            <button onClick={handleSubmit} disabled={!canSubmit} style={{
              padding: '6px 16px', background: canSubmit ? 'var(--color-brand)' : 'var(--color-border-2)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)',
            }}>{submitting ? 'Importing…' : 'Create & Import'}</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 24px 40px' }}>
          {/* Intro */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', margin: '0 0 6px' }}>Import a Lead List</h2>
            <p style={{ fontSize: '13.5px', color: 'var(--color-text-2)', margin: 0, maxWidth: '640px', lineHeight: 1.55 }}>
              Upload a CSV or Excel file of prospects. This creates an import campaign handled by the lead-generation agent — enrichment and outreach run from there.
            </p>
          </div>

          {loadError && (
            <div style={{ padding: '12px 16px', marginBottom: '16px', borderRadius: 'var(--radius-md)', background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', fontSize: '13px', fontWeight: 600, border: '1px solid var(--color-danger-border)' }}>
              Could not load options from the backend: {loadError}
            </div>
          )}

          {done ? (
            <section style={{ ...sectionStyle, textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-success-text)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)', margin: '0 0 6px' }}>Import complete</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--color-text-2)', margin: '0 0 4px' }}>
                Imported <strong>{done.imported_count}</strong> · updated <strong>{done.updated_count}</strong>
                {done.error_count > 0 && <> · <span style={{ color: 'var(--color-danger-text)' }}>{done.error_count} errors</span></>}
              </p>
              <p style={{ fontSize: '12.5px', color: 'var(--color-text-3)', margin: '0 0 20px' }}>Campaign “{name.trim()}” created under the lead-generation agent.</p>
              <button onClick={() => router.push(createdRunId ? `/campaigns/import/${createdRunId}` : '/dashboard')} style={{ padding: '8px 20px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>View campaign</button>
            </section>
          ) : loading ? (
            <div style={{ ...sectionStyle, textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Loading options…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px', alignItems: 'flex-start' }}>
              {/* LEFT — campaign details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <section style={sectionStyle}>
                  <label style={labelCaps}>Campaign Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. NFP Sydney Wave 1"
                    style={{ width: '100%', padding: '9px 12px', background: '#fff', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '14px', color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                </section>

                <section style={sectionStyle}>
                  <label style={labelCaps}>Daily Goals</label>
                  <p style={{ fontSize: '12.5px', color: 'var(--color-text-3)', margin: '4px 0 12px', lineHeight: 1.5 }}>
                    Your per-day commitment for each channel. Only the daily (Monday) goal is needed —
                    the rest of the week is auto-filled and stays editable in Settings and Weekly Goals.
                    My Tasks shows the sum across all your campaigns.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: 'Emails', value: dailyEmailGoal, set: setDailyEmailGoal, min: 1, unit: dailyEmailGoal === 1 ? 'company / day' : 'companies / day' },
                      { label: 'LinkedIn', value: dailyLinkedinGoal, set: setDailyLinkedinGoal, min: 0, unit: dailyLinkedinGoal === 1 ? 'invite / day' : 'invites / day' },
                      { label: 'Phone Calls', value: dailyCallsGoal, set: setDailyCallsGoal, min: 0, unit: dailyCallsGoal === 1 ? 'call / day' : 'calls / day' },
                    ].map(g => (
                      <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '96px', flexShrink: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)' }}>{g.label}</span>
                        <input type="number" min={g.min} max={50} value={g.value}
                          onChange={e => g.set(Math.max(g.min, Math.min(50, Number(e.target.value) || 0)))}
                          style={{ width: '80px', padding: '9px 12px', textAlign: 'center', background: '#fff', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                        <span style={{ fontSize: '13.5px', color: 'var(--color-text-2)' }}>{g.unit}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {importType === 'companies' && (
                  <section style={sectionStyle}>
                    <div style={{ ...sectionTitle, marginBottom: '6px' }}>
                      <Icon d={<><circle cx="9" cy="9" r="6.5" /><polyline points="6.5,9.2 8.3,11.5 12,6.5" /></>} />
                      ICP Targeting Filters
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--color-text-3)', margin: '0 0 16px', lineHeight: 1.5 }}>
                      Set your ideal customer targeting criteria. After importing the companies, the agent will query Apollo for prospects matching these parameters.
                    </p>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={labelCaps}>Management Level</label>
                      <MultiSelectDropdown options={seniorities} onToggle={toggleSeniority} placeholder="Select management levels…" searchPlaceholder="Search levels" />
                    </div>

                    <TagInput
                      label="Include Job Titles"
                      hint="Search for specific titles (e.g. Sales Director, Head of Engineering). Press Enter/comma to add."
                      tags={includeTitles}
                      placeholder="Type a title and press Enter..."
                      onAdd={tag => setIncludeTitles(prev => [...prev, tag])}
                      onRemove={tag => setIncludeTitles(prev => prev.filter(t => t !== tag))}
                    />

                    <TagInput
                      label="Exclude Job Titles"
                      hint="Exclude specific titles (e.g. Consultant, Intern, Assistant). Press Enter/comma to add."
                      tags={excludeTitles}
                      placeholder="Type a title to exclude..."
                      onAdd={tag => setExcludeTitles(prev => [...prev, tag])}
                      onRemove={tag => setExcludeTitles(prev => prev.filter(t => t !== tag))}
                    />

                    <TagInput
                      label="Departments & Job Function"
                      hint="Filter by departments (e.g. sales, engineering, marketing, finance). Press Enter/comma to add."
                      tags={departments}
                      placeholder="Type a department..."
                      onAdd={tag => setDepartments(prev => [...prev, tag])}
                      onRemove={tag => setDepartments(prev => prev.filter(t => t !== tag))}
                    />
                  </section>
                )}

                <section style={sectionStyle}>
                  <div style={{ ...sectionTitle, marginBottom: '16px' }}>
                    <Icon d={<><rect x="2" y="4" width="14" height="10" rx="1.5" /><polyline points="2.5,5 9,10 15.5,5" /></>} />
                    Email Sender
                  </div>
                  {senderOptions.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>No email senders configured.</span>
                  ) : (
                    <SingleSelectDropdown value={senderId} options={senderOptions} onChange={setSenderId} placeholder="Select a sender…" searchable searchPlaceholder="Search senders" />
                  )}
                </section>

                <section style={sectionStyle}>
                  <div style={{ ...sectionTitle, marginBottom: '16px' }}>
                    <Icon d={<><circle cx="9" cy="6.5" r="2.8" /><path d="M3 15.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /></>} />
                    Run Owners
                  </div>
                  {owners.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>No other users to share with.</span>
                  ) : (
                    <MultiSelectDropdown options={owners} onToggle={toggleOwner} placeholder="Add owners (optional)…" searchPlaceholder="Search users" />
                  )}
                </section>

                <section style={sectionStyle}>
                  <div style={{ ...sectionTitle, marginBottom: '8px' }}>
                    <Icon d={<><rect x="2.5" y="3.5" width="13" height="11" rx="1.5" /><line x1="2.5" y1="7" x2="15.5" y2="7" /><line x1="6" y1="10.5" x2="12" y2="10.5" /></>} />
                    Default Templates
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-3)', margin: '0 0 12px', lineHeight: 1.4 }}>
                    Templates offered when contacting prospects in this campaign. Leave empty to offer all your templates.
                  </p>
                  {templates.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>No outreach templates found.</span>
                  ) : (
                    <MultiSelectDropdown options={templates} onToggle={toggleTemplate} placeholder="All templates (no default)…" searchPlaceholder="Search templates" />
                  )}
                </section>
              </div>

              {/* RIGHT — file upload */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <section style={sectionStyle}>
                  <div style={{ ...sectionTitle, marginBottom: '16px' }}>
                    <Icon d={<><path d="M9 12V3" /><polyline points="5.5,6.5 9,3 12.5,6.5" /><path d="M3 12v2.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V12" /></>} />
                    Upload {importType === 'companies' ? 'Companies' : 'Prospects'}
                  </div>

                  {file ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)' }}>
                      <Icon d={<><path d="M4 2.5h6L14 6v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" /><path d="M10 2.5V6h4" /></>} color="var(--color-text-2)" />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>{(file.size / 1024).toFixed(0)} KB</div>
                      </div>
                      <button onClick={() => setFile(null)} title="Remove" style={{ width: '26px', height: '26px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', color: 'var(--color-text-3)' }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0] ?? null); }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                        padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
                        border: `1.5px dashed ${dragging ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
                        borderRadius: 'var(--radius-md)', background: dragging ? 'var(--color-brand-subtle)' : 'var(--color-surface)',
                        transition: 'background .12s, border-color .12s',
                      }}>
                      <Icon d={<><path d="M9 12V3" /><polyline points="5.5,6.5 9,3 12.5,6.5" /><path d="M3 12v2.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V12" /></>} color="var(--color-text-3)" />
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)' }}>Drop a file or click to browse</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>
                        {importType === 'companies' ? '.csv, .xlsx or .xls (must contain Company Name)' : '.csv, .xlsx or .xls (must contain First Name, Last Name, Email)'}
                      </div>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                    onChange={e => pickFile(e.target.files?.[0] ?? null)} />
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
