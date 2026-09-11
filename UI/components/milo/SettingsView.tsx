'use client';
import React, { ReactNode } from 'react';
import {
  getLinkedInIntegration, verifyLinkedInIntegration, disconnectLinkedInIntegration,
  cancelLinkedInLogin,
  getSalesProfile, saveSalesProfile, previewSalesProfile, saveFollowUpWindow,
  fetchMyProfile, updateMyProfile,
  fetchSchedulerAudit, listImportCampaigns, fetchSystemSchedules,
  fetchSystemHealth, refreshSystemHealth, fetchChangelog,
  type LinkedInIntegrationStatus, type SalesProfileFields, type SellerContextView,
  type UserProfile, type SchedulerRun, type ImportCampaignListItem, type SystemSchedule,
  type SystemHealthCheck, type HealthStatus,
  type ChangelogRelease, type ChangelogEntry,
} from '@/lib/leadFunnelApi';
import { listCampaigns, type Campaign } from '@/lib/hrApi';
import { DevicesPanel } from '@/components/auth/DevicesPanel';

// Deployment defaults for a campaign that never set its own automation slot —
// mirrored from the backend (services/lead_funnel_assistant/campaign_schedule.py)
// so the Schedules table reads the same slot the scheduler will actually use.
const DEFAULT_AUTOMATION_TZ = 'Europe/Berlin';
const DEFAULT_AUTOMATION_TIME = '15:00';

/** Two-letter avatar initials from a name (falling back to the email local-part). */
function profileInitials(name: string | null | undefined, email: string): string {
  const base = (name || '').trim() || (email || '').split('@')[0] || '?';
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  const two = parts.slice(0, 2).map(p => p[0]).join('');
  return (two || base[0] || '?').toUpperCase();
}

/** Prettify a raw role slug (e.g. "super_admin" → "Super Admin"). */
function prettyRole(role: string | null | undefined): string {
  if (!role) return 'Member';
  return role.split(/[_\s-]+/).filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

const INNER_EXPANDED = 220;
const INNER_RAIL = 44;

const SSI = ({ d, size = 15, vb = '0 0 18 18' }: { d: ReactNode; size?: number; vb?: string }) => (
  <svg width={size} height={size} viewBox={vb} fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, color: 'inherit', display: 'block' }}>
    {d}
  </svg>
);

const SIC = {
  profile: <SSI d={<><circle cx="9" cy="6.5" r="2.8" /><path d="M3 15.5c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5" /></>} />,
  notifications: <SSI d={<><path d="M9 1.5c-3.2 0-5.5 2.5-5.5 5.5v3.5L2 12.5h14l-1.5-2.5V7c0-3-2.3-5.5-5.5-5.5z" /><line x1="9" y1="1.5" x2="9" y2="2.5" /><path d="M7 14.5a2 2 0 0 0 4 0" /></>} />,
  display: <SSI d={<><rect x="2" y="3" width="14" height="10" rx="1.5" /><line x1="6" y1="13" x2="6" y2="16" /><line x1="12" y1="13" x2="12" y2="16" /><line x1="4.5" y1="16" x2="13.5" y2="16" /></>} />,
  limits: <SSI d={<><path d="M3.5 13.5a7 7 0 1 1 11 0" /><path d="M9 9.5L11.8 6.7" /><circle cx="9" cy="9.5" r="1.3" fill="currentColor" stroke="none" /></>} />,
  apikeys: <SSI d={<><circle cx="6.5" cy="8" r="3.8" /><line x1="9.2" y1="10.8" x2="16" y2="16" /><line x1="13" y1="13.5" x2="14.5" y2="15" /></>} />,
  members: <SSI d={<><circle cx="7" cy="6" r="2.5" /><path d="M2 15c0-2.8 2.2-5 5-5s5 2.2 5 5" /><circle cx="13" cy="6.5" r="2" /><path d="M14 12.5c1.6.6 2.5 1.8 2.5 3.5" /></>} />,
  salesprofile: <SSI d={<><circle cx="9" cy="9" r="6.5" /><circle cx="9" cy="9" r="3.5" /><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" /></>} />,
  billing: <SSI d={<><rect x="2" y="4.5" width="14" height="10" rx="1.5" /><line x1="2" y1="8.5" x2="16" y2="8.5" /><line x1="5" y1="12" x2="8.5" y2="12" /></>} />,
  integrations: <SSI d={<><circle cx="9" cy="9" r="2" /><circle cx="3.5" cy="4" r="1.5" /><circle cx="14.5" cy="4" r="1.5" /><circle cx="3.5" cy="14" r="1.5" /><circle cx="14.5" cy="14" r="1.5" /><line x1="7.5" y1="7.5" x2="4.5" y2="5" /><line x1="10.5" y1="7.5" x2="13.5" y2="5" /><line x1="7.5" y1="10.5" x2="4.5" y2="13" /><line x1="10.5" y1="10.5" x2="13.5" y2="13" /></>} />,
  outlook: <SSI d={<><rect x="2" y="4" width="14" height="10" rx="1.5" /><path d="M2 6l7 4.5L16 6" /></>} />,
  forwarding: <SSI d={<><rect x="2" y="4" width="14" height="10" rx="1.5" /><path d="M2 6l7 4.5L16 6" /><path d="M11 13.5h5" /><path d="M13.5 11l2.5 2.5-2.5 2.5" /></>} />,
  linkedin: <SSI d={<><rect x="2.5" y="2.5" width="13" height="13" rx="2" /><circle cx="5.5" cy="6" r=".9" fill="currentColor" stroke="none" /><line x1="5.5" y1="8" x2="5.5" y2="13" /><path d="M8.5 13V9.5c0-1 .8-1.8 1.8-1.8s1.7.8 1.7 1.8V13" /></>} />,
  apollo: <SSI d={<><path d="M9 1.5L2.5 5v8L9 16.5 15.5 13V5L9 1.5z" /><path d="M9 5.5l3.5 2v3L9 12.5 5.5 10.5v-3L9 5.5z" /></>} />,
  devices: <SSI d={<><rect x="2" y="3" width="14" height="10" rx="1.5" /><line x1="6" y1="16" x2="12" y2="16" /><line x1="9" y1="13" x2="9" y2="16" /></>} />,
  scheduler: <SSI d={<><circle cx="9" cy="9.5" r="6" /><path d="M9 6v3.5l2.3 1.4" /><line x1="9" y1="1.5" x2="9" y2="2.8" /></>} />,
  systemhealth: <SSI d={<><path d="M2.5 9.5h2.4l1.6-4.2 2.4 8.4 2-6.2 1.4 2.2H16" /></>} />,
  schedules: <SSI d={<><rect x="2.5" y="3.5" width="13" height="12" rx="1.5" /><line x1="2.5" y1="7" x2="15.5" y2="7" /><line x1="6" y1="1.5" x2="6" y2="4.5" /><line x1="12" y1="1.5" x2="12" y2="4.5" /><path d="M9 9.5v2l1.4.9" /></>} />,
  changelog: <SSI d={<><path d="M4.5 2.5h6l3 3v10h-9z" /><line x1="6" y1="8" x2="12" y2="8" /><line x1="6" y1="11" x2="12" y2="11" /><line x1="6" y1="5" x2="8.5" y2="5" /></>} />,
  collapse: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ display: 'block' }}><path d="M8 1.5L3 6L8 10.5" /></svg>,
  expand: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ display: 'block' }}><path d="M4 1.5L9 6L4 10.5" /></svg>,
};

interface NavItem { id: string; label: string; icon: ReactNode }
interface NavGroup { group: string; items: NavItem[] }

const SETTINGS_NAV: NavGroup[] = [
  { group: 'Account', items: [
    { id: 'profile', label: 'Profile', icon: SIC.profile },
    { id: 'notifications', label: 'Notifications', icon: SIC.notifications },
    { id: 'display', label: 'Display', icon: SIC.display },
  ]},
  { group: 'Workspace', items: [
    { id: 'salesprofile', label: 'Company Profile', icon: SIC.salesprofile },
    { id: 'limits', label: 'Limits', icon: SIC.limits },
    { id: 'apikeys', label: 'API Keys', icon: SIC.apikeys },
    { id: 'members', label: 'Members', icon: SIC.members },
  ]},
  { group: 'Security', items: [
    { id: 'devices', label: 'Devices', icon: SIC.devices },
  ]},
  { group: 'System', items: [
    { id: 'schedules', label: 'Schedules', icon: SIC.schedules },
    { id: 'scheduler', label: 'Scheduler Health', icon: SIC.scheduler },
    { id: 'systemhealth', label: 'System Health', icon: SIC.systemhealth },
    { id: 'changelog', label: "What's New", icon: SIC.changelog },
  ]},
  { group: 'Billing', items: [
    { id: 'billing', label: 'Billing & Plans', icon: SIC.billing },
  ]},
  { group: 'Integrations', items: [
    { id: 'forwarding', label: 'Email Forwarding', icon: SIC.forwarding },
    { id: 'outlook', label: 'Outlook', icon: SIC.outlook },
    { id: 'linkedin', label: 'LinkedIn', icon: SIC.linkedin },
    { id: 'apollo', label: 'Apollo', icon: SIC.apollo },
  ]},
];

// Sales Profile: the seller's own product + ICP, in plain language. The backend
// Context Setter turns this into structured "seller context" that grounds Account
// Intel — the planner's focus, the people it targets, and the account category.
const SP_FIELDS: { key: keyof SalesProfileFields; label: string; hint: string; placeholder: string; rows: number }[] = [
  { key: 'product_oneliner', label: 'Product/Service', hint: 'One line — what is it called and what is it?', placeholder: 'Agamx Sales Assistant', rows: 1 },
  { key: 'what_we_sell', label: 'What you sell', hint: 'The capabilities you deliver.', placeholder: 'Apollo-integrated email + LinkedIn outreach automation, AI account intel, AI prospect finding.', rows: 3 },
  { key: 'icp', label: 'Who you sell to', hint: 'Industries, company size, geographies.', placeholder: 'B2B tech / agencies / SaaS, 10–500 employees, global.', rows: 2 },
  { key: 'buying_roles', label: 'Buying roles', hint: 'The people who evaluate or buy this.', placeholder: 'VP Sales, RevOps, SDR lead, founders at SMBs', rows: 2 },
  { key: 'pains_solved', label: 'Problems you solve', hint: 'The pain your product removes.', placeholder: 'thin manual pipeline, low outreach volume, no account prioritization', rows: 2 },
  { key: 'disqualifiers', label: 'Disqualifiers', hint: 'What makes an account a bad fit. Optional.', placeholder: 'pure B2C, no sales motion', rows: 2 },
];

const EMPTY_SP: SalesProfileFields = {
  product_oneliner: '', what_we_sell: '', icp: '', buying_roles: '', pains_solved: '', disqualifiers: '',
};

function SalesProfilePanel({ onToast }: { onToast: (m: string) => void }) {
  const [fields, setFields] = React.useState<SalesProfileFields>(EMPTY_SP);
  const [derived, setDerived] = React.useState<SellerContextView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  // A profile edited-but-not-saved shouldn't show a derived preview from the old text.
  const [dirty, setDirty] = React.useState(false);
  // Follow-up window (days): drives the LinkedIn "Follow-up accounts" section.
  const [windowDays, setWindowDays] = React.useState(2);
  const [savingWindow, setSavingWindow] = React.useState(false);

  React.useEffect(() => {
    getSalesProfile()
      .then(r => { setFields(r.profile); setDerived(r.derived); setWindowDays(r.followUpWindowDays || 2); })
      .catch(() => onToast('Could not load your sales profile'))
      .finally(() => setLoading(false));
  }, [onToast]);

  const saveWindow = async (days: number) => {
    const clamped = Math.max(1, Math.min(30, days));
    setWindowDays(clamped);
    setSavingWindow(true);
    try { const r = await saveFollowUpWindow(clamped); setWindowDays(r.followUpWindowDays); onToast('Follow-up window updated'); }
    catch { onToast('Could not save the follow-up window'); }
    finally { setSavingWindow(false); }
  };

  const set = (k: keyof SalesProfileFields, v: string) => { setFields(f => ({ ...f, [k]: v })); setDirty(true); setDerived(null); };

  const save = async () => {
    setSaving(true);
    try { await saveSalesProfile(fields); setDirty(false); onToast('Sales profile saved'); }
    catch { onToast('Save failed'); }
    finally { setSaving(false); }
  };

  const preview = async () => {
    if (dirty) { onToast('Save your changes first'); return; }
    setPreviewing(true);
    try {
      const r = await previewSalesProfile();
      if (r.derived) { setDerived(r.derived); onToast('Generated'); }
      else onToast(r.message || 'Add details and save first');
    } catch { onToast('Could not generate preview'); }
    finally { setPreviewing(false); }
  };

  const hasAny = Object.values(fields).some(v => (v || '').trim());

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)',
    padding: '9px 12px', fontFamily: 'var(--font-sans)', fontSize: '13.5px', color: 'var(--color-text-1)',
    background: 'var(--color-bg)', outline: 'none', resize: 'vertical', lineHeight: 1.5,
  };

  return (
    <div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>Company Profile</div>
      <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px', lineHeight: 1.5, maxWidth: '62ch' }}>
        Tell Account Intel what you sell and who you sell to. It uses this to judge each company's fit — focusing the research, targeting the right people, and setting the Account Category. Plain language is fine.
      </div>

      {loading ? (
        <div style={{ fontSize: '13.5px', color: 'var(--color-text-3)' }}>Loading…</div>
      ) : (
        <>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>
              Your offering
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {SP_FIELDS.map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)' }}>{f.label}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', margin: '2px 0 8px' }}>{f.hint}</div>
                  <textarea rows={f.rows} value={fields[f.key]} placeholder={f.placeholder}
                    onChange={e => set(f.key, e.target.value)} style={inputStyle} />
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={save} disabled={saving || !hasAny}
                  style={{ padding: '8px 18px', background: hasAny ? 'var(--color-brand)' : 'var(--color-border-2)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: hasAny && !saving ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
                <button onClick={preview} disabled={previewing || !hasAny || dirty}
                  title={dirty ? 'Save your changes first' : 'See how Account Intel reads your profile'}
                  style={{ padding: '8px 16px', background: 'var(--color-bg)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-2)', cursor: previewing || !hasAny || dirty ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {previewing ? 'Analysing…' : 'Preview understanding'}
                </button>
              </div>
            </div>
          </div>

          {/* Follow-up cadence — feeds the LinkedIn "Follow-up accounts" section. */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg)', overflow: 'hidden', marginTop: '16px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>
              Follow-up cadence
            </div>
            <div style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', lineHeight: 1.5, marginBottom: '14px', maxWidth: '62ch' }}>
                A prospect appears in the LinkedIn tab’s <strong>Follow-up accounts</strong> section once an outreach email has gone unanswered for this many days.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => saveWindow(windowDays - 1)} disabled={savingWindow || windowDays <= 1}
                  aria-label="Decrease" style={stepBtn(savingWindow || windowDays <= 1)}>–</button>
                <input type="number" min={1} max={30} value={windowDays}
                  onChange={e => setWindowDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                  onBlur={e => saveWindow(Number(e.target.value) || windowDays)}
                  style={{ width: '64px', textAlign: 'center', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', padding: '8px 6px', fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-1)', background: 'var(--color-bg)', outline: 'none' }} />
                <button onClick={() => saveWindow(windowDays + 1)} disabled={savingWindow || windowDays >= 30}
                  aria-label="Increase" style={stepBtn(savingWindow || windowDays >= 30)}>+</button>
                <span style={{ fontSize: '13.5px', color: 'var(--color-text-2)' }}>day{windowDays === 1 ? '' : 's'}</span>
                {savingWindow && <span style={{ fontSize: '12.5px', color: 'var(--color-text-3)' }}>Saving…</span>}
              </div>
            </div>
          </div>

          {derived && <SellerContextCard ctx={derived} />}
        </>
      )}
    </div>
  );
}

function stepBtn(disabled: boolean): React.CSSProperties {
  return {
    width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)',
    color: 'var(--color-text-1)', fontSize: '18px', fontWeight: 600, lineHeight: 1,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: 'var(--font-sans)',
  };
}

// Read-only view of how the Context Setter understood the profile.
function SellerContextCard({ ctx }: { ctx: SellerContextView }) {
  const chip = (t: string, i: number) => (
    <span key={i} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '3px 9px', borderRadius: 'var(--radius-full)' }}>{t}</span>
  );
  const block = (title: string, body: ReactNode) => (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>{title}</div>
      {body}
    </div>
  );
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', marginTop: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>How Account Intel reads you</div>
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '2px' }}>Generated from your profile — this is what grounds every company's research.</div>
      </div>
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {ctx.product_summary && block('Summary', <div style={{ fontSize: '13.5px', color: 'var(--color-text-1)', lineHeight: 1.55 }}>{ctx.product_summary}</div>)}
        {ctx.signals_to_watch.length > 0 && block('In-market signals it hunts for',
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{ctx.signals_to_watch.map(chip)}</div>)}
        {ctx.buying_committee.length > 0 && block('Who it targets',
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {ctx.buying_committee.map((b, i) => (
              <div key={i} style={{ fontSize: '13px', color: 'var(--color-text-2)' }}>
                <strong style={{ color: 'var(--color-text-1)' }}>{b.role}</strong>{b.why ? ` — ${b.why}` : ''}
              </div>
            ))}
          </div>)}
        {ctx.pains_solved.length > 0 && block('Problems it looks for',
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{ctx.pains_solved.map(chip)}</div>)}
        {ctx.default_focus_hint && block('Typical angle',
          <div style={{ fontSize: '13px', color: 'var(--color-text-2)', lineHeight: 1.5, fontStyle: 'italic' }}>{ctx.default_focus_hint}</div>)}
      </div>
    </div>
  );
}

// Live LinkedIn integration: the user logs into LinkedIn inside a pop-out window
// (/linkedin-login) running a Browser Use live browser; we capture + validate the
// session cookies server-side (no password ever touches us) and store them
// encrypted. The pop-out reports back over a BroadcastChannel so this panel
// refreshes the moment the login succeeds.
function LinkedInIntegrationPanel({ onToast }: { onToast: (m: string) => void }) {
  const [status, setStatus] = React.useState<LinkedInIntegrationStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  // The login happens in a pop-out window now; we only track whether it's open
  // so the button can reflect it.
  const [popupOpen, setPopupOpen] = React.useState(false);
  const popupRef = React.useRef<Window | null>(null);
  // Session id the pop-out broadcasts on start — lets us stop the (billable)
  // Browser Use session if the window is closed before the login finishes.
  const pendingSessionRef = React.useRef<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await getLinkedInIntegration());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load status');
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Bridge to the pop-out login window: it broadcasts its session id (so we can
  // stop a half-finished, billable session) and a 'connected' event the moment
  // cookies are captured (so we refresh status without waiting for the window to
  // close). We also poll for the window being closed as a fallback.
  React.useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try { channel = new BroadcastChannel('linkedin-auth'); } catch { channel = null; }
    if (channel) {
      channel.onmessage = (ev: MessageEvent) => {
        const msg = ev.data as { type?: string; sessionId?: string };
        if (msg?.type === 'linkedin-session') {
          pendingSessionRef.current = msg.sessionId ?? null;
        } else if (msg?.type === 'linkedin-connected') {
          pendingSessionRef.current = null; // completed — nothing to cancel
          onToast('LinkedIn connected');
          load();
        }
      };
    }
    const poll = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        popupRef.current = null;
        setPopupOpen(false);
        // Closed before completing → stop the billable session (no-op if it
        // already connected, since we cleared the id above).
        const sid = pendingSessionRef.current;
        pendingSessionRef.current = null;
        if (sid) cancelLinkedInLogin(sid).catch(() => {});
        load();
      }
    }, 800);
    return () => {
      clearInterval(poll);
      try { channel?.close(); } catch { /* noop */ }
      // Leaving settings mid-login: stop the billable session and window.
      const sid = pendingSessionRef.current;
      if (sid) cancelLinkedInLogin(sid).catch(() => {});
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    };
  }, [load, onToast]);

  const startLogin = () => {
    setErr(null);
    // Open synchronously in the click handler so the browser doesn't block the
    // pop-up. The window starts its own login session and reports back over the
    // BroadcastChannel wired up above.
    const w = 1040, h = 760;
    const baseLeft = window.screenLeft ?? window.screenX ?? 0;
    const baseTop = window.screenTop ?? window.screenY ?? 0;
    const vw = window.innerWidth || document.documentElement.clientWidth || screen.width;
    const vh = window.innerHeight || document.documentElement.clientHeight || screen.height;
    const left = baseLeft + Math.max(0, (vw - w) / 2);
    const top = baseTop + Math.max(0, (vh - h) / 2);
    const popup = window.open('/linkedin-login', 'linkedinLogin', `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
    if (!popup) {
      setErr('Your browser blocked the login window. Please allow pop-ups for this site and try again.');
      return;
    }
    popupRef.current = popup;
    setPopupOpen(true);
    popup.focus();
  };

  const reconnect = async () => {
    setBusy(true); setErr(null);
    try {
      const s = await verifyLinkedInIntegration();
      setStatus(s);
      onToast(s.connected ? 'Connection valid' : (s.lastError || 'Session expired — reconnect'));
      if (!s.connected && s.lastError) setErr(s.lastError);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Verification failed');
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true); setErr(null);
    try {
      await disconnectLinkedInIntegration();
      setStatus({ connected: false, username: null, status: null });
      onToast('Disconnected');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to disconnect');
    } finally { setBusy(false); }
  };

  const st = status?.status ?? null;
  const badge = (() => {
    if (st === 'connected') return { label: 'Connected', bg: 'var(--color-success-bg, #E7F6EC)', fg: 'var(--color-success-text, #1B7F3B)' };
    if (st === 'reauth_required') return { label: 'Re-auth needed', bg: 'var(--color-warning-bg)', fg: 'var(--color-warning-text)' };
    if (st === 'error') return { label: 'Error', bg: 'var(--color-danger-bg, #FCEBEA)', fg: 'var(--color-danger-text)' };
    if (st === 'unverified') return { label: 'Unverified', bg: 'var(--color-surface)', fg: 'var(--color-text-2)' };
    return { label: 'Not connected', bg: 'var(--color-surface)', fg: 'var(--color-text-3)' };
  })();

  const btnGhost: React.CSSProperties = { padding: '9px 20px', background: '#fff', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13.5px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: busy ? 0.6 : 1 };
  const btnPrimary: React.CSSProperties = { padding: '10px 28px', background: 'linear-gradient(135deg, #0A66C2 0%, #0E7AE5 100%)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', boxShadow: '0 4px 14px rgba(10,102,194,.3)', opacity: busy ? 0.7 : 1 };

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ padding: '28px 24px 8px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #0A66C2 0%, #0E7AE5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(10,102,194,.25)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M6.94 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM3.24 8.5h3.5v12h-3.5v-12zm5.6 0h3.36v1.64h.05c.47-.89 1.62-1.83 3.33-1.83 3.56 0 4.22 2.34 4.22 5.39v6.8h-3.5v-6.03c0-1.44-.03-3.29-2-3.29-2 0-2.31 1.57-2.31 3.18v6.14h-3.5v-12h.35z" /></svg>
        </div>
        <div style={{ paddingBottom: '16px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)' }}>LinkedIn</div>
            {!loading && <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: badge.bg, color: badge.fg }}>{badge.label}</span>}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '2px' }}>
            {status?.connected
              ? (status.username ? `Connected as ${status.username}` : 'Connected')
              : 'Log in to LinkedIn in a secure window — no password stored'}
          </div>
        </div>
      </div>
      <div style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>Loading…</div>
        ) : status?.connected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: '10px', background: 'var(--color-success-bg, #E7F6EC)', border: '1px solid var(--color-success-border, #B7E3C6)' }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--color-success-text, #1B7F3B)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="10" cy="10" r="8" /><polyline points="6.5,10.5 9,13 13.5,7.5" /></svg>
              <div style={{ fontSize: '13.5px', color: 'var(--color-success-text, #1B7F3B)', lineHeight: 1.5, fontWeight: 600 }}>
                Your LinkedIn connection is valid.
                <span style={{ fontWeight: 400, color: 'var(--color-text-2)' }}>
                  {' '}We use your captured session — no password is stored.
                  {status.lastVerifiedAt && <> Last verified {new Date(status.lastVerifiedAt).toLocaleString()}.</>}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={reconnect} disabled={busy} style={btnGhost}>
                {busy ? 'Checking…' : 'Test connection'}
              </button>
              <button onClick={disconnect} disabled={busy}
                style={{ ...btnGhost, color: 'var(--color-danger-text)', border: '1px solid var(--color-danger-border, #F3C9C7)' }}>
                Disconnect
              </button>
            </div>
            {err && <div style={{ fontSize: '12.5px', color: 'var(--color-danger-text)' }}>{err}</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {status?.status === 'reauth_required' && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border, #FAE3A0)', fontSize: '12.5px', color: 'var(--color-warning-text)' }}>
                Your LinkedIn session expired. Reconnect below to keep sending invites.
              </div>
            )}
            <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
              Connect your LinkedIn account by logging in through a secure browser window that opens in a separate pop-out. We capture only your session — your username and password never reach our servers.
            </div>
            <button onClick={startLogin} disabled={popupOpen} style={{ ...btnPrimary, alignSelf: 'flex-start', opacity: popupOpen ? 0.7 : 1 }}>
              {popupOpen ? 'Login window open…' : 'Connect LinkedIn'}
            </button>
            {popupOpen && (
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                Complete your login in the pop-out window. This page updates automatically once you’re connected.
              </div>
            )}
            {err && <div style={{ fontSize: '12.5px', color: 'var(--color-danger-text)' }}>{err}</div>}
            <div style={{ fontSize: '12px', color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="6" height="5" rx="1" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" /></svg>
              Your session is encrypted with AES-256 at rest. No password is ever stored.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Shared input styling for the profile fields.
const profileInput: React.CSSProperties = {
  border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', padding: '8px 12px',
  fontFamily: 'var(--font-sans)', fontSize: '13.5px', color: 'var(--color-text-1)', background: '#fff',
  outline: 'none', width: '280px',
};

// Profile — the signed-in user's real account info (agent_hub.users via /api/users/me).
// Name / job title / company / location are editable; email + role are read-only here.
function ProfilePanel({ onToast }: { onToast: (m: string) => void }) {
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [fullName, setFullName] = React.useState('');
  const [designation, setDesignation] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [location, setLocation] = React.useState('');

  React.useEffect(() => {
    fetchMyProfile()
      .then(p => {
        setProfile(p);
        setFullName(p.full_name || '');
        setDesignation(p.designation || '');
        setCompany(p.company_name || '');
        setLocation(p.location || '');
      })
      .catch(() => onToast('Could not load your profile'))
      .finally(() => setLoading(false));
  }, [onToast]);

  const dirty = !!profile && (
    fullName !== (profile.full_name || '') ||
    designation !== (profile.designation || '') ||
    company !== (profile.company_name || '') ||
    location !== (profile.location || '')
  );

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateMyProfile({
        full_name: fullName.trim(),
        designation: designation.trim(),
        company_name: company.trim(),
        location: location.trim(),
      });
      setProfile(updated);
      onToast('Profile saved');
    } catch { onToast('Could not save your profile'); }
    finally { setSaving(false); }
  };

  const field = (label: string, hint: string | null, control: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div>
        <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-1)' }}>{label}</div>
        {hint && <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '2px' }}>{hint}</div>}
      </div>
      {control}
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>Profile</div>
      <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px', lineHeight: 1.5 }}>Manage your personal account information.</div>

      {loading ? (
        <div style={{ fontSize: '13.5px', color: 'var(--color-text-3)' }}>Loading…</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>Personal Information</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '2px' }}>Update your name and details.</div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--color-border)', marginBottom: '2px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-avatar-blue)', color: '#fff', fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {profileInitials(fullName || profile?.full_name, profile?.email || '')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)' }}>{fullName || (profile?.email ? profile.email.split('@')[0] : 'You')}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)' }}>{prettyRole(profile?.role)}</div>
              </div>
            </div>
            {field('Full name', null,
              <input value={fullName} onChange={e => setFullName(e.target.value)} style={profileInput} />)}
            {field('Email address', 'Sign-in email — not editable here.',
              <input value={profile?.email || ''} readOnly disabled
                style={{ ...profileInput, background: 'var(--color-surface)', color: 'var(--color-text-3)', cursor: 'not-allowed' }} />)}
            {field('Job title', null,
              <input value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Head of Sales" style={profileInput} />)}
            {field('Company', null,
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" style={profileInput} />)}
            {field('Location', null,
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" style={profileInput} />)}
            <div style={{ marginTop: '16px' }}>
              <button onClick={save} disabled={saving || !dirty}
                style={{ padding: '8px 18px', background: (saving || !dirty) ? 'var(--color-border-2)' : 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: (saving || !dirty) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Members — currently just the signed-in user (real data). Team workspaces + invites
// are a later phase, so the Invite button is a placeholder for now.
function MembersPanel({ onToast }: { onToast: (m: string) => void }) {
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchMyProfile()
      .then(setProfile)
      .catch(() => onToast('Could not load members'))
      .finally(() => setLoading(false));
  }, [onToast]);

  const name = profile?.full_name || (profile?.email ? profile.email.split('@')[0] : 'You');

  return (
    <div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>Members</div>
      <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px' }}>Manage your workspace members and roles.</div>
      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>Workspace Members</div>
          <button onClick={() => onToast('Team workspaces are coming soon')}
            title="Inviting teammates is coming soon"
            style={{ padding: '5px 12px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Invite</button>
        </div>
        <div style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ fontSize: '13.5px', color: 'var(--color-text-3)' }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--color-avatar-blue)', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {profileInitials(profile?.full_name, profile?.email || '')}
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)' }}>{name} <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '1px 7px', borderRadius: 'var(--radius-full)', marginLeft: '4px' }}>You</span></div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>{profile?.email}</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-surface)', padding: '3px 9px', borderRadius: '5px' }}>{prettyRole(profile?.role)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<HealthStatus, string> = {
  green: 'var(--color-success-text, #16A34A)',
  amber: 'var(--color-warning-text, #B7791F)',
  red: 'var(--color-danger-text, #DC2626)',
};
const STATUS_LABEL: Record<HealthStatus, string> = {
  green: 'Healthy',
  amber: 'Needs attention',
  red: 'Blocked',
};
function StatusDot({ status, size = 8 }: { status: HealthStatus; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', background: STATUS_COLOR[status],
      display: 'inline-block', flexShrink: 0, boxShadow: '0 0 0 2px var(--color-bg)',
    }} />
  );
}

/** Render a UTC ISO instant in the viewer's own timezone, including the tz name so the
 *  reader can see which zone it is (e.g. "27 Aug 2026, 8:00 AM GMT+5:30"). */
function formatCheckedAt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function SystemHealthPanel({ checks, loading, checkedAt, onRefresh, refreshing }: {
  checks: SystemHealthCheck[]; loading: boolean;
  checkedAt: string | null; onRefresh: () => void; refreshing: boolean;
}) {
  const lastChecked = formatCheckedAt(checkedAt);
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>System Health</div>
          <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)' }}>
            Status of your campaigns' daily automation and account connections. Checked automatically at 8:00 AM and 7:00 PM IST.
          </div>
        </div>
        <button onClick={onRefresh} disabled={refreshing || loading}
          style={{ flexShrink: 0, padding: '8px 14px', background: 'var(--color-bg)', color: 'var(--color-text-1)',
            border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600,
            cursor: (refreshing || loading) ? 'not-allowed' : 'pointer', opacity: (refreshing || loading) ? 0.6 : 1,
            fontFamily: 'var(--font-sans)' }}>
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', margin: '10px 0 20px' }}>
        Last checked: <strong style={{ color: 'var(--color-text-2)' }}>{lastChecked}</strong>
      </div>
      {loading && <div style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>Loading…</div>}
      {!loading && checks.length === 0 && (
        <div style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>No active campaigns to monitor.</div>
      )}
      {!loading && checks.length > 0 && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface)', textAlign: 'left', color: 'var(--color-text-3)' }}>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Area</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Check</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '10px 16px', fontWeight: 600 }}>Detail</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>Last checked</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c, i) => (
                <tr key={i} style={{
                  borderTop: '1px solid var(--color-border)',
                  background: c.status === 'red' ? 'var(--color-danger-bg, rgba(220,38,38,.04))' : 'transparent',
                }}>
                  <td style={{ padding: '10px 16px', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>
                    {c.area}
                    {c.campaignName ? <span style={{ color: 'var(--color-text-1)', fontWeight: 600 }}> · {c.campaignName}</span> : null}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--color-text-1)', fontWeight: 500 }}>{c.check}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                      <StatusDot status={c.status} />
                      <span style={{ fontWeight: 600, color: STATUS_COLOR[c.status] }}>{STATUS_LABEL[c.status]}</span>
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--color-text-2)' }}>{c.detail}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{lastChecked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Email Forwarding — MOCK screen. Lets the user set up forwarding so any mail
// landing in a connected source inbox is auto-forwarded to a destination inbox
// they configure here. No backend wired yet; state is local and Save just toasts.
interface ForwardRule { id: string; source: string; destination: string; onlyReplies: boolean; enabled: boolean }

function EmailForwardingPanel({ onToast }: { onToast: (m: string) => void }) {
  const [enabled, setEnabled] = React.useState(true);
  const [rules, setRules] = React.useState<ForwardRule[]>([
    { id: 'r1', source: 'outreach@agamx.com', destination: 'sales-team@agamx.com', onlyReplies: true, enabled: true },
  ]);
  // Draft for the "add a rule" row.
  const [source, setSource] = React.useState('');
  const [destination, setDestination] = React.useState('');
  const [onlyReplies, setOnlyReplies] = React.useState(true);

  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const canAdd = emailOk(source) && emailOk(destination);

  const addRule = () => {
    if (!canAdd) { onToast('Enter valid source and destination inboxes'); return; }
    setRules(rs => [...rs, { id: `r${Date.now()}`, source: source.trim(), destination: destination.trim(), onlyReplies, enabled: true }]);
    setSource(''); setDestination(''); setOnlyReplies(true);
    onToast('Forwarding rule added');
  };
  const removeRule = (id: string) => { setRules(rs => rs.filter(r => r.id !== id)); onToast('Rule removed'); };
  const toggleRule = (id: string) => setRules(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  const input: React.CSSProperties = {
    border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', padding: '9px 12px',
    fontFamily: 'var(--font-sans)', fontSize: '13.5px', color: 'var(--color-text-1)', background: 'var(--color-bg)',
    outline: 'none', width: '100%',
  };
  const label: React.CSSProperties = { display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: '6px' };

  const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
    <label style={{ position: 'relative', width: '38px', height: '22px', flexShrink: 0, cursor: 'pointer' }}>
      <input type="checkbox" checked={on} onChange={onChange} style={{ opacity: 0, width: 0, height: 0 }} />
      <div style={{ width: '38px', height: '22px', borderRadius: '11px', background: on ? 'var(--color-brand)' : '#D1D5DB', transition: 'background .2s', position: 'absolute', top: 0, left: 0 }} />
      <div style={{ position: 'absolute', top: '3px', left: on ? '19px' : '3px', width: '16px', height: '16px', background: '#fff', borderRadius: '50%', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)', pointerEvents: 'none' }} />
    </label>
  );

  const arrow = (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--color-text-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <line x1="3" y1="10" x2="16" y2="10" /><polyline points="12,6 16,10 12,14" />
    </svg>
  );

  return (
    <div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>Email Forwarding</div>
      <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px', lineHeight: 1.5, maxWidth: '64ch' }}>
        Automatically forward any mail that lands in a connected inbox to another inbox of your choice. Useful for routing prospect replies to a shared team mailbox.
      </div>

      {/* Master switch */}
      {scardStandalone(
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>Forwarding</div>
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '2px' }}>
              {enabled ? 'Active — rules below are running.' : 'Paused — no mail is being forwarded.'}
            </div>
          </div>
          <Toggle on={enabled} onChange={() => { setEnabled(e => !e); onToast(enabled ? 'Forwarding paused' : 'Forwarding active'); }} />
        </div>
      )}

      {/* Existing rules */}
      {scardStandalone(<>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>
          Active rules
        </div>
        <div style={{ padding: rules.length ? '8px 20px 12px' : '28px 20px' }}>
          {rules.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--color-text-3)', textAlign: 'center' }}>No forwarding rules yet. Add one below.</div>
          ) : rules.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0', borderBottom: '1px solid var(--color-border)', opacity: enabled && r.enabled ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', fontFamily: 'var(--font-mono)' }}>{r.source}</span>
                {arrow}
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', fontFamily: 'var(--font-mono)' }}>{r.destination}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-surface)', padding: '2px 9px', borderRadius: 'var(--radius-full)' }}>
                  {r.onlyReplies ? 'Replies only' : 'All mail'}
                </span>
              </div>
              <Toggle on={r.enabled} onChange={() => toggleRule(r.id)} />
              <button onClick={() => removeRule(r.id)}
                style={{ padding: '5px 12px', background: 'none', border: '1px solid var(--color-danger-border, #F3C9C7)', color: 'var(--color-danger-text)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </>)}

      {/* Add a rule */}
      {scardStandalone(<>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>
          Add a forwarding rule
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '14px', alignItems: 'end' }}>
            <div>
              <label style={label}>Source inbox</label>
              <input value={source} onChange={e => setSource(e.target.value)} placeholder="inbox@yourdomain.com" style={input} />
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '5px' }}>The connected mailbox mail arrives at.</div>
            </div>
            <div style={{ paddingBottom: '30px' }}>{arrow}</div>
            <div>
              <label style={label}>Forward to</label>
              <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="destination@yourdomain.com" style={input} />
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '5px' }}>Where a copy of each mail is sent.</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
            <Toggle on={onlyReplies} onChange={() => setOnlyReplies(v => !v)} />
            <span style={{ fontSize: '13px', color: 'var(--color-text-2)' }}>Forward replies to outreach only (skip newsletters &amp; noise)</span>
          </div>
          <div style={{ marginTop: '20px' }}>
            <button onClick={addRule} disabled={!canAdd}
              style={{ padding: '9px 20px', background: canAdd ? 'var(--color-brand)' : 'var(--color-border-2)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: canAdd ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
              Add rule
            </button>
          </div>
          <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="6" height="5" rx="1" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" /></svg>
            Forwarding preserves the original sender. Nothing is sent on your behalf.
          </div>
        </div>
      </>)}
    </div>
  );
}

// Standalone card wrapper (module-level so panels defined above SettingsView can use it).
function scardStandalone(children: ReactNode, style: React.CSSProperties = {}) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '16px', ...style }}>
      {children}
    </div>
  );
}

/* ─────────────────────  Scheduler Health (audit log)  ───────────────────── */

// Friendly labels for the internal job keys so the table reads plainly.
// The schedule/slot each run fired for is shown in the "When" column — we no
// longer print a time chip next to the job name, because it duplicated that.
function schedulerJobLabel(job: string, meta?: Record<string, unknown> | null): string {
  if (job === 'auto_first_contact') {
    // Surface the campaign name right in the Job column. The campaign id is never
    // shown — only the human-readable name pulled from the run's metadata.
    const name = meta && typeof (meta as Record<string, unknown>).name === 'string'
      ? (meta as Record<string, unknown>).name as string
      : null;
    return name ? `Campaign outreach · ${name}` : 'Campaign outreach';
  }
  if (job === 'linkedin_accepted_sync') return 'LinkedIn accepted-invite sync';
  if (job === 'worklist_rotation') return 'My Tasks refresh (all users)';
  if (job === 'send_queue_worker') {
    // Per-campaign / per-trigger rows now carry campaignName + trigger + channel in
    // metadata. Channel tells email vs LinkedIn apart (the queue mixes both); trigger
    // tells automated vs manual. The campaign id is never shown — only the name.
    const m2 = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
    const cname = typeof m2.campaignName === 'string' ? (m2.campaignName as string) : null;
    const channel = m2.channel === 'linkedin' ? 'LinkedIn invite' : 'Email send';
    const trigger = m2.trigger === 'automated' ? 'automated' : (m2.trigger === 'manual' ? 'manual' : null);
    const base = cname ? `${channel} · ${cname}` : channel === 'LinkedIn invite' ? 'LinkedIn invite' : 'Email send';
    return trigger ? `${base} · ${trigger}` : base;
  }
  if (job === 'icp_selection') {
    // Per-campaign ICP prospect selection. The campaign name is pulled from the run's
    // metadata; the campaign id is never shown. Its report link is surfaced in the
    // Result column (see schedulerResult / the table cell), not here.
    const m2 = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
    const cname = typeof m2.campaignName === 'string' ? (m2.campaignName as string) : null;
    return cname ? `Campaign selection · ${cname}` : 'Campaign selection';
  }
  if (job === 'reply_sync') return 'Email reply sync (deprecated)';
  if (job === 'browseruse_orphan_reaper') return 'Browser session cleanup';
  if (job.startsWith('job_schedule:')) return `Job board scrape · ${job.slice('job_schedule:'.length)}`;
  if (job.startsWith('run_recovery:')) return `Scrape recovery · ${job.slice('run_recovery:'.length)}`;
  return job;
}

/** Plain-language result line for a run, built from structured metadata where
 *  available so no internal id (campaign / schedule / run) ever leaks through.
 *  Falls back to the raw backend `summary` for jobs without metadata. */
function schedulerResult(run: SchedulerRun): string {
  const m = run.metadata || {};
  switch (run.job) {
    case 'auto_first_contact': {
      const queued = typeof m.emailsQueued === 'number' ? m.emailsQueued : null;
      const invites = typeof m.invitesSent === 'number' ? m.invitesSent : null;
      const parts = [queued !== null && `${queued} emails queued`, invites !== null && `${invites} invites sent`]
        .filter(Boolean) as string[];
      return parts.length ? parts.join(' · ') : (run.summary || '—');
    }
    case 'send_queue_worker': {
      const sent = typeof m.sent === 'number' ? m.sent : null;
      const failed = typeof m.failed === 'number' ? m.failed : null;
      const parts = [sent !== null && `${sent} sent`, failed !== null && failed > 0 && `${failed} failed`]
        .filter(Boolean) as string[];
      return parts.length ? parts.join(' · ') : (run.summary || '—');
    }
    case 'linkedin_accepted_sync': {
      const users = typeof m.users === 'number' ? m.users : null;
      const matched = typeof m.matched === 'number' ? m.matched : null;
      const parts = [users !== null && `${users} account${users === 1 ? '' : 's'} checked`, matched !== null && `${matched} matched`]
        .filter(Boolean) as string[];
      return parts.length ? parts.join(' · ') : (run.summary || '—');
    }
    case 'worklist_rotation': {
      const users = typeof m.users === 'number' ? m.users : null;
      return users !== null ? `Refreshed ${users} user${users === 1 ? '' : 's'}` : (run.summary || '—');
    }
    case 'icp_selection': {
      // The report URL is rendered as a clickable link in the Result cell, so keep it
      // out of this text line (the backend summary carries it as a fallback only).
      const evaluated = typeof m.evaluated === 'number' ? m.evaluated : null;
      const selected = typeof m.selected === 'number' ? m.selected : null;
      const enriched = typeof m.enriched === 'number' ? m.enriched : null;
      const parts = [
        evaluated !== null && `${evaluated} evaluated`,
        selected !== null && `${selected} selected`,
        enriched !== null && enriched > 0 && `${enriched} enriched`,
      ].filter(Boolean) as string[];
      return parts.length ? parts.join(' · ') : (run.summary || '—');
    }
    case 'browseruse_orphan_reaper': {
      const reaped = typeof m.reaped === 'number' ? m.reaped : null;
      return reaped !== null ? `Cleared ${reaped} orphaned session${reaped === 1 ? '' : 's'}` : (run.summary || '—');
    }
    default:
      if (run.job.startsWith('job_schedule:')) return 'Started a job board scrape';
      if (run.job.startsWith('run_recovery:')) return 'Recovered an interrupted scrape run';
      return run.summary || '—';
  }
}

function schedTimeAgo(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}

// The viewer's timezone abbreviation (e.g. "IST", "GMT+2") for the audit stamp.
const LOCAL_TZ_ABBR: string = (() => {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value
      || Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch { return ''; }
})();

// Absolute local timestamp for a run (stored UTC → shown in the viewer's timezone),
// e.g. "4 Aug 2026, 11:14:07 AM". The tz label is appended by the caller.
function schedTimestamp(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtDuration(ms?: number | null, status?: string): string {
  // An interrupted run has no known duration: the worker died before it could record
  // one. The backend used to store `now - startedAt`, which is time-until-someone-
  // opened-this-page, not runtime — it showed a seconds-long job as "1063m 22s". New
  // rows store null; this also covers rows written before that fix.
  if (status === 'interrupted') return '—';
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

const SCHED_STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  success: { label: 'Success', bg: 'var(--color-success-subtle, #E6F6EC)', fg: 'var(--color-success-text, #1B7A3D)' },
  failed:  { label: 'Failed',  bg: 'var(--color-danger-subtle, #FDECEC)', fg: 'var(--color-danger-text, #C0362C)' },
  started: { label: 'Running', bg: 'var(--color-warning-subtle, #FFF6E5)', fg: 'var(--color-warning-text, #8A5A00)' },
  interrupted: { label: 'Interrupted', bg: 'var(--color-danger-subtle, #FDECEC)', fg: 'var(--color-danger-text, #C0362C)' },
  skipped: { label: 'Skipped', bg: 'var(--color-surface)', fg: 'var(--color-text-3)' },
};

/* ─────────────────────  Schedules (per-campaign automation)  ───────────────── */

// One row of the Schedules table: a campaign's automation slot. The slot lives on
// the campaign doc (automationTime + automationTimezone); when unset the scheduler
// uses the deployment default, so we show that same default here rather than a blank.
interface CampaignScheduleRow {
  key: string;
  campaign: string;
  kind: 'Search' | 'Import';
  automation: string;
  autoOn: boolean;
  /** What the automation actually performs, from the campaign's weekly plan. */
  activities: string[];
  time: string;
  timezone: string;
  myRole: 'owner' | 'collaborator';
}

type PlanShape = { email?: number[]; linkedin?: number[]; calls?: number[] } | undefined;

/** The channels the daily first-contact automation actually works, read from the
 *  campaign's weekly plan. Only Email and LinkedIn are automated (email always,
 *  LinkedIn invites when the sender has LinkedIn connected); Calls are a manual
 *  Call-Planner activity, so they're deliberately not listed as automated work. */
function automationActivities(plan: PlanShape): string[] {
  if (!plan) return [];
  const anyGoal = (row?: number[]) => (row || []).some(n => Number(n) > 0);
  const out: string[] = [];
  if (anyGoal(plan.email)) out.push('Email');
  if (anyGoal(plan.linkedin)) out.push('LinkedIn');
  return out;
}

/** A timezone's current UTC offset, e.g. "UTC+02:00", for the given IANA zone. */
function tzOffsetLabel(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(new Date());
    const raw = parts.find(p => p.type === 'timeZoneName')?.value || '';
    // Intl returns "GMT+2" / "GMT+02:00" depending on the platform — normalise to UTC±HH:MM.
    const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(raw);
    if (!m) return '';
    return `UTC${m[1]}${m[2].padStart(2, '0')}:${m[3] || '00'}`;
  } catch {
    return '';
  }
}

function SchedulesPanel() {
  const [rows, setRows] = React.useState<CampaignScheduleRow[]>([]);
  const [systemJobs, setSystemJobs] = React.useState<SystemSchedule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    // Both lists are already scoped server-side to campaigns the user owns or
    // collaborates on. Fetch them (and the workspace-wide system jobs) together; a
    // missing lead-funnel service (import campaigns are optional) must not blank out
    // the search-campaign rows.
    const [searchRes, importRes, systemRes] = await Promise.allSettled([
      listCampaigns(),
      listImportCampaigns(),
      fetchSystemSchedules(),
    ]);

    setSystemJobs(systemRes.status === 'fulfilled' ? systemRes.value.jobs : []);

    if (searchRes.status === 'rejected' && importRes.status === 'rejected') {
      setError('Could not load your campaign schedules.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const out: CampaignScheduleRow[] = [];
    if (searchRes.status === 'fulfilled') {
      for (const c of searchRes.value as Campaign[]) {
        if (c.isLegacy) continue; // synthetic bucket, not a real automation
        out.push({
          key: 'search-' + c.id,
          campaign: c.name,
          kind: 'Search',
          automation: 'Daily first contact',
          autoOn: !!c.autoFirstContact,
          activities: automationActivities(c.weeklyPlan),
          time: c.automationTime || DEFAULT_AUTOMATION_TIME,
          timezone: c.automationTimezone || DEFAULT_AUTOMATION_TZ,
          myRole: c.myRole || 'owner',
        });
      }
    }
    if (importRes.status === 'fulfilled') {
      for (const c of importRes.value.campaigns as ImportCampaignListItem[]) {
        out.push({
          key: 'import-' + c._id,
          campaign: c.name,
          kind: 'Import',
          automation: 'Daily first contact',
          autoOn: !!c.autoFirstContact,
          activities: automationActivities(c.weeklyPlan),
          time: c.automationTime || DEFAULT_AUTOMATION_TIME,
          timezone: c.automationTimezone || DEFAULT_AUTOMATION_TZ,
          myRole: c.myRole || 'owner',
        });
      }
    }
    // Owners first, then alphabetical — the schedules you can actually edit sit on top.
    out.sort((a, b) =>
      (a.myRole === b.myRole ? 0 : a.myRole === 'owner' ? -1 : 1)
      || a.campaign.localeCompare(b.campaign));
    setRows(out);
    setLoading(false);
    setRefreshing(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const th: React.CSSProperties = { textAlign: 'left', padding: '9px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-3)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '11px 14px', fontSize: '12.5px', color: 'var(--color-text-1)', borderBottom: '1px solid var(--color-border)', verticalAlign: 'middle' };

  const roleBadge = (role: 'owner' | 'collaborator') => (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 700,
      textTransform: 'capitalize',
      background: role === 'owner' ? 'var(--color-brand-subtle)' : 'var(--color-surface)',
      color: role === 'owner' ? 'var(--color-brand-text)' : 'var(--color-text-2)',
    }}>{role}</span>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)' }}>Schedules</div>
        <button onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}
          style={{ padding: '7px 14px', background: 'var(--color-bg)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: refreshing ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: refreshing ? 0.6 : 1 }}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '20px', lineHeight: 1.5, maxWidth: '68ch' }}>
        The automation slot for every campaign you own or collaborate on. Each campaign runs at its own local time; the <strong>Activities</strong> column shows what that run does — sends first contact on its planned channels (Email, and LinkedIn invites for connected accounts) and refreshes that campaign's My Tasks board. The board refresh runs even when sending is off. Edit a campaign's slot from its own Settings → Automation.
      </div>

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: '16px', color: 'var(--color-danger-text)', fontSize: '13px' }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px', lineHeight: 1.6 }}>
          No campaigns yet. Once you own or collaborate on a campaign, its automation schedule appears here.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
            <thead>
              <tr>
                <th style={th}>Campaign</th>
                <th style={th}>Automation</th>
                <th style={th}>Activities</th>
                <th style={th}>Timing</th>
                <th style={th}>Timezone</th>
                <th style={th}>Your role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const offset = tzOffsetLabel(r.timezone);
                return (
                  <tr key={r.key}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{r.campaign}</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--color-text-3)', background: 'var(--color-surface)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{r.kind}</span>
                      </div>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{r.automation}</span>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 700,
                          background: r.autoOn ? 'var(--color-success-subtle, #E6F6EC)' : 'var(--color-surface)',
                          color: r.autoOn ? 'var(--color-success-text, #1B7A3D)' : 'var(--color-text-3)',
                        }}>{r.autoOn ? 'On' : 'Off'}</span>
                      </div>
                    </td>
                    <td style={td}>
                      {r.activities.length === 0 ? (
                        <span style={{ color: 'var(--color-text-3)' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {/* Channels the run SENDS on — dimmed when the send toggle is off. */}
                          {r.activities.map(a => (
                            <span key={a} style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 600,
                              background: r.autoOn ? 'var(--color-brand-subtle)' : 'var(--color-surface)',
                              color: r.autoOn ? 'var(--color-brand-text)' : 'var(--color-text-3)',
                            }}>{a}</span>
                          ))}
                          {/* The board refresh runs per campaign at its slot regardless of the
                              send toggle, so it's always solid — never dimmed by autoOn. */}
                          <span title="Reseeds this campaign's My Tasks board for the new work-day" style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 600,
                            background: 'var(--color-surface)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)',
                          }}>My Tasks refresh</span>
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}>{r.time}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <div>{r.timezone.replace(/_/g, ' ')}</div>
                      {offset && <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '2px' }}>{offset}</div>}
                    </td>
                    <td style={td}>{roleBadge(r.myRole)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && systemJobs.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>System schedules</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-2)', marginBottom: '14px', lineHeight: 1.5, maxWidth: '68ch' }}>
            Workspace-wide jobs that keep every campaign moving. They run on a fixed daily cadence for the whole workspace — not tied to a single campaign or your role — which is why they sit apart from the table above.
          </div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {systemJobs.map((j, i) => {
              const offset = tzOffsetLabel(j.timezone);
              return (
                <div key={j.id} style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px',
                  padding: '14px 18px', borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)' }}>{j.name}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-surface)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>{j.scope}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '4px', lineHeight: 1.5 }}>{j.description}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', fontFamily: 'var(--font-mono, monospace)' }}>
                      {j.cadence} · {j.time}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                      {j.timezone.replace(/_/g, ' ')}{offset ? ` · ${offset}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const CHANGELOG_CAT: Record<string, { label: string; bg: string; fg: string }> = {
  New:      { label: 'New',      bg: 'var(--color-brand-subtle, #E8EEFF)', fg: 'var(--color-brand, #2952CC)' },
  Improved: { label: 'Improved', bg: 'var(--color-success-subtle, #E6F6EC)', fg: 'var(--color-success-text, #1B7A3D)' },
  Fixed:    { label: 'Fixed',    bg: 'var(--color-warning-subtle, #FFF6E5)', fg: 'var(--color-warning-text, #8A5A00)' },
};

function ChangelogPanel() {
  const [releases, setReleases] = React.useState<ChangelogRelease[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchChangelog()
      .then(d => { if (!cancelled) { setReleases(d.releases || []); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load changelog'); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
    } catch { return d.toLocaleDateString(); }
  };

  return (
    <div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>What&rsquo;s New</div>
      <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '24px' }}>
        The latest changes and improvements, newest first.
      </div>

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: '16px', color: 'var(--color-danger-text)', fontSize: '13px' }}>{error}</div>
      ) : releases.length === 0 ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>
          No release notes yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {releases.map(rel => (
            <div key={rel.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)',
                display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-brand, #2952CC)',
                  background: 'var(--color-brand-subtle, #E8EEFF)', padding: '2px 8px', borderRadius: '999px' }}>
                  v{rel.version}
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)' }}>{rel.title}</span>
                {rel.date ? <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-text-3)' }}>{fmtDate(rel.date)}</span> : null}
              </div>
              <div style={{ padding: '6px 18px 14px' }}>
                {(rel.entries || []).map((e: ChangelogEntry, i: number) => {
                  const cat = CHANGELOG_CAT[e.category] || { label: e.category, bg: 'var(--color-surface)', fg: 'var(--color-text-2)' };
                  return (
                    <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 0',
                      borderBottom: i < rel.entries.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <span style={{ flexShrink: 0, marginTop: '1px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '.3px', color: cat.fg, background: cat.bg, padding: '3px 8px', borderRadius: '6px',
                        minWidth: '66px', textAlign: 'center' }}>
                        {cat.label}
                      </span>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: '2px' }}>{e.title}</div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-2)', lineHeight: 1.55 }}>{e.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SchedulerHealthPanel() {
  const [runs, setRuns] = React.useState<SchedulerRun[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const d = await fetchSchedulerAudit(100);
      setRuns(d.runs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load scheduler runs');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const th: React.CSSProperties = { textAlign: 'left', padding: '9px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-3)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '11px 14px', fontSize: '12.5px', color: 'var(--color-text-1)', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)' }}>Scheduler Health</div>
        <button onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}
          style={{ padding: '7px 14px', background: 'var(--color-bg)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: refreshing ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: refreshing ? 0.6 : 1 }}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '20px' }}>
         Every automated schedule run, newest first. Each campaign runs at its own local time (set per campaign in Settings → Automation); the slot each run used is shown beside it.
      </div>

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: '16px', color: 'var(--color-danger-text)', fontSize: '13px' }}>{error}</div>
      ) : runs.length === 0 ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px', lineHeight: 1.6 }}>
          No scheduler runs recorded yet. Runs appear here after the next scheduled job fires (or a manual trigger).
        </div>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead>
              <tr>
                <th style={th}>Job</th>
                <th style={th}>Status</th>
                <th style={th}>When{LOCAL_TZ_ABBR ? ` (${LOCAL_TZ_ABBR})` : ''}</th>
                <th style={th}>Duration</th>
                <th style={th}>Result</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => {
                const meta = SCHED_STATUS_META[r.status] || SCHED_STATUS_META.skipped;
                return (
                  <tr key={r.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>
                        {schedulerJobLabel(r.job, r.metadata)}
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 'var(--radius-full)', fontSize: '11.5px', fontWeight: 700, background: meta.bg, color: meta.fg }}>{meta.label}</span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }} title={r.startedAt ? `${r.startedAt} (UTC)` : ''}>
                      <div>{schedTimestamp(r.startedAt)}{LOCAL_TZ_ABBR ? ` ${LOCAL_TZ_ABBR}` : ''}</div>
                      {schedTimeAgo(r.startedAt) && <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '2px' }}>{schedTimeAgo(r.startedAt)}</div>}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDuration(r.durationMs, r.status)}</td>
                    <td style={td}>
                      {r.error
                        ? <span style={{ color: 'var(--color-danger-text)' }}>{r.error}</span>
                        : <span style={{ color: 'var(--color-text-2)' }}>{schedulerResult(r)}</span>}
                      {!r.error && typeof r.metadata?.reportUrl === 'string' && r.metadata.reportUrl && (
                        <a
                          href={r.metadata.reportUrl as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'block', marginTop: '3px', fontSize: '12px', fontWeight: 600, color: 'var(--color-brand, #2952CC)', textDecoration: 'none' }}
                        >
                          View report ↗
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SettingsView() {
  const [activePage, setActivePage] = React.useState('profile');
  const [innerCollapsed, setInnerCollapsed] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState('');

  const [health, setHealth] = React.useState<SystemHealthCheck[] | null>(null);
  const [healthLoading, setHealthLoading] = React.useState(true);
  const [healthCheckedAt, setHealthCheckedAt] = React.useState<string | null>(null);
  const [healthRefreshing, setHealthRefreshing] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    setHealthLoading(true);
    fetchSystemHealth()
      .then(p => { if (!cancelled) { setHealth(p.checks); setHealthCheckedAt(p.checkedAt ?? null); setHealthLoading(false); } })
      .catch(() => { if (!cancelled) { setHealth([]); setHealthLoading(false); } });
    return () => { cancelled = true; };
  }, []);
  const refreshHealth = React.useCallback(async () => {
    setHealthRefreshing(true);
    try {
      const p = await refreshSystemHealth();
      setHealth(p.checks);
      setHealthCheckedAt(p.checkedAt ?? null);
    } catch { /* leave the last good snapshot in place */ }
    finally { setHealthRefreshing(false); }
  }, []);
  const worstStatus: HealthStatus | null = (() => {
    if (!health || health.length === 0) return null;
    if (health.some(c => c.status === 'red')) return 'red';
    if (health.some(c => c.status === 'amber')) return 'amber';
    return 'green';
  })();
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('system-health:status', { detail: worstStatus }));
  }, [worstStatus]);

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2200); };

  const scard = (children: ReactNode, style: React.CSSProperties = {}) => (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '16px', ...style }}>
      {children}
    </div>
  );

  const cardHdr = (title: string, sub?: string | null, action?: ReactNode) => (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>{title}</div>
        {sub && <div style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '2px' }}>{sub}</div>}
      </div>
      {action}
    </div>
  );

  const row = (label: string, hint: string | null, control: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div>
        <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-1)' }}>{label}</div>
        {hint && <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '2px' }}>{hint}</div>}
      </div>
      {control}
    </div>
  );

  const Toggle2 = ({ def }: { def?: boolean }) => {
    const [on, setOn] = React.useState(def || false);
    return (
      <label style={{ position: 'relative', width: '38px', height: '22px', flexShrink: 0, cursor: 'pointer' }}>
        <input type="checkbox" checked={on} onChange={e => { setOn(e.target.checked); toast(e.target.checked ? 'Enabled' : 'Disabled'); }}
          style={{ opacity: 0, width: 0, height: 0 }} />
        <div style={{ width: '38px', height: '22px', borderRadius: '11px', background: on ? 'var(--color-brand)' : '#D1D5DB', transition: 'background .2s', position: 'absolute', top: 0, left: 0 }} />
        <div style={{ position: 'absolute', top: '3px', left: on ? '19px' : '3px', width: '16px', height: '16px', background: '#fff', borderRadius: '50%', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)', pointerEvents: 'none' }} />
      </label>
    );
  };

  const PrimaryBtn = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick || (() => toast('Saved'))}
      style={{ padding: '7px 16px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
      {children}
    </button>
  );

  const pages: Record<string, ReactNode> = {
    devices: <DevicesPanel onToast={toast} />,
    schedules: <SchedulesPanel />,
    scheduler: <SchedulerHealthPanel />,
    systemhealth: <SystemHealthPanel checks={health || []} loading={healthLoading}
      checkedAt={healthCheckedAt} onRefresh={refreshHealth} refreshing={healthRefreshing} />,
    changelog: <ChangelogPanel />,
    salesprofile: <SalesProfilePanel onToast={toast} />,
    profile: <ProfilePanel onToast={toast} />,
    notifications: (
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>Notifications</div>
        <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px' }}>Choose what you want to be notified about.</div>
        {scard(<>
          {cardHdr('Email Notifications')}
          <div style={{ padding: '20px' }}>
            {row('Call summary reports', 'Receive a daily digest of all call activity.', <Toggle2 def={true} />)}
            {row('Billing alerts', 'Get notified about invoices and payment issues.', <Toggle2 def={true} />)}
            {row('API errors & downtime', 'Alerts when agents experience errors.', <Toggle2 def={false} />)}
            {row('Product updates', 'Changelog and release notes.', <Toggle2 def={false} />)}
          </div>
        </>)}
      </div>
    ),
    display: (
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>Display</div>
        <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px' }}>Customise the appearance of your workspace.</div>
        {scard(<>
          {cardHdr('Theme')}
          <div style={{ padding: '20px' }}>
            {row('Color mode', null,
              <select onChange={() => toast('Saved')} style={{ border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', padding: '7px 12px', fontFamily: 'var(--font-sans)', fontSize: '13.5px', color: 'var(--color-text-1)', background: '#fff', outline: 'none', width: '200px' }}>
                <option>Light</option><option>Dark</option><option>System</option>
              </select>)}
            {row('Compact density', 'Reduce spacing for more content.', <Toggle2 />)}
            {row('Language', null,
              <select onChange={() => toast('Saved')} style={{ border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', padding: '7px 12px', fontFamily: 'var(--font-sans)', fontSize: '13.5px', color: 'var(--color-text-1)', background: '#fff', outline: 'none', width: '200px' }}>
                <option>English (US)</option><option>English (UK)</option>
              </select>)}
          </div>
        </>)}
      </div>
    ),
    limits: (
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>Limits</div>
        <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px' }}>View and manage concurrency and telephony limits.</div>
        {scard(<>
          {cardHdr('Concurrent Calls Limit')}
          <div style={{ padding: '20px' }}>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-1)' }}>Concurrent Calls</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)' }}>20</div>
            </div>
          </div>
        </>)}
      </div>
    ),
    members: <MembersPanel onToast={toast} />,
    apikeys: (
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>API Keys</div>
        <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px' }}>Manage API keys to authenticate requests.</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', borderRadius: '8px', background: '#FFF8E6', border: '1px solid #FAE3A0', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: '#7A5C00' }}>API keys are shown only once at creation. Store them securely.</span>
        </div>
        {scard(<>
          {cardHdr('Active Keys', null,
            <button onClick={() => toast('Key generated')} style={{ padding: '5px 12px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Generate new key</button>
          )}
          <div style={{ padding: '20px' }}>
            {['Production key', 'Dev / staging'].map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: '3px' }}>{k}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>Created Mar 2025</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text-1)', background: 'var(--color-surface)', padding: '5px 10px', borderRadius: '5px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>sk-••••••••••••••••••••••••</div>
                <button onClick={() => toast('Copied')} style={{ padding: '4px 10px', background: 'none', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>Copy</button>
              </div>
            ))}
          </div>
        </>)}
      </div>
    ),
    billing: (
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>Billing & Plans</div>
        <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px' }}>Manage your subscription and payment details.</div>
        {scard(<>
          {cardHdr('Current Plan')}
          <div style={{ padding: '20px' }}>
            {row('Plan', null,
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-1)' }}>Trial</span>
                <span style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', padding: '3px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700 }}>30 days left</span>
              </div>
            )}
            <div style={{ marginTop: '8px' }}><PrimaryBtn>Upgrade to Pro</PrimaryBtn></div>
          </div>
        </>)}
      </div>
    ),
    forwarding: <EmailForwardingPanel onToast={toast} />,
    outlook: (
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>Outlook</div>
        <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px', lineHeight: 1.5 }}>Sync your Outlook emails and calendar events to streamline outreach and scheduling.</div>
        {scard(<>
          <div style={{ padding: '28px 24px 8px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #0078D4 0%, #2B88D8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,120,212,.25)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="#fff" strokeWidth="1.5" /><path d="M3 8l9 5 9-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>
            <div style={{ paddingBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)' }}>Outlook</div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '2px' }}>Email & Calendar</div>
            </div>
          </div>
          <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-3)', background: 'var(--color-surface)', padding: '5px 14px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Coming Soon</span>
            <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', maxWidth: '360px', lineHeight: 1.5 }}>Outlook integration is on the way. You'll be able to connect your mailbox and calendar here soon.</div>
          </div>
        </>)}
      </div>
    ),
    linkedin: (
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>LinkedIn</div>
        <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px', lineHeight: 1.5 }}>Authenticate with your LinkedIn account to import leads and automate outreach.</div>
        <LinkedInIntegrationPanel onToast={toast} />
      </div>
    ),
    apollo: (
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>Apollo</div>
        <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px', lineHeight: 1.5 }}>Authenticate with your Apollo.io account to sync prospect data.</div>
        {scard(<>
          <div style={{ padding: '28px 24px 8px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #6C3CE1 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(108,60,225,.25)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6.5v11L12 22l8-4.5v-11L12 2z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /><path d="M12 8l4.5 2.5v5L12 18l-4.5-2.5v-5L12 8z" fill="rgba(255,255,255,.3)" stroke="#fff" strokeWidth="1" strokeLinejoin="round" /></svg>
            </div>
            <div style={{ paddingBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)' }}>Apollo.io</div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '2px' }}>Enter your credentials below to connect</div>
            </div>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: '6px' }}>Username / Email</label>
              <input type="text" placeholder="you@company.com"
                style={{ width: '100%', maxWidth: '420px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: '13.5px', color: 'var(--color-text-1)', background: '#fff', outline: 'none', transition: 'border-color .15s, box-shadow .15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = 'var(--shadow-focus)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-2)'; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: '6px' }}>Password</label>
              <input type="password" placeholder="••••••••"
                style={{ width: '100%', maxWidth: '420px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: '13.5px', color: 'var(--color-text-1)', background: '#fff', outline: 'none', transition: 'border-color .15s, box-shadow .15s' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = 'var(--shadow-focus)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-2)'; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
            <button onClick={() => toast('Authentication successful!')}
              style={{ padding: '10px 28px', background: 'linear-gradient(135deg, #6C3CE1 0%, #8B5CF6 100%)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', boxShadow: '0 4px 14px rgba(108,60,225,.3)', transition: 'transform .12s, box-shadow .12s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(108,60,225,.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(108,60,225,.3)'; }}>
              Authenticate
            </button>
            <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="6" height="5" rx="1" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" /></svg>
              Your credentials are encrypted and stored securely
            </div>
          </div>
        </>)}
      </div>
    ),
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <nav style={{
        width: `${innerCollapsed ? INNER_RAIL : INNER_EXPANDED}px`,
        minWidth: `${innerCollapsed ? INNER_RAIL : INNER_EXPANDED}px`,
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-bg)', overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column',
        transition: 'width .2s ease, min-width .2s ease', flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', justifyContent: innerCollapsed ? 'center' : 'flex-end',
          padding: innerCollapsed ? '10px 0 4px' : '10px 10px 4px', flexShrink: 0,
        }}>
          <button onClick={() => setInnerCollapsed(c => !c)}
            style={{
              width: '26px', height: '26px', border: 'none', background: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '6px', color: 'var(--color-text-3)', flexShrink: 0,
            }}>
            {innerCollapsed ? SIC.expand : SIC.collapse}
          </button>
        </div>

        {innerCollapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px 0 16px' }}>
            {SETTINGS_NAV.map((grp, gi) => (
              <React.Fragment key={grp.group}>
                {gi > 0 && <div style={{ height: '1px', background: 'var(--color-border)', margin: '4px 8px' }} />}
                {grp.items.map(item => {
                  const active = activePage === item.id;
                  const isHealth = item.id === 'systemhealth';
                  return (
                    <div key={item.id} title={item.label} onClick={() => setActivePage(item.id)}
                      style={{
                        width: `${INNER_RAIL}px`, height: '36px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '8px', cursor: 'pointer', position: 'relative',
                        color: active ? 'var(--color-brand)' : (isHealth && worstStatus ? STATUS_COLOR[worstStatus] : 'var(--color-text-2)'),
                        background: active ? 'var(--color-brand-tint)' : 'transparent',
                        margin: '1px auto',
                      }}>{item.icon}{isHealth && worstStatus && (
                        <span style={{ position: 'absolute', top: '5px', right: '5px' }}><StatusDot status={worstStatus} size={7} /></span>
                      )}</div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div style={{ padding: '4px 0 16px' }}>
            {SETTINGS_NAV.map((grp, gi) => (
              <div key={grp.group}>
                {gi > 0 && <div style={{ height: '1px', background: 'var(--color-border)', margin: '8px 14px' }} />}
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.7px', padding: '8px 16px 4px' }}>
                  {grp.group}
                </div>
                {grp.items.map(item => {
                  const active = activePage === item.id;
                  const isHealth = item.id === 'systemhealth';
                  return (
                    <div key={item.id} onClick={() => setActivePage(item.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '9px',
                        padding: '7px 14px', margin: '1px 8px',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        fontSize: '13.5px', fontWeight: active ? 600 : 500,
                        color: active ? 'var(--color-brand)' : (isHealth && worstStatus ? STATUS_COLOR[worstStatus] : 'var(--color-text-1)'),
                        background: active ? 'var(--color-brand-tint)' : 'transparent',
                      }}>
                      <span style={{ color: active ? 'var(--color-brand)' : (isHealth && worstStatus ? STATUS_COLOR[worstStatus] : 'var(--color-text-2)'), display: 'flex' }}>
                        {item.icon}
                      </span>
                      {item.label}
                      {isHealth && worstStatus && <span style={{ marginLeft: 'auto' }}><StatusDot status={worstStatus} size={8} /></span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </nav>

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        {pages[activePage] || pages.profile}
      </div>

      {toastMsg && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--color-text-1)', color: '#fff', padding: '10px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 500, zIndex: 999 }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
