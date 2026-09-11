'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchRun, fetchCompanies, fetchProspects, sendOutreach, enrichProspectEmails,
  deleteImportCampaign, fetchActiveUsers, fetchEmailSenders, updateImportCampaign, rediscoverProspects,
  fetchOutreachTemplates, fetchOutreachLogs, startAccountIntel, fetchAccountIntelProgress, setCompanyStatus,
  isProspectContacted, fetchLinkedInTemplates, fetchLinkedInTemplateById, fetchLinkedInSenders,
  type LeadFunnelRun, type LeadFunnelCompany, type LeadFunnelProspect, type ActiveUser, type EmailSender, type OutreachTemplate,
  type AccountIntelProgress, type LinkedInTemplate, type LinkedInSender
} from '@/lib/leadFunnelApi';
import { type Option, MultiSelectDropdown } from './Dropdowns';
import { AutomationSchedule } from './AutomationSchedule';
import { Toast } from '@/components/ui/Toast';
import { TestTemplateDialog } from './TestTemplateDialog';
import { fetchCampaignTestInfo, sendCampaignTest } from '@/lib/leadFunnelApi';
import { TagChipInput } from './lead/TagChipInput';
import { ImportProspectsPanel } from './lead/ImportProspectsPanel';
import { ImportOverview } from './lead/ImportOverview';
import { ImportOutreachStatusPanel } from './lead/ImportOutreachStatusPanel';
import { ImportCompanyDetailsPopup } from './lead/ImportCompanyDetailsPopup';
import { ImportPersonDetailsPopup } from './lead/ImportPersonDetailsPopup';
import { WeeklyPlanEditor } from './WeeklyPlanEditor';
import { ActivePromptSetting } from './ActivePromptSetting';

// The LinkedIn column shows a 3-state outreach status, not the raw lifecycle:
//   not yet contacted → we have (or are sourcing) their profile but haven't reached out
//   contacted         → connection invite sent, awaiting acceptance
//   response received  → invite accepted (and anything after, e.g. we've since messaged)
const LI_STATUS_LABEL: Record<string, string> = {
  needs_url: 'Not yet contacted', url_sourced: 'Not yet contacted', invite_sent: 'Contacted',
  connected: 'Response received', messaged: 'Response received', failed: 'Failed',
};

/** Compact LinkedIn outreach-status badge for tables. */
function LiStatusChip({ status }: { status?: string | null }) {
  if (!status) return <span style={{ color: 'var(--color-text-3)' }}>—</span>;
  const color =
    status === 'connected' || status === 'messaged' ? 'var(--color-success-text)'
    : status === 'invite_sent' ? 'var(--color-brand-text)'
    : status === 'failed' ? 'var(--color-danger-text)'
    : 'var(--color-text-3)';   // not yet contacted — muted, it's the neutral starting state
  return <span style={{ fontSize: '11px', fontWeight: 700, color }}>{LI_STATUS_LABEL[status] || status}</span>;
}

type Tab = 'companies' | 'prospects';
const DEFAULT_ROWS_PER_PAGE = 20;
const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 75, 100];

const RUN_STATUS: Record<string, [string, string]> = {
  running: ['var(--color-success-bg)', 'var(--color-success-text)'],
  completed: ['var(--color-brand-subtle)', 'var(--color-brand-text)'],
  failed: ['var(--color-danger-bg)', 'var(--color-danger-text)'],
  pending: ['var(--color-warning-bg)', 'var(--color-warning-text)'],
};
const SIGNAL_BADGE: Record<string, [string, string, string]> = {
  green: ['var(--color-success-bg)', 'var(--color-success-text)', 'var(--color-success)'],
  yellow: ['var(--color-warning-bg)', 'var(--color-warning-text)', 'var(--color-warning)'],
  orange: ['#FFE8D2', '#C2540B', '#F97316'],
  red: ['var(--color-danger-bg)', 'var(--color-danger-text)', 'var(--color-danger)'],
};
// The account-category tier name, derived from the stored `signal` colour key —
// NOT from the stored `label`, which may be stale (a row classified before the
// taxonomy changed still carries its old label like "Interested"). The colour
// key is the canonical value the filter matches on, so deriving from it keeps
// the badge, the filter and the legend in lockstep without re-running research.
const SIGNAL_NAME: Record<string, string> = { green: 'High-intent', yellow: 'Relevant', orange: 'On-Watch', red: 'Dormant' };
const SIGNAL_LABEL: Record<string, string> = { green: '🟢 High-intent', yellow: '🟡 Relevant', orange: '🟠 On-Watch', red: '🔴 Dormant' };

const mgmtLevel = (title: string) => {
  const t = (title || '').toLowerCase();
  if (/(ceo|coo|cfo|cto|cpo|chief|founder|co-founder|managing director|president|executive director)/.test(t)) return 'C-Suite';
  if (/(vice president|\bvp\b|svp|evp)/.test(t)) return 'VP';
  if (/\bhead of\b/.test(t)) return 'Head';
  if (/\bdirector\b/.test(t)) return 'Director';
  return 'Other';
};
const sizeLabel = (size: string | null | undefined) => {
  const n = parseInt(size || '0', 10);
  if (!n) return '';
  if (n <= 50) return 'Small (1–50)';
  if (n <= 200) return 'Medium (51–200)';
  return 'Large (200+)';
};
const locStr = (i: { city?: string | null; state?: string | null; country?: string | null; location?: string | null }) => {
  const parts = [i.city, i.state, i.country].filter(Boolean);
  return parts.length ? parts.join(', ') : (i.location || '');
};

const ICP_LEVEL_LABELS: Record<string, string> = {
  owner: 'Owner',
  founder: 'Founder',
  c_suite: 'C suite',
  partner: 'Partner',
  vp: 'Vp',
  head: 'Head',
  director: 'Director',
  manager: 'Manager',
};
// Ordered list of Apollo person_seniorities used by the ICP management-level picker.
const ICP_LEVEL_ORDER = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director', 'manager'];

const INNER_EXPANDED = 220;

const CSI = ({ d, size = 15 }: { d: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, color: 'inherit', display: 'block' }}>
    {d}
  </svg>
);

const CIC = {
  stats:    <CSI d={<><line x1="2" y1="15" x2="16" y2="15" /><rect x="4" y="9"  width="2.5" height="6" /><rect x="8" y="6"  width="2.5" height="9" /><rect x="12" y="3" width="2.5" height="12" /></>} />,
  runs:     <CSI d={<><polygon points="4,3 14,9 4,15" /></>} />,
  settings: <CSI d={<><circle cx="9" cy="9" r="2.5" /><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.6 3.6l1.5 1.5M12.9 12.9l1.5 1.5M3.6 14.4l1.5-1.5M12.9 5.1l1.5-1.5" /></>} />,
};

interface NavItem { id: 'overview' | 'workflow' | 'settings'; label: string; icon: React.ReactNode }
const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: CIC.stats },
  { id: 'workflow', label: 'Run History', icon: CIC.runs },
  { id: 'settings', label: 'Settings', icon: CIC.settings },
];

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Settings row: text grows, control stays a fixed column.
 *  Mirrors CampaignDetailView's FieldRow — see the note there for why the old
 *  fixed 140px label column squeezed hints into a narrow ribbon. */
function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      gap: '32px', padding: '14px 0', borderBottom: '1px solid var(--color-border)',
    }}>
      {/* The text column grows to fill the row so the control is pushed flush to the
          right edge, lining up with every other row's value. The readable-line cap
          belongs on the TEXT, not the column — capping the column left it short of
          the card edge with the control stranded in open space. */}
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)' }}>{label}</div>
        {hint && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginTop: '3px', lineHeight: 1.5, maxWidth: '70ch' }}>
            {hint}
          </div>
        )}
      </div>
      <div style={{ flex: '0 1 300px', minWidth: '150px', display: 'flex', justifyContent: 'flex-end' }}>
        {children}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)', padding: '18px 20px',
};
const fieldValStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)',
};
const icpLabel: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)',
  textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px',
};
const icpHint: React.CSSProperties = {
  fontSize: '12px', color: 'var(--color-text-3)', margin: '0 0 6px', lineHeight: 1.4,
};
const dangerBtnStyle: React.CSSProperties = {
  padding: '6px 14px', background: 'var(--color-bg)', color: 'var(--color-danger-text)',
  border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)',
  fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};
const inputStyle: React.CSSProperties = {
  width: '100%', maxWidth: '300px', height: '34px', padding: '0 10px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-2)',
  background: 'var(--color-bg)', color: 'var(--color-text-1)',
  fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none'
};
const selectStyle: React.CSSProperties = {
  width: '100%', maxWidth: '300px', height: '34px', padding: '0 8px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-2)',
  background: 'var(--color-bg)', color: 'var(--color-text-1)',
  fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'pointer'
};


export function ImportRunDetailView({ runId }: { runId: string }) {
  const router = useRouter();
  const [run, setRun] = React.useState<LeadFunnelRun | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<Tab>('companies');

  const [activePage, setActivePage] = React.useState<'overview' | 'workflow' | 'settings'>('workflow');
  const [deletingCampaign, setDeletingCampaign] = React.useState(false);

  const handleDelete = async () => {
    if (deletingCampaign) return;
    if (!window.confirm(`Delete campaign "${run?.runName}"?\n\nThis permanently removes the campaign and all associated prospects, runs, and outreach logs. This cannot be undone.`)) return;
    setDeletingCampaign(true);
    try {
      await deleteImportCampaign(run?.campaignId || '');
      router.push('/dashboard');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Delete failed');
      setDeletingCampaign(false);
    }
  };

  const [activeUsers, setActiveUsers] = React.useState<ActiveUser[]>([]);
  const [emailSenders, setEmailSenders] = React.useState<EmailSender[]>([]);
  const [templates, setTemplates] = React.useState<OutreachTemplate[]>([]);
  const [editDefaultTemplateIds, setEditDefaultTemplateIds] = React.useState<string[]>([]);
  // Separate campaign defaults for invite notes and post-acceptance follow-ups.
  const [linkedinTemplates, setLinkedinTemplates] = React.useState<LinkedInTemplate[]>([]);
  const [editDefaultLinkedinInviteTemplateIds, setEditDefaultLinkedinInviteTemplateIds] = React.useState<string[]>([]);
  const [editDefaultLinkedinTemplateIds, setEditDefaultLinkedinTemplateIds] = React.useState<string[]>([]);
  // Per-campaign LinkedIn invite sender. Normal users see only their own connected
  // account here; the admin sees everyone's, so they can send on anyone's behalf.
  const [linkedinSenders, setLinkedinSenders] = React.useState<LinkedInSender[]>([]);
  const [editLinkedinSenderUserId, setEditLinkedinSenderUserId] = React.useState<string>('');
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editIndustry, setEditIndustry] = React.useState('');
  const [editSenderEmail, setEditSenderEmail] = React.useState('');
  const [editSenderEngine, setEditSenderEngine] = React.useState('outlook');
  const [editForwardEmail, setEditForwardEmail] = React.useState('');
  // Fixed CC list copied on every outreach email (multi-value).
  const [editCcEmails, setEditCcEmails] = React.useState<string[]>([]);
  // One owner + N collaborators (collaborators are view + manual-send only).
  const [editOwners, setEditOwners] = React.useState<string[]>([]);
  const [editCollaborators, setEditCollaborators] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  // ICP targeting (company-import campaigns) — edited in Settings, drives discovery.
  const [editSeniorities, setEditSeniorities] = React.useState<Option[]>(
    ICP_LEVEL_ORDER.map(v => ({ id: v, name: ICP_LEVEL_LABELS[v] || v, selected: false }))
  );
  const [editTitles, setEditTitles] = React.useState<string[]>([]);
  const [editExcludeTitles, setEditExcludeTitles] = React.useState<string[]>([]);
  const [editDepartments, setEditDepartments] = React.useState<string[]>([]);
  const [rediscovering, setRediscovering] = React.useState(false);

  // Campaign lifecycle status — an immediate toggle (independent of Edit mode).
  const [campaignStatus, setCampaignStatus] = React.useState<string>('active');
  const [savingStatus, setSavingStatus] = React.useState(false);
  React.useEffect(() => { if (run?.campaignStatus) setCampaignStatus(run.campaignStatus); }, [run?.campaignStatus]);
  const isActive = campaignStatus === 'active';
  const toggleStatus = async () => {
    if (savingStatus || !run?.campaignId) return;
    const next = isActive ? 'paused' : 'active';
    setCampaignStatus(next); setSavingStatus(true);
    try {
      await updateImportCampaign(run.campaignId, { status: next });
    } catch {
      setToast('Could not update campaign status');
      setCampaignStatus(isActive ? 'active' : 'paused');
    } finally { setSavingStatus(false); }
  };

  // Fully automated first contact — sends this campaign's daily worklist for you.
  const [autoFC, setAutoFC] = React.useState<boolean>(false);
  const [savingAutoFC, setSavingAutoFC] = React.useState(false);
  React.useEffect(() => { setAutoFC(!!run?.campaignAutoFirstContact); }, [run?.campaignAutoFirstContact]);
  const toggleAutoFC = async () => {
    if (savingAutoFC || !run?.campaignId) return;
    const next = !autoFC;
    setAutoFC(next); setSavingAutoFC(true);
    try {
      await updateImportCampaign(run.campaignId, { autoFirstContact: next });
    } catch {
      setToast('Could not update automated first contact');
      setAutoFC(!next);
    } finally { setSavingAutoFC(false); }
  };

  // When this campaign's automation runs, in its own zone. Stored as an IANA zone
  // name so daylight saving is the tz database's problem, not ours.
  //
  // Edited through the same Edit Details flow as everything else on this screen:
  // changes sit in this buffer and are written by Save, so Cancel really discards.
  const [testingCampaign, setTestingCampaign] = React.useState(false);
  const [editSchedule, setEditSchedule] = React.useState<{ timezone: string; time: string }>(
    { timezone: 'Europe/Berlin', time: '15:00' });
  const schedule = React.useMemo(() => ({
    timezone: run?.automationTimezone || 'Europe/Berlin',
    time: run?.automationTime || '15:00',
  }), [run?.automationTimezone, run?.automationTime]);

  // The slot is frozen from a couple of hours before a run until it finishes,
  // because it defines the work-day the run is keyed by. The server decides and
  // enforces this; the flag only stops someone typing into a field that would be
  // refused on save.
  const scheduleLock = run?.automationEditLock;
  const scheduleLocked = !!scheduleLock?.locked;
  // Rendered in the campaign's OWN zone, not the viewer's: the whole card talks in
  // campaign-local time, and "after 19:00" means nothing if it is 19:00 somewhere else.
  const lockOpensLabel = React.useMemo(() => {
    if (!scheduleLock?.opensAt) return null;
    const t = new Date(scheduleLock.opensAt);
    if (Number.isNaN(t.getTime())) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit', minute: '2-digit', timeZone: schedule.timezone, timeZoneName: 'short',
      }).format(t);
    } catch { return null; }
  }, [scheduleLock?.opensAt, schedule.timezone]);

  // Weekly plan (per-channel per-weekday commitment) — shared source of truth with
  // the Weekly Goals screen and My Tasks. Saving syncs dailyEmailGoal server-side.
  const [savingPlan, setSavingPlan] = React.useState(false);
  const saveWeeklyPlan = async (plan: import('@/lib/leadFunnelApi').WeeklyPlan) => {
    if (!run?.campaignId) { setToast('This campaign has no editable plan.'); throw new Error('No campaign'); }
    setSavingPlan(true);
    try {
      await updateImportCampaign(run.campaignId, { weeklyPlan: plan });
      const d = await fetchRun(runId); setRun(d.run);
    } finally { setSavingPlan(false); }
  };

  React.useEffect(() => {
    if (activePage === 'settings') {
      fetchActiveUsers().then(setActiveUsers).catch(() => {});
      fetchEmailSenders().then(d => { if (d.senders) setEmailSenders(d.senders); }).catch(() => {});
      fetchOutreachTemplates().then(d => setTemplates(d.templates)).catch(() => {});
      // Load ALL LinkedIn templates so this selector works the same as the email
      // Default Templates one — previously it filtered to category 'follow-up',
      // which left the picker empty (and unusable) for users with only invite
      // templates.
      fetchLinkedInTemplates().then(d => setLinkedinTemplates(d.templates || [])).catch(() => {});
      // Selectable LinkedIn invite senders (self only, or all for the admin).
      fetchLinkedInSenders().then(d => setLinkedinSenders(d.senders || [])).catch(() => {});
    }
  }, [activePage]);

  // Display name for a template id (used in the read-only Default Templates row).
  const templateName = (id: string) => {
    const t = templates.find(t => t._id === id);
    return t ? (t.name || `${t.industry} · ${t.persona}`) : id;
  };

  // Display name for a LinkedIn follow-up template id (read-only row). Falls back
  // to "Untitled template" rather than leaking the raw id; the effect below fills
  // in names for templates that aren't in the caller's scoped list.
  const linkedinTemplateName = (id: string) => {
    const t = linkedinTemplates.find(t => t._id === id);
    return t ? (t.name || 'Untitled template') : 'Untitled template';
  };

  // The run's default LinkedIn templates may have been pinned by another user, so
  // they aren't always in the caller's list. Fetch any missing ones by id so the
  // read-only rows show real names instead of template ids.
  React.useEffect(() => {
    if (!run) return;
    const ids = [
      ...(run.defaultLinkedinTemplateIds || []),
      ...(run.defaultLinkedinInviteTemplateIds || []),
    ];
    const missing = ids.filter(id => !linkedinTemplates.some(t => t._id === id));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map(id =>
        fetchLinkedInTemplateById(id).then(d => d.template).catch(() => null),
      ),
    ).then(templates => {
      if (cancelled) return;
      const valid = templates.filter(Boolean) as LinkedInTemplate[];
      if (valid.length === 0) return;
      setLinkedinTemplates(prev => {
        const have = new Set(prev.map(t => t._id));
        return [...prev, ...valid.filter(t => !have.has(t._id))];
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, linkedinTemplates]);

  const startEdit = () => {
    if (!run) return;
    setEditName(run.runName);
    setEditIndustry(run.industry);
    setEditSenderEmail(run.senderEmail || '');
    setEditSenderEngine(run.senderEngine || 'outlook');
    setEditForwardEmail(run.forwardToEmail || '');
    setEditCcEmails(run.ccEmails || []);
    setEditOwners(run.owners || []);
    setEditCollaborators(run.collaborators || []);
    // Pre-fill the ICP editor with the campaign's current targeting.
    const selected = new Set(run.filters?.seniorities || []);
    setEditSeniorities(ICP_LEVEL_ORDER.map(v => ({ id: v, name: ICP_LEVEL_LABELS[v] || v, selected: selected.has(v) })));
    setEditTitles(run.filters?.titles || []);
    setEditExcludeTitles(run.filters?.excludeTitles || []);
    setEditDepartments(run.filters?.departments || []);
    setEditDefaultTemplateIds(run.defaultTemplateIds || []);
    setEditDefaultLinkedinInviteTemplateIds(run.defaultLinkedinInviteTemplateIds || []);
    setEditDefaultLinkedinTemplateIds(run.defaultLinkedinTemplateIds || []);
    setEditLinkedinSenderUserId(run.linkedinSenderUserId || '');
    setEditSchedule({
      timezone: run.automationTimezone || 'Europe/Berlin',
      time: run.automationTime || '15:00',
    });
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (saving || !run) return;
    setSaving(true);
    try {
      const isCompanies = run.importType === 'companies';
      await updateImportCampaign(run.campaignId || '', {
        name: editName,
        industry: editIndustry,
        senderEmail: editSenderEmail,
        senderEngine: editSenderEngine,
        forwardToEmail: editForwardEmail.trim(),
        ccEmails: editCcEmails,
        owners: editOwners,
        collaborators: editCollaborators,
        defaultTemplateIds: editDefaultTemplateIds,
        defaultLinkedinInviteTemplateIds: editDefaultLinkedinInviteTemplateIds,
        defaultLinkedinTemplateIds: editDefaultLinkedinTemplateIds,
        linkedinSenderUserId: editLinkedinSenderUserId,
        // Omitted entirely while frozen. Sending the unchanged value would be
        // harmless (the server only refuses an actual change), but leaving it out
        // means a stale buffer — a form opened before the window and saved inside
        // it — cannot resubmit an old time and fail the whole save.
        ...(scheduleLocked ? {} : {
          automationTimezone: editSchedule.timezone,
          automationTime: editSchedule.time,
        }),
        // Daily email goal is driven by the Weekly Plan (Monday's email value),
        // so it is no longer edited here.
        // ICP targeting only applies to company-import campaigns.
        ...(isCompanies ? {
          seniorities: editSeniorities.filter(s => s.selected).map(s => s.id),
          titles: editTitles,
          excludeTitles: editExcludeTitles,
          departments: editDepartments,
        } : {}),
      });
      const d = await fetchRun(runId);
      setRun(d.run);
      setIsEditing(false);
      setToast(isCompanies
        ? 'ICP updated. Use “Re-run prospect search” to find new matches.'
        : 'Campaign updated successfully');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to update campaign');
    } finally {
      setSaving(false);
    }
  };

  const toggleSeniority = (id: string) =>
    setEditSeniorities(arr => arr.map(s => s.id === id ? { ...s, selected: !s.selected } : s));

  // Re-run Apollo discovery with the campaign's current (saved) ICP. New matches
  // are merged in; nothing already discovered/enriched/contacted is removed.
  const rerunDiscovery = async () => {
    if (rediscovering || !run) return;
    setRediscovering(true);
    try {
      const r = await rediscoverProspects(runId);
      setToast(r.message || 'Prospect search started.');
      const d = await fetchRun(runId);
      setRun(d.run);
      // Refresh whichever list is on screen so new matches show as they land.
      if (tab === 'prospects') loadProspects(); else loadCompanies();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to start prospect search');
    } finally {
      setRediscovering(false);
    }
  };

  const namesFor = (ids: string[]) =>
    ids.map(id => {
      const match = activeUsers.find(u => u.id === id);
      return match ? (match.full_name || match.email) : id;
    }).join(', ');
  const getOwnerNames = () => {
    const ids = run?.owners || [];
    return ids.length === 0 ? 'None' : namesFor(ids);
  };
  const getCollaboratorNames = () => {
    const ids = run?.collaborators || [];
    return ids.length === 0 ? 'None' : namesFor(ids);
  };

  const [companies, setCompanies] = React.useState<LeadFunnelCompany[]>([]);
  const [cPage, setCPage] = React.useState(1);
  const [cTotal, setCTotal] = React.useState(0);
  const [cPages, setCPages] = React.useState(1);
  const [cLoading, setCLoading] = React.useState(false);

  const [prospects, setProspects] = React.useState<LeadFunnelProspect[]>([]);
  const [pPage, setPPage] = React.useState(1);
  const [pTotal, setPTotal] = React.useState(0);
  const [pPages, setPPages] = React.useState(1);
  const [pLoading, setPLoading] = React.useState(false);

  const [rowsPerPage, setRowsPerPage] = React.useState(DEFAULT_ROWS_PER_PAGE);
  const [companyFilter, setCompanyFilter] = React.useState<string | undefined>(undefined);

  // Search box. `searchInput` is bound to the field; `search` is the debounced
  // value sent to the backend — it matches company name / domain on the
  // Companies tab and prospect name / title / email / company on the Prospects
  // tab, across every page. Page resets to 1 whenever the term changes.
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setCPage(1); setPPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [selProspects, setSelProspects] = React.useState<Set<string>>(new Set());
  const [sending, setSending] = React.useState(false);
  // Prospect ids whose outreach was just triggered and is still in-flight — used to
  // render a transient "Sending…" status until the backend marks them contacted.
  const [sendingIds, setSendingIds] = React.useState<Set<string>>(new Set());
  // Drives table polling while an outreach batch is being processed one-by-one.
  const [outreachActive, setOutreachActive] = React.useState(false);
  const [enriching, setEnriching] = React.useState(false);
  // Account Intel: `starting` is the POST round-trip only; `active` drives the
  // long poll while the backend works through the queue (minutes to hours).
  const [intelStarting, setIntelStarting] = React.useState(false);
  const [intelActive, setIntelActive] = React.useState(false);
  const [intel, setIntel] = React.useState<AccountIntelProgress | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  // panels
  const [prospectsPanel, setProspectsPanel] = React.useState<string | null>(null);
  const [statusPanel, setStatusPanel] = React.useState(false);
  const [companyPopup, setCompanyPopup] = React.useState<{ name: string; linkedin: string } | null>(null);
  const [personPopup, setPersonPopup] = React.useState<{ id: string; name: string; linkedin: string } | null>(null);

  // filters
  const [fSize, setFSize] = React.useState(''); const [fLoc, setFLoc] = React.useState(''); const [fSignal, setFSignal] = React.useState('');
  const [fStatus, setFStatus] = React.useState(''); const [fPLoc, setFPLoc] = React.useState(''); const [fLevel, setFLevel] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    fetchRun(runId).then(d => setRun(d.run)).catch(() => setRun(null)).finally(() => setLoading(false));
  }, [runId]);

  const loadCompanies = React.useCallback(() => {
    setCLoading(true);
    fetchCompanies(runId, cPage, rowsPerPage, search || undefined).then(d => { setCompanies(d.companies); setCTotal(d.total); setCPages(d.pages); }).finally(() => setCLoading(false));
  }, [runId, cPage, rowsPerPage, search]);
  const loadProspects = React.useCallback(() => {
    setPLoading(true);
    fetchProspects(runId, pPage, rowsPerPage, companyFilter, search || undefined).then(d => { setProspects(d.prospects); setPTotal(d.total); setPPages(d.pages); }).finally(() => setPLoading(false));
  }, [runId, pPage, rowsPerPage, companyFilter, search]);

  // Skip / un-skip an account. Skipping marks it "Skipped" here and pulls it out of
  // every My Tasks worklist; un-skipping restores it. Optimistically patch the row.
  const [skipping, setSkipping] = React.useState<string | null>(null);
  const toggleCompanySkip = React.useCallback(async (c: LeadFunnelCompany) => {
    const next = c.status === 'skipped' ? 'active' : 'skipped';
    setSkipping(c.companyName);
    try {
      await setCompanyStatus(runId, c.companyName, next);
      setCompanies(prev => prev.map(x => x.companyName === c.companyName ? { ...x, status: next } : x));
      setToast(next === 'skipped' ? `${c.companyName} skipped — hidden from My Tasks.` : `${c.companyName} restored to My Tasks.`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not update account status');
    } finally { setSkipping(null); }
  }, [runId]);

  React.useEffect(() => { if (tab === 'companies') loadCompanies(); }, [tab, loadCompanies]);
  React.useEffect(() => { if (tab === 'prospects') loadProspects(); }, [tab, loadProspects]);

  // While a prospect search / discovery is running, poll the run so the
  // "Searching…" state clears itself and the new matches load once the
  // background job finishes — no manual page refresh needed. Fires for both the
  // initial import discovery and a Settings "Re-run prospect search".
  React.useEffect(() => {
    if (run?.status !== 'running') return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const d = await fetchRun(runId);
        if (cancelled) return;
        setRun(d.run);
        if (d.run.status !== 'running') {
          // Transition running → done: refresh the visible list + notify.
          if (tab === 'prospects') loadProspects(); else loadCompanies();
          setToast(d.run.status === 'completed' ? 'Prospect search complete.' : `Search ${d.run.status}.`);
        }
      } catch { /* transient error — keep polling */ }
    }, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [run?.status, runId, tab, loadCompanies, loadProspects]);

  // While an outreach batch is being processed, poll the outreach logs and refresh
  // the visible table so the STATUS column moves Sending… → Contacted one prospect
  // at a time. Stops once the backend reports nothing left pending.
  //
  // The backend paces sends 3-4 minutes apart, so a batch legitimately runs for
  // (prospects × ~4 min). Two things follow: the poll must stay cheap over that
  // whole window (hence the back-off, and refreshing the table only when a status
  // actually moved), and it must not give up while the queue is still draining.
  const outreachTicks = React.useRef(0);
  React.useEffect(() => {
    if (!outreachActive) return;
    outreachTicks.current = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();
    const GIVE_UP_MS = 60 * 60 * 1000;
    let lastSignature = '';

    const tick = async () => {
      outreachTicks.current += 1;
      try {
        const logs = await fetchOutreachLogs(runId);
        if (cancelled) return;
        const { pending, sent, failed, skipped } = logs.summary;
        // Refresh the visible list only when something actually resolved — the
        // paced loop leaves the summary unchanged for minutes at a time, and a
        // table reload on every tick was flooding the connection pool.
        const signature = `${pending}/${sent}/${failed}/${skipped}`;
        if (signature !== lastSignature) {
          lastSignature = signature;
          if (tab === 'prospects') loadProspects(); else loadCompanies();
        }
        // Done when the queue has drained (after a couple of ticks so the backend
        // has had time to seed the pending rows), with a long wall-clock backstop.
        if ((pending === 0 && outreachTicks.current >= 3) || Date.now() - startedAt > GIVE_UP_MS) {
          setOutreachActive(false);
          setSendingIds(new Set());
          return;
        }
      } catch { /* transient — keep polling */ }
      if (!cancelled) {
        // Tight while the first sends land, then back off — nothing moves between
        // paced sends, so a 2.5s poll for the whole batch is pure waste.
        timer = setTimeout(tick, outreachTicks.current <= 8 ? 2500 : 15000);
      }
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [outreachActive, runId, tab, loadCompanies, loadProspects]);

  // Auto-sync the Account Category column while a batch is running. Deep research
  // is minutes per company, so this polls slowly and only reloads the table when
  // a company actually resolved — a tight poll here would stack requests exactly
  // like the outreach panel used to.
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let lastSignature = '';
    let ticks = 0;

    const tick = async () => {
      ticks += 1;
      try {
        const p = await fetchAccountIntelProgress(runId);
        if (cancelled) return;
        setIntel(p);
        const { queued, running, complete, failed } = p.summary;
        const signature = `${queued}/${running}/${complete}/${failed}`;
        if (signature !== lastSignature) {
          lastSignature = signature;
          // A company finished → its aiSignal is now written; refresh the table.
          if (ticks > 1) loadCompanies();
        }
        if (!p.active) { setIntelActive(false); return; }
      } catch { /* transient — keep polling */ }
      if (!cancelled) timer = setTimeout(tick, ticks <= 3 ? 4000 : 15000);
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
    // Re-arms on mount too, so reopening the page during a long batch resumes
    // the live view instead of looking idle.
  }, [intelActive, runId, loadCompanies]);

  const fcompanies = companies.filter(c =>
    (!fSize || sizeLabel(c.companySize) === fSize) &&
    (!fLoc || locStr(c) === fLoc) &&
    (!fSignal || (c.aiSignal?.signal || '') === fSignal));
  const fprospects = prospects.filter(p =>
    (!fStatus || (isProspectContacted(p) ? 'Contacted' : 'Pending') === fStatus) &&
    (!fPLoc || (p.prospectDetails?.location || '') === fPLoc) &&
    (!fLevel || mgmtLevel(p.title) === fLevel));

  const toggleP = (id: string) => setSelProspects(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllP = () => setSelProspects(s => s.size === fprospects.length ? new Set() : new Set(fprospects.map(p => p._id)));
  // Generic multi-id toggle, shared with ImportProspectsPanel so selections made
  // inside a single company's slide-over accumulate into the SAME set used by
  // the "Companies"/"Prospects" tab checkboxes — selecting one prospect from
  // company A, then opening company B's panel and selecting another, builds up
  // one combined selection you can send in a single outreach call.
  const toggleIds = (ids: string[], on: boolean) => setSelProspects(s => { const n = new Set(s); ids.forEach(id => on ? n.add(id) : n.delete(id)); return n; });
  const toggleCompany = (c: LeadFunnelCompany, on: boolean) => toggleIds(c.prospectIds, on);
  const companySelected = (c: LeadFunnelCompany) => c.prospectIds.length > 0 && c.prospectIds.every(id => selProspects.has(id));

  // Sends the current global selection (across every company the user has
  // picked prospects from, whether via the table checkboxes or any of the
  // per-company panels). Returns whether the send actually went out, so a
  // caller (e.g. the panel) can decide whether to close itself.
  const sendSelected = async (
    templateId?: string | null,
    overrides?: Record<string, { subject?: string; body?: string }> | null,
  ): Promise<boolean> => {
    if (selProspects.size === 0) return false;
    const ids = Array.from(selProspects);
    setSending(true);
    let ok = false;
    try {
      console.log(`[send-email] POST run=${runId}`, { prospectIds: ids, count: ids.length, templateId });
      const r = await sendOutreach(runId, ids, templateId ?? undefined, overrides ?? undefined);
      console.log('[send-email] response', r);
      setToast(r.message || `Outreach queued for ${r.total} prospects`);
      setSelProspects(new Set());
      // Optimistically flag these rows as "Sending…" and kick off live polling so
      // the STATUS column + Outreach Status panel update as the pipeline processes
      // prospects one-by-one (pending → sent), without a manual refresh.
      setSendingIds(new Set(ids));
      setOutreachActive(true);
      ok = true;
    } catch (e) { setToast(e instanceof Error ? e.message : 'Failed'); }
    finally { setSending(false); }
    return ok;
  };

  const enrichBulk = async () => {
    if (selProspects.size === 0) return;
    setEnriching(true);
    try {
      const r = await enrichProspectEmails(runId, Array.from(selProspects));
      setToast(r.message || `Revealed ${r.enriched} of ${r.total} email${r.total === 1 ? '' : 's'}`);
      // Refresh so revealed emails appear and prospects become sendable.
      if (tab === 'prospects') loadProspects(); else loadCompanies();
    }
    catch (e) { setToast(e instanceof Error ? e.message : 'Enrichment failed'); }
    finally { setEnriching(false); }
  };

  // Companies whose prospects are all selected — Account Intel is per-company,
  // while the checkboxes track prospect ids.
  const selectedCompanies = fcompanies.filter(companySelected);

  // companyName → live batch state, so each row can show its own progress.
  const intelByCompany = new Map((intel?.items ?? []).map(i => [i.companyName, i.status]));
  const intelErrors = new Map((intel?.items ?? []).filter(i => i.error).map(i => [i.companyName, i.error]));

  const runAccountIntel = async () => {
    if (selectedCompanies.length === 0 || intelStarting) return;
    setIntelStarting(true);
    try {
      const r = await startAccountIntel(runId, selectedCompanies.map(c => c.companyName));
      const parts = [`Researching ${r.queued} compan${r.queued === 1 ? 'y' : 'ies'} in the background`];
      if (r.skipped.length) parts.push(`${r.skipped.length} skipped (no LinkedIn URL)`);
      if (r.queued === 0 && !r.skipped.length) parts[0] = 'Already queued — nothing new to add';
      setToast(parts.join(' · '));
      setIntelActive(true);
    }
    catch (e) { setToast(e instanceof Error ? e.message : 'Could not start Account Intel'); }
    finally { setIntelStarting(false); }
  };

  if (loading) return <Center>Loading run…</Center>;
  if (!run) return <Center>Run not found. <button onClick={() => router.push('/dashboard')} style={{ marginLeft: 8, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer' }}>Back</button></Center>;

  const [rbg, rc] = RUN_STATUS[run.status] ?? ['var(--color-surface)', 'var(--color-text-2)'];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <button onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', fontSize: '12.5px', color: 'var(--color-text-2)', cursor: 'pointer', padding: 0, marginBottom: '8px', fontFamily: 'var(--font-sans)' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>{run.runName}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'capitalize', background: rbg, color: rc, padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>{run.status}</span>
          {run.importType === 'companies' && (
            <span style={{ fontSize: '11px', fontWeight: 700, background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>🏢 Company Import</span>
          )}
          <span style={{ fontSize: '12.5px', color: 'var(--color-text-3)' }}>· {run.industry}</span>
        </div>
      </div>

      {/* ── Inner split ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <nav style={{
          width: `${INNER_EXPANDED}px`, minWidth: `${INNER_EXPANDED}px`,
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-bg)', overflowY: 'auto', overflowX: 'hidden',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          <div style={{ padding: '14px 0 16px' }}>
            {NAV.map(item => {
              const active = activePage === item.id;
              return (
                <div key={item.id} onClick={() => setActivePage(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '7px 14px', margin: '1px 8px',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    fontSize: '13.5px', fontWeight: active ? 600 : 500,
                    color: active ? 'var(--color-brand)' : 'var(--color-text-1)',
                    background: active ? 'var(--color-brand-tint)' : 'transparent',
                    transition: 'background .12s, color .12s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--color-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ color: active ? 'var(--color-brand)' : 'var(--color-text-2)', display: 'flex' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </div>
              );
            })}
          </div>
        </nav>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-row-hover)' }}>
          {activePage === 'overview' && <ImportOverview run={run} />}

          {activePage === 'workflow' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg)' }}>
              <style>{`@keyframes outreach-spin{to{transform:rotate(360deg)}}.outreach-spinner{animation:outreach-spin .7s linear infinite;}`}</style>
              {/* Tabs + actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '4px', padding: '3px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                  {(['companies', 'prospects'] as Tab[])
                    .map(t => (
                      <button key={t} onClick={() => { setTab(t); if (t === 'companies') setCompanyFilter(undefined); }} style={{
                        padding: '6px 14px', fontSize: '12.5px', fontWeight: 600, textTransform: 'capitalize', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        background: tab === t ? 'var(--color-bg)' : 'transparent', color: tab === t ? 'var(--color-brand-text)' : 'var(--color-text-2)', boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
                      }}>{t}</button>
                    ))}
                  {tab === 'prospects' && companyFilter && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginLeft: '6px', fontSize: '11px', fontWeight: 600, background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)', padding: '4px 9px', borderRadius: 'var(--radius-full)' }}>
                      {companyFilter}<span onClick={() => { setCompanyFilter(undefined); setPPage(1); }} style={{ cursor: 'pointer' }}>×</span>
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={enrichBulk} disabled={enriching || selProspects.size === 0} title="Reveal emails for the selected prospects via Apollo (uses credits)" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'var(--color-bg)', border: `1px solid ${selProspects.size ? 'var(--color-brand)' : 'var(--color-border-2)'}`, color: selProspects.size ? 'var(--color-brand-text)' : 'var(--color-text-3)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700, cursor: selProspects.size && !enriching ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
                    {enriching ? 'Enriching…' : `Enrich Emails${selProspects.size ? ` (${selProspects.size})` : ''}`}
                  </button>
                  {tab === 'companies' && (
                    <button
                      onClick={runAccountIntel}
                      disabled={intelStarting || selectedCompanies.length === 0}
                      title="Run deep account research on the selected companies in the background. Sets their Account Category when done."
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'var(--color-bg)', border: `1px solid ${selectedCompanies.length ? 'var(--color-brand)' : 'var(--color-border-2)'}`, color: selectedCompanies.length ? 'var(--color-brand-text)' : 'var(--color-text-3)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700, cursor: selectedCompanies.length && !intelStarting ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}
                    >
                      {intelActive && intel && (intel.summary.queued + intel.summary.running) > 0 && (
                        <span className="outreach-spinner" style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--color-brand)', borderTopColor: 'transparent', display: 'inline-block', flexShrink: 0 }} />
                      )}
                      {intelActive && intel && (intel.summary.queued + intel.summary.running) > 0
                        ? `Researching ${intel.summary.complete + intel.summary.failed}/${intel.items.length}`
                        : `Account Intel${selectedCompanies.length ? ` (${selectedCompanies.length})` : ''}`}
                    </button>
                  )}
                  <button onClick={() => sendSelected()} disabled={sending || selProspects.size === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: selProspects.size ? 'var(--color-brand)' : 'var(--color-border-2)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700, cursor: selProspects.size ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
                    {sending ? 'Sending…' : `Trigger Outreach${selProspects.size ? ` (${selProspects.size})` : ''}`}
                  </button>
                  <button onClick={() => setStatusPanel(true)} style={{ padding: '7px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Outreach Status</button>
                  <span style={{ fontSize: '12.5px', color: 'var(--color-text-3)' }}>
                    <strong style={{ color: 'var(--color-text-1)' }}>{tab === 'companies' ? fcompanies.length : fprospects.length}</strong> of <strong style={{ color: 'var(--color-text-1)' }}>{tab === 'companies' ? cTotal : pTotal}</strong>
                  </span>
                </div>
              </div>

              {/* Filters + Pagination (inline) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, flexWrap: 'wrap' }}>
                {/* Search — server-side, spans every page. Companies tab matches
                    company name/domain; Prospects tab matches name/title/email/company. */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '240px' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '9px', pointerEvents: 'none' }}>
                    <circle cx="7" cy="7" r="4.5" /><line x1="14" y1="14" x2="10.5" y2="10.5" />
                  </svg>
                  <input
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    placeholder={tab === 'companies' ? 'Search company' : 'Search people or company'}
                    style={{
                      width: '100%', height: '28px', padding: '0 26px 0 28px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-2)',
                      background: 'var(--color-bg)', color: 'var(--color-text-1)',
                      fontSize: '11.5px', fontFamily: 'var(--font-sans)', outline: 'none',
                    }}
                  />
                  {searchInput && (
                    <button onClick={() => setSearchInput('')} title="Clear search" style={{
                      position: 'absolute', right: '7px', display: 'flex', alignItems: 'center',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 0,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="3" y1="3" x2="11" y2="11" /><line x1="11" y1="3" x2="3" y2="11" /></svg>
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Filter</span>
                {tab === 'companies' ? (
                  <>
                    <Sel value={fSize} onChange={setFSize} ph="Size" opts={['Small (1–50)', 'Medium (51–200)', 'Large (200+)']} />
                    <Sel value={fLoc} onChange={setFLoc} ph="Location" opts={Array.from(new Set(companies.map(locStr).filter(Boolean))).sort()} />
                    <Sel value={fSignal} onChange={setFSignal} ph="Account Category" opts={['green', 'yellow', 'orange', 'red']} labels={SIGNAL_LABEL} />
                    {(fSize || fLoc || fSignal) && (
                      <ResetBtn onClick={() => { setFSize(''); setFLoc(''); setFSignal(''); }} />
                    )}
                  </>
                ) : (
                  <>
                    <Sel value={fStatus} onChange={setFStatus} ph="Status" opts={['Contacted', 'Pending']} />
                    <Sel value={fPLoc} onChange={setFPLoc} ph="Location" opts={Array.from(new Set(prospects.map(p => p.prospectDetails?.location || '').filter(Boolean))).sort()} />
                    <Sel value={fLevel} onChange={setFLevel} ph="Level" opts={['C-Suite', 'VP', 'Head', 'Director', 'Other']} />
                    {(fStatus || fPLoc || fLevel) && (
                      <ResetBtn onClick={() => { setFStatus(''); setFPLoc(''); setFLevel(''); }} />
                    )}
                  </>
                )}

                {/* ── Pagination controls (moved from footer) ── */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>Rows</span>
                    <select
                      value={rowsPerPage}
                      onChange={e => { setRowsPerPage(parseInt(e.target.value)); setCPage(1); setPPage(1); }}
                      style={{
                        height: '28px', padding: '0 6px', borderRadius: 'var(--radius-sm)',
                        fontSize: '11.5px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none',
                        border: '1px solid var(--color-border-2)', background: 'var(--color-bg)', color: 'var(--color-text-1)',
                      }}
                    >
                      {ROWS_PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  {tab === 'companies'
                    ? <PagerInline page={cPage} pages={cPages} onPrev={() => setCPage(p => Math.max(1, p - 1))} onNext={() => setCPage(p => p + 1)} />
                    : <PagerInline page={pPage} pages={pPages} onPrev={() => setPPage(p => Math.max(1, p - 1))} onNext={() => setPPage(p => p + 1)} />
                  }
                </div>
              </div>

              {/* Tables */}
              <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {tab === 'companies' ? (
                  cLoading && companies.length === 0 ? <Center>Loading companies…</Center>
                  : fcompanies.length === 0 ? <Center>No companies. Import prospects to see companies here.</Center>
                  : <>
                    <table style={tableStyle}>
                      <thead><tr style={trHead}>
                        <Th w="42px"><Check checked={fcompanies.length > 0 && fcompanies.every(companySelected)} onChange={() => { const all = fcompanies.every(companySelected); fcompanies.forEach(c => toggleCompany(c, !all)); }} /></Th>
                        <Th>Company</Th><Th w="80px" center>LinkedIn</Th><Th w="120px">Size</Th><Th>Location</Th><Th w="110px">Status</Th><Th w="150px">Account Category</Th><Th w="200px" right>Actions</Th>
                      </tr></thead>
                      <tbody>
                        {fcompanies.map(c => {
                          const sig = c.aiSignal?.signal ? SIGNAL_BADGE[c.aiSignal.signal] : null;
                          const intelState = intelByCompany.get(c.companyName);
                          return (
                            <tr key={c._id} {...rowHover(companySelected(c))}>
                              <Td><Check checked={companySelected(c)} onChange={() => toggleCompany(c, !companySelected(c))} /></Td>
                              <Td><span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)' }}>{c.companyDomain ? <a href={c.companyDomain.startsWith('http') ? c.companyDomain : `https://${c.companyDomain}`} target="_blank" rel="noopener noreferrer" style={linkS}>{c.companyName}</a> : (c.companyName || 'Unknown')}</span></Td>
                              <Td center>{c.companyLinkedin ? <a href={c.companyLinkedin} target="_blank" rel="noopener noreferrer" style={{ color: '#0077B5', textDecoration: 'none', fontWeight: 700 }}>in</a> : <span style={{ color: 'var(--color-text-3)' }}>—</span>}</Td>
                              <Td><span style={muted}>{c.companySize || '—'}</span></Td>
                              <Td><span style={chip} title={locStr(c)}>{locStr(c) || '—'}</span></Td>
                              <Td>{c.status === 'skipped'
                                ? <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-3)' }}>Skipped</span>
                                : c.status === 'contacted'
                                ? <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-success-text)' }}>Contacted</span>
                                : c.prospectIds.some(id => sendingIds.has(id))
                                  ? <SendingBadge />
                                  : <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-warning-text)' }}>Active</span>}</Td>
                              {/* Live batch state wins over a stale value: while a company is
                                  being researched the old category is misleading, and "—" is
                                  indistinguishable from "never ran". */}
                              <Td>{intelState === 'running' ? <IntelBadge label="Researching…" spin />
                                : intelState === 'queued' ? <IntelBadge label="Queued" />
                                : sig ? <span title={c.aiSignal?.summary || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 700, background: sig[0], color: sig[1], padding: '3px 9px', borderRadius: 'var(--radius-full)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: sig[2] }} />{SIGNAL_NAME[c.aiSignal?.signal ?? ''] || c.aiSignal?.label || c.aiSignal?.signal}</span>
                                : intelState === 'failed' ? <span title={intelErrors.get(c.companyName) || 'Research failed'} style={{ color: 'var(--color-danger-text)', fontSize: '11px', fontWeight: 600 }}>Failed</span>
                                : <span style={{ color: 'var(--color-text-3)', fontSize: '11px' }}>—</span>}</Td>
                              <Td right>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                  <button onClick={() => toggleCompanySkip(c)} disabled={skipping === c.companyName} style={ghostBtn}
                                    title={c.status === 'skipped' ? 'Restore this account to My Tasks' : 'Skip this account (hide from My Tasks)'}>
                                    {skipping === c.companyName ? '…' : c.status === 'skipped' ? 'Un-skip' : 'Skip'}</button>
                                  <button onClick={() => setCompanyPopup({ name: c.companyName, linkedin: c.companyLinkedin || '' })} style={ghostBtn}>Details</button>
                                  <button onClick={() => setProspectsPanel(c.companyName)} style={solidBtn}>{c.prospectCount} Prospects</button>
                                </div>
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                  </>
                ) : (
                  pLoading && prospects.length === 0 ? <Center>Loading prospects…</Center>
                  : fprospects.length === 0 ? <Center>No prospects found.</Center>
                  : <>
                    <table style={tableStyle}>
                      <thead><tr style={trHead}>
                        <Th w="42px"><Check checked={fprospects.length > 0 && selProspects.size >= fprospects.length && fprospects.every(p => selProspects.has(p._id))} onChange={toggleAllP} /></Th>
                        <Th>Prospect</Th><Th>Company</Th><Th>Title</Th><Th>Location</Th><Th w="100px">Email</Th><Th w="100px" center>LinkedIn</Th><Th w="170px" right>Action</Th>
                      </tr></thead>
                      <tbody>
                        {fprospects.map(p => (
                          <tr key={p._id} {...rowHover(selProspects.has(p._id))}>
                            <Td><Check checked={selProspects.has(p._id)} onChange={() => toggleP(p._id)} /></Td>
                            <Td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')}</div>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)' }}>{p.prospectDetails?.linkedinUrl ? <a href={p.prospectDetails.linkedinUrl} target="_blank" rel="noopener noreferrer" style={linkS}>{p.firstName} {p.lastName}</a> : `${p.firstName} ${p.lastName}`}</span>
                              </div>
                            </Td>
                            <Td><span style={{ fontSize: '12.5px', color: 'var(--color-text-1)' }}>{p.companyLinkedin ? <a href={p.companyLinkedin} target="_blank" rel="noopener noreferrer" style={linkS}>{p.companyName || '—'}</a> : (p.companyName || '—')}</span></Td>
                            <Td><span style={muted} title={p.title}>{p.title || '—'}</span></Td>
                            <Td><span style={chip} title={p.prospectDetails?.location || ''}>{p.prospectDetails?.location || '—'}</span></Td>
                            <Td>{isProspectContacted(p)
                              ? <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success-text)' }}>Contacted</span>
                              : sendingIds.has(p._id)
                                ? <SendingBadge />
                                : <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-warning-text)' }}>Active</span>}</Td>
                            <Td center><LiStatusChip status={p.prospectDetails?.linkedin?.status} /></Td>
                            <Td right>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                <button onClick={() => setProspectsPanel(p.companyName || '')} style={ghostBtn}>Outreach</button>
                              </div>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          )}

          {activePage === 'settings' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>Settings</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '2px' }}>Campaign configuration and lifecycle.</div>
                </div>
                <div>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setIsEditing(false)} disabled={saving} style={{ ...pagerBtn, width: 'auto', height: 'auto', padding: '6px 14px', fontSize: '12.5px', fontWeight: 700 }}>Cancel</button>
                      <button onClick={saveEdit} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{saving ? 'Saving…' : 'Save Changes'}</button>
                    </div>
                  ) : (
                    <button onClick={startEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'var(--color-bg)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Edit Details</button>
                  )}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '14px' }}>Status</div>
                <FieldRow label="Campaign status" hint="Active campaigns feed My Tasks. Pausing hides this campaign's companies from every My Tasks tab (they return when reactivated).">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: isActive ? 'var(--color-success-text)' : 'var(--color-text-3)' }}>
                      {savingStatus ? 'Saving…' : isActive ? 'Active' : 'Paused'}
                    </span>
                    <button type="button" role="switch" aria-checked={isActive} onClick={toggleStatus} disabled={savingStatus || !run.campaignId}
                      title={isActive ? 'Click to pause (removes from My Tasks)' : 'Click to activate'}
                      style={{ width: 42, height: 24, borderRadius: 999, border: 'none', padding: 0, position: 'relative', flexShrink: 0,
                        background: isActive ? 'var(--color-brand)' : 'var(--color-border-2)', cursor: savingStatus ? 'not-allowed' : 'pointer', opacity: savingStatus ? 0.6 : 1, transition: 'background .15s' }}>
                      <span style={{ position: 'absolute', top: 3, left: isActive ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
                    </button>
                  </div>
                </FieldRow>
              </div>

              {/* Everything the daily automation does, in one place: whether it sends,
                  when it runs, which account it sends LinkedIn from, and which days
                  each channel is actually scheduled for. These were spread across
                  three cards, so "what will happen tonight?" could not be answered
                  without reading all of them. Owners and collaborators can both edit. */}
              <div style={{ ...cardStyle, marginTop: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>Automation</div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginBottom: '14px', maxWidth: 560, lineHeight: 1.45 }}>
                  Each campaign runs on its own clock. At the time below this campaign
                  does its daily run — first contact (if enabled), then the My Tasks
                  refresh, then the LinkedIn invite worklist — and its work-day rolls over.
                </div>
                <FieldRow label="Fully automated first contact" hint="When on, this campaign's daily first-contact worklist is sent automatically — emails always, plus LinkedIn invites for members who've connected LinkedIn (email-only otherwise). Off means the worklist is still prepared for you, but nothing is sent. Default off.">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: autoFC ? 'var(--color-success-text)' : 'var(--color-text-3)' }}>
                      {savingAutoFC ? 'Saving…' : autoFC ? 'On' : 'Off'}
                    </span>
                    <button type="button" role="switch" aria-checked={autoFC} onClick={toggleAutoFC} disabled={savingAutoFC || !run.campaignId}
                      title={autoFC ? 'Click to turn off automated first contact' : 'Click to automate first contact daily'}
                      style={{ width: 42, height: 24, borderRadius: 999, border: 'none', padding: 0, position: 'relative', flexShrink: 0,
                        background: autoFC ? 'var(--color-brand)' : 'var(--color-border-2)', cursor: (savingAutoFC || !run.campaignId) ? 'not-allowed' : 'pointer', opacity: (savingAutoFC || !run.campaignId) ? 0.6 : 1, transition: 'background .15s' }}>
                      <span style={{ position: 'absolute', top: 3, left: autoFC ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
                    </button>
                  </div>
                </FieldRow>
                <FieldRow label="Runs at" hint="Local to the zone you pick, so it stays put across daylight saving — only the UTC instant moves. This also sets when the campaign's work-day rolls over.">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', width: '100%' }}>
                    <AutomationSchedule
                      timezone={isEditing ? editSchedule.timezone : schedule.timezone}
                      time={isEditing ? editSchedule.time : schedule.time}
                      plan={run.weeklyPlan}
                      editable={isEditing && !!run.campaignId && !scheduleLocked}
                      saving={saving}
                      onChange={setEditSchedule}
                    />
                    {/* Say why it is frozen even when not in edit mode — otherwise
                        "Edit Details" appears to work and only this one field is
                        silently inert. */}
                    {scheduleLocked && (
                      <span style={{ fontSize: '11.5px', color: 'var(--color-warning-text, #b45309)', textAlign: 'right', lineHeight: 1.45, maxWidth: '46ch' }}>
                        {scheduleLock?.reason === 'run_in_progress'
                          ? 'Locked — today’s run is still going. '
                          : 'Locked — this campaign runs soon. '}
                        {lockOpensLabel
                          ? `You can change the time again after ${lockOpensLabel}.`
                          : 'You can change the time again once the run finishes.'}
                      </span>
                    )}
                  </div>
                </FieldRow>
                <FieldRow label="Which days" hint="Taken from the Weekly Plan below. A channel with a goal of 0 on a day is not run that day; a day with 0 on every channel is skipped entirely and the board is left untouched.">
                  <span style={{ fontSize: '12.5px', color: 'var(--color-text-2)', textAlign: 'right' }}>
                    Set in Weekly Plan
                  </span>
                </FieldRow>
                {/* End-to-end proof: this campaign's own mailbox and pinned template,
                    the same Graph call a prospect's email takes. Worth doing before
                    turning automation on, because that is the first send nobody
                    watches. */}
                <FieldRow label="Send a test email" hint="Uses this campaign's sender mailbox and its pinned template. You supply the placeholder values and where to send it. No prospect is contacted and the daily send budget is untouched.">
                  <button onClick={() => setTestingCampaign(true)} disabled={!run.campaignId}
                    style={{ padding: '7px 16px', background: 'var(--color-bg)', color: 'var(--color-text-1)',
                      border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)',
                      fontSize: '13px', fontWeight: 600, cursor: run.campaignId ? 'pointer' : 'not-allowed',
                      opacity: run.campaignId ? 1 : 0.6, fontFamily: 'var(--font-sans)' }}>
                    Send test email
                  </button>
                </FieldRow>
              </div>

              <div style={{ ...cardStyle, marginTop: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '14px' }}>Campaign Details</div>
                {isEditing ? (
                  <>
                    <FieldRow label="Campaign Name">
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} />
                    </FieldRow>
                    <FieldRow label="Target Industry">
                      <input type="text" value={editIndustry} onChange={e => setEditIndustry(e.target.value)} style={inputStyle} />
                    </FieldRow>
                    <FieldRow label="Email Sender">
                      <select value={editSenderEmail} onChange={e => {
                        const val = e.target.value;
                        setEditSenderEmail(val);
                        const match = emailSenders.find(s => s.email === val);
                        if (match) setEditSenderEngine(match.engine);
                      }} style={selectStyle}>
                        <option value="">Select a sender email...</option>
                        {emailSenders.map(s => (
                          <option key={s.id} value={s.email}>{s.email} ({s.name || s.engine})</option>
                        ))}
                      </select>
                    </FieldRow>
                    <FieldRow label="Forward Replies To" hint="When a prospect replies, a copy is forwarded (in the same thread, from this campaign's sending mailbox) to this address so you see it in your own inbox. Leave empty to turn forwarding off. This is a notification copy — replying to it does NOT reach the prospect.">
                      <input
                        type="email"
                        value={editForwardEmail}
                        onChange={e => setEditForwardEmail(e.target.value)}
                        placeholder="e.g. you@company.com — empty = off"
                        style={inputStyle}
                      />
                    </FieldRow>
                    <FieldRow label="CC on Every Email" hint="Addresses added as CC on every outreach email this campaign sends. Type an address and press Enter or comma to add; click × to remove. Leave empty for no CC.">
                      <div style={{ width: '100%', maxWidth: '300px' }}>
                        <TagChipInput
                          tags={editCcEmails}
                          onAdd={t => setEditCcEmails(p => [...p, t])}
                          onRemove={t => setEditCcEmails(p => p.filter(x => x !== t))}
                          placeholder="e.g. team@company.com"
                        />
                      </div>
                    </FieldRow>
                    <FieldRow label="Owners" hint="Who runs this campaign — they get My Tasks, Weekly Goals and automated first contact. Several owners share one worklist and one daily send budget, so adding an owner spreads the work rather than doubling what the campaign sends. At least one is required.">
                      <div style={{ width: '100%', maxWidth: '300px' }}>
                        <MultiSelectDropdown
                          options={activeUsers.map(u => ({ id: u.id, name: u.full_name || u.email, selected: editOwners.includes(u.id) }))}
                          onToggle={id => {
                            setEditOwners(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                            // An owner can't also be a collaborator.
                            setEditCollaborators(prev => prev.filter(x => x !== id));
                          }}
                          placeholder="Add owners…"
                          searchPlaceholder="Search users"
                        />
                      </div>
                    </FieldRow>
                    <FieldRow label="Collaborators" hint="Can view the campaign and manage its settings, and send manually — but get NO My Tasks, Weekly Goals or automation.">
                      <div style={{ width: '100%', maxWidth: '300px' }}>
                        <MultiSelectDropdown
                          options={activeUsers.filter(u => !editOwners.includes(u.id)).map(u => ({ id: u.id, name: u.full_name || u.email, selected: editCollaborators.includes(u.id) }))}
                          onToggle={id => setEditCollaborators(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                          placeholder="Add collaborators…"
                          searchPlaceholder="Search users"
                        />
                      </div>
                    </FieldRow>
                    <FieldRow label="Default Templates" hint="Outreach templates offered when contacting prospects. Leave empty to offer all your templates.">
                      <div style={{ width: '100%', maxWidth: '300px' }}>
                        <MultiSelectDropdown
                          options={templates.map(t => ({ id: t._id, name: t.name || `${t.industry} · ${t.persona}`, selected: editDefaultTemplateIds.includes(t._id) }))}
                          onToggle={id => setEditDefaultTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                          placeholder="All templates (no default)…"
                          searchPlaceholder="Search templates"
                        />
                      </div>
                    </FieldRow>
                    <FieldRow label="Default LinkedIn Invite Template" hint="Template used for automated LinkedIn invites and pre-filled invite notes. The first selected is the default.">
                      <div style={{ width: '100%', maxWidth: '300px' }}>
                        {linkedinTemplates.filter(t => t.category === 'invite' || !t.category).length === 0 ? (
                          <span style={{ fontSize: '12.5px', color: 'var(--color-text-3)' }}>No LinkedIn invite templates yet. Create one in the LinkedIn Composer.</span>
                        ) : (
                          <MultiSelectDropdown
                            options={linkedinTemplates.filter(t => t.category === 'invite' || !t.category).map(t => ({ id: t._id, name: t.name || 'Untitled template', selected: editDefaultLinkedinInviteTemplateIds.includes(t._id) }))}
                            onToggle={id => setEditDefaultLinkedinInviteTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                            placeholder="No campaign invite template…"
                            searchPlaceholder="Search invite templates"
                          />
                        )}
                      </div>
                    </FieldRow>
                    <FieldRow label="Default LinkedIn Follow-up Template" hint="Template pre-filled when messaging a prospect who accepted your invite. If none is set, write the message yourself in My Tasks.">
                      <div style={{ width: '100%', maxWidth: '300px' }}>
                        {linkedinTemplates.filter(t => t.category === 'follow-up').length === 0 ? (
                          <span style={{ fontSize: '12.5px', color: 'var(--color-text-3)' }}>No LinkedIn follow-up templates yet. Create one in the LinkedIn Composer.</span>
                        ) : (
                          <MultiSelectDropdown
                            options={linkedinTemplates.filter(t => t.category === 'follow-up').map(t => ({ id: t._id, name: t.name || 'Untitled template', selected: editDefaultLinkedinTemplateIds.includes(t._id) }))}
                            onToggle={id => setEditDefaultLinkedinTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                            placeholder="Use my newest LinkedIn template…"
                            searchPlaceholder="Search LinkedIn templates"
                          />
                        )}
                      </div>
                    </FieldRow>
                    <FieldRow label="LinkedIn Sender" hint="The connected LinkedIn account that sends this campaign's invites — manual and automated. You only see your own account unless you're an admin.">
                      <div style={{ width: '100%', maxWidth: '300px' }}>
                        {linkedinSenders.length === 0 ? (
                          <span style={{ fontSize: '12.5px', color: 'var(--color-text-3)' }}>No connected LinkedIn account. Connect one in Settings → Integrations.</span>
                        ) : (
                          <select value={editLinkedinSenderUserId} onChange={e => setEditLinkedinSenderUserId(e.target.value)} style={selectStyle}>
                            <option value="">Each sender&apos;s own account (default)</option>
                            {linkedinSenders.map(s => (
                              <option key={s.userId} value={s.userId}>{s.name}{s.email ? ` (${s.email})` : ''}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </FieldRow>
                  </>
                ) : (
                  <>
                    <FieldRow label="Campaign Name"><strong style={fieldValStyle}>{run.runName}</strong></FieldRow>
                    <FieldRow label="Target Industry"><strong style={fieldValStyle}>{run.industry}</strong></FieldRow>
                    <FieldRow label="Import Type"><strong style={fieldValStyle}>{run.importType === 'companies' ? 'Company List' : 'Prospects List'}</strong></FieldRow>
                    <FieldRow label="Created At"><strong style={fieldValStyle}>{fmtDateTime(run.createdAt)}</strong></FieldRow>
                    <FieldRow label="Email Sender"><strong style={fieldValStyle}>{run.senderEmail || 'None'}</strong></FieldRow>
                    <FieldRow label="Forward Replies To" hint="Prospect replies are notification-forwarded (in-thread, from the sending mailbox) to this address. Empty = off.">
                      <strong style={fieldValStyle}>{run.forwardToEmail || 'Not set'}</strong>
                    </FieldRow>
                    <FieldRow label="CC on Every Email" hint="Addresses CC'd on every outreach email this campaign sends. Empty = no CC.">
                      <strong style={fieldValStyle}>{run.ccEmails && run.ccEmails.length > 0 ? run.ccEmails.join(', ') : 'Not set'}</strong>
                    </FieldRow>
                    <FieldRow label="Owners" hint="Who runs this campaign (My Tasks, Weekly Goals, automation).">
                      <strong style={fieldValStyle}>{getOwnerNames()}</strong>
                    </FieldRow>
                    <FieldRow label="Collaborators" hint="Can view the campaign and send manually, but get no My Tasks, Weekly Goals or automation.">
                      <strong style={fieldValStyle}>{getCollaboratorNames()}</strong>
                    </FieldRow>
                    <FieldRow label="Default Templates" hint="Templates offered in the outreach panel. All templates are offered when none are set.">
                      <strong style={fieldValStyle}>
                        {run.defaultTemplateIds && run.defaultTemplateIds.length > 0
                          ? run.defaultTemplateIds.map(templateName).join(', ')
                          : 'All templates'}
                      </strong>
                    </FieldRow>
                    <FieldRow label="Default LinkedIn Invite Template" hint="Template used for automated LinkedIn invites and invite notes.">
                      <strong style={fieldValStyle}>{run.defaultLinkedinInviteTemplateIds?.length ? run.defaultLinkedinInviteTemplateIds.map(linkedinTemplateName).join(', ') : 'Not set'}</strong>
                    </FieldRow>
                    <FieldRow label="Default LinkedIn Follow-up Template" hint="Template pre-filled after a prospect accepts your invite.">
                      <strong style={fieldValStyle}>
                        {run.defaultLinkedinTemplateIds && run.defaultLinkedinTemplateIds.length > 0
                          ? run.defaultLinkedinTemplateIds.map(linkedinTemplateName).join(', ')
                          : 'Not set — write in My Tasks'}
                      </strong>
                    </FieldRow>
                  </>
                )}
              </div>

              {/* Weekly plan — same commitment shown on the Weekly Goals screen. */}
              {run.campaignId && (
                <div style={{ ...cardStyle, marginTop: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>Weekly Plan</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginBottom: '14px', maxWidth: 480, lineHeight: 1.45 }}>
                    Per-day commitment per channel. Editing Monday fills the week; change any single day to customise it. This drives My Tasks and the Weekly Goals screen.
                  </div>
                  <WeeklyPlanEditor initialPlan={run.weeklyPlan} onSave={saveWeeklyPlan} saving={savingPlan} />
                </div>
              )}

              {run.campaignId && (
                <div style={{ ...cardStyle, marginTop: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>ICP Selection Prompt</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginBottom: '10px', maxWidth: 480, lineHeight: 1.45 }}>The active prospect-selection instructions used by this import campaign.</div>
                  <FieldRow label="Active prompt" hint="Prompt versions are managed in Outreach Hub → ICP Selection.">
                    <ActivePromptSetting campaignId={run.campaignId} campaignName={run.runName} source="lead_funnel" />
                  </FieldRow>
                </div>
              )}

              {/* ICP Targeting & prospect search — company-import campaigns only */}
              {run.importType === 'companies' && (
                <div style={{ ...cardStyle, marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>ICP Targeting</div>
                      <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '2px', maxWidth: 460, lineHeight: 1.45 }}>
                        Criteria the agent uses to find prospects at each imported company via Apollo. Edit these, then re-run the search to pull new matches.
                      </div>
                    </div>
                    <button
                      onClick={rerunDiscovery}
                      disabled={rediscovering || isEditing || run.status === 'running'}
                      title={isEditing ? 'Save your ICP changes first' : run.status === 'running' ? 'A prospect search is already running' : 'Search Apollo again with the current ICP — new matches are added, existing prospects are kept'}
                      style={{
                        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                        background: (rediscovering || isEditing || run.status === 'running') ? 'var(--color-border-2)' : 'var(--color-brand)',
                        color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700,
                        cursor: (rediscovering || isEditing || run.status === 'running') ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
                      }}>
                      {rediscovering || run.status === 'running' ? 'Searching…' : '↻ Re-run prospect search'}
                    </button>
                  </div>

                  {isEditing ? (
                    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <div style={icpLabel}>Management level</div>
                        <MultiSelectDropdown options={editSeniorities} onToggle={toggleSeniority} placeholder="Select management levels…" searchPlaceholder="Search levels" />
                      </div>
                      <div>
                        <div style={icpLabel}>Include job titles</div>
                        <div style={icpHint}>Only pull people whose title matches one of these. Press Enter/comma to add.</div>
                        <TagChipInput tags={editTitles} onAdd={t => setEditTitles(p => [...p, t])} onRemove={t => setEditTitles(p => p.filter(x => x !== t))} placeholder="e.g. Head of Sales" />
                      </div>
                      <div>
                        <div style={icpLabel}>Exclude job titles</div>
                        <div style={icpHint}>Skip people whose title matches one of these. Press Enter/comma to add.</div>
                        <TagChipInput tags={editExcludeTitles} onAdd={t => setEditExcludeTitles(p => [...p, t])} onRemove={t => setEditExcludeTitles(p => p.filter(x => x !== t))} placeholder="e.g. Assistant, Intern" />
                      </div>
                      <div>
                        <div style={icpLabel}>Departments &amp; job function</div>
                        <div style={icpHint}>Filter by department. Press Enter/comma to add.</div>
                        <TagChipInput tags={editDepartments} onAdd={t => setEditDepartments(p => [...p, t])} onRemove={t => setEditDepartments(p => p.filter(x => x !== t))} placeholder="e.g. sales, marketing" />
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '10px' }}>
                      <FieldRow label="Management levels">
                        <strong style={fieldValStyle}>
                          {run.filters?.seniorities && run.filters.seniorities.length > 0
                            ? run.filters.seniorities.map((s: string) => ICP_LEVEL_LABELS[s] || s).join(', ')
                            : 'All (default)'}
                        </strong>
                      </FieldRow>
                      <FieldRow label="Include job titles">
                        <strong style={fieldValStyle}>{run.filters?.titles && run.filters.titles.length > 0 ? run.filters.titles.join(', ') : 'All'}</strong>
                      </FieldRow>
                      <FieldRow label="Exclude job titles">
                        <strong style={fieldValStyle}>{run.filters?.excludeTitles && run.filters.excludeTitles.length > 0 ? run.filters.excludeTitles.join(', ') : 'None'}</strong>
                      </FieldRow>
                      <FieldRow label="Departments">
                        <strong style={fieldValStyle}>{run.filters?.departments && run.filters.departments.length > 0 ? run.filters.departments.join(', ') : 'All'}</strong>
                      </FieldRow>
                    </div>
                  )}
                </div>
              )}

              <div style={{ ...cardStyle, marginTop: '12px', borderColor: 'var(--color-danger-border)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-danger-text)', marginBottom: '14px' }}>Danger zone</div>
                <FieldRow label="Delete campaign" hint="Permanently delete this campaign and all associated prospects, runs, and outreach logs.">
                  <button style={dangerBtnStyle} onClick={handleDelete} disabled={deletingCampaign}>{deletingCampaign ? 'Deleting…' : 'Delete'}</button>
                </FieldRow>
              </div>
            </div>
          )}
        </div>
      </div>

      {run?.campaignId && testingCampaign && (
        <TestTemplateDialog
          open
          title={`Test “${run.runName || 'campaign'}”`}
          senderEmail={run.senderEmail}
          loadInfo={() => fetchCampaignTestInfo(run.campaignId as string)}
          onSend={(values, recipient) => sendCampaignTest(run.campaignId as string, { recipient, values })}
          onClose={() => setTestingCampaign(false)}
        />
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />

      {prospectsPanel !== null && <ImportProspectsPanel
        open onClose={() => setProspectsPanel(null)} runId={runId} companyName={prospectsPanel} industrySlug={run.industrySlug}
        icp={run.filters} isCompanyImport={run.importType === 'companies'} defaultTemplateIds={run.defaultTemplateIds}
        selectedIds={selProspects} onToggle={toggleP} onToggleMany={toggleIds}
        sending={sending} onSend={sendSelected}
        onEnriched={() => { loadCompanies(); if (tab === 'prospects') loadProspects(); }}
      />}
      <ImportOutreachStatusPanel open={statusPanel} onClose={() => setStatusPanel(false)} runId={runId} runName={run.runName} />
      {companyPopup && <ImportCompanyDetailsPopup open onClose={() => setCompanyPopup(null)} companyName={companyPopup.name} companyLinkedin={companyPopup.linkedin} runId={runId} />}
      {personPopup && <ImportPersonDetailsPopup open onClose={() => setPersonPopup(null)} prospectId={personPopup.id} fullName={personPopup.name} linkedinUrl={personPopup.linkedin} runId={runId} />}
    </div>
  );
}

/* ── small helpers ── */
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const trHead: React.CSSProperties = { background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' };
const trBody: React.CSSProperties = { borderBottom: '1px solid var(--color-border)' };
// Row hover + selected highlight. Selected rows keep a persistent tint; hovering an
// unselected row shows a lighter tint. We mutate background directly on enter/leave to
// avoid per-row state and re-renders.
function rowHover(selected: boolean) {
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => { if (!selected) e.currentTarget.style.background = 'var(--color-hover)'; },
    onMouseLeave: (e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = selected ? 'var(--color-brand-subtle)' : ''; },
    style: { ...trBody, background: selected ? 'var(--color-brand-subtle)' : undefined, transition: 'background .12s' } as React.CSSProperties,
  };
}
const linkS: React.CSSProperties = { color: 'var(--color-brand)', textDecoration: 'none' };
const muted: React.CSSProperties = { fontSize: '12.5px', color: 'var(--color-text-2)', display: 'block', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const chip: React.CSSProperties = { display: 'inline-block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--color-hover)', color: 'var(--color-text-2)', fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--radius-sm)' };
const ghostBtn: React.CSSProperties = { padding: '5px 11px', background: 'var(--color-surface)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' };
const solidBtn: React.CSSProperties = { padding: '5px 11px', background: 'var(--color-brand)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' };

// Account Category placeholder while a company sits in the Account Intel queue.
// Deep research takes minutes, so the row has to say so rather than look empty.
function IntelBadge({ label, spin = false }: { label: string; spin?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 700, background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)', padding: '3px 9px', borderRadius: 'var(--radius-full)' }}>
      {spin
        ? <span className="outreach-spinner" style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid var(--color-brand)', borderTopColor: 'transparent', display: 'inline-block', flexShrink: 0 }} />
        : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-brand)', opacity: 0.5 }} />}
      {label}
    </span>
  );
}

// Transient status shown on a row whose outreach email is being sent (queued but
// not yet confirmed sent). Flips to "Contacted" once the backend reports it.
function SendingBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--color-brand-text)' }}>
      <span className="outreach-spinner" style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--color-brand)', borderTopColor: 'transparent', display: 'inline-block', flexShrink: 0 }} />
      Sending…
    </span>
  );
}

function Th({ children, w, center, right }: { children?: React.ReactNode; w?: string; center?: boolean; right?: boolean }) {
  return <th style={{ padding: '9px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', width: w, textAlign: center ? 'center' : right ? 'right' : 'left' }}>{children}</th>;
}
function Td({ children, center, right }: { children?: React.ReactNode; center?: boolean; right?: boolean }) {
  return <td style={{ padding: '10px 12px', verticalAlign: 'middle', textAlign: center ? 'center' : right ? 'right' : 'left' }}>{children}</td>;
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--color-text-3)', fontSize: '13.5px' }}>{children}</div>;
}
function Pager({ page, pages, onPrev, onNext }: { page: number; pages: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: '12px', color: 'var(--color-text-2)' }}>Page {page} of {pages}</span>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onPrev} disabled={page === 1} style={{ ...pagerBtn, opacity: page === 1 ? 0.4 : 1 }}>‹</button>
        <button onClick={onNext} disabled={page >= pages} style={{ ...pagerBtn, opacity: page >= pages ? 0.4 : 1 }}>›</button>
      </div>
    </div>
  );
}
const pagerBtn: React.CSSProperties = { width: 30, height: 30, border: '1px solid var(--color-border-2)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '15px', color: 'var(--color-text-2)' };

/** Compact inline pager for the filter bar — no background/border, sits inline with filters. */
function PagerInline({ page, pages, onPrev, onNext }: { page: number; pages: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '11.5px', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>Page {page} of {pages}</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={onPrev} disabled={page === 1} style={{ ...pagerBtnInline, opacity: page === 1 ? 0.35 : 1 }}>‹</button>
        <button onClick={onNext} disabled={page >= pages} style={{ ...pagerBtnInline, opacity: page >= pages ? 0.35 : 1 }}>›</button>
      </div>
    </div>
  );
}
const pagerBtnInline: React.CSSProperties = { width: 26, height: 26, border: '1px solid var(--color-border-2)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'var(--font-sans)' };

function ResetBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px', height: '30px', padding: '0 10px',
      background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
      fontSize: '11.5px', fontWeight: 700, color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)',
    }}>
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
      Reset filters
    </button>
  );
}

function Sel({ value, onChange, ph, opts, labels }: { value: string; onChange: (v: string) => void; ph: string; opts: string[]; labels?: Record<string, string> }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      height: '30px', padding: '0 8px', borderRadius: 'var(--radius-sm)', fontSize: '11.5px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none',
      border: `1px solid ${value ? 'var(--color-brand)' : 'var(--color-border-2)'}`, background: value ? 'var(--color-brand-subtle)' : 'var(--color-bg)', color: value ? 'var(--color-brand-text)' : 'var(--color-text-2)',
    }}>
      <option value="">{ph}</option>
      {opts.map(o => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
    </select>
  );
}
function Check({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span onClick={e => { e.preventDefault(); onChange(); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? 'var(--color-brand)' : 'var(--color-border-2)'}`, background: checked ? 'var(--color-brand)' : '#fff', cursor: 'pointer', flexShrink: 0 }}>
      {checked && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6.5 5,9.5 10,3.5" /></svg>}
    </span>
  );
}
