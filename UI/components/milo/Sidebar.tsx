'use client';
import React, { ReactNode } from 'react';
import { useCampaigns } from '@/lib/campaigns';
import { deleteCampaign } from '@/lib/hrApi';
import { listImportCampaigns, deleteImportCampaign, fetchNotificationUnreadCount, fetchSystemHealth, type HealthStatus } from '@/lib/leadFunnelApi';

const HEALTH_COLOR: Record<HealthStatus, string> = {
  green: 'var(--color-success-text, #16A34A)',
  amber: 'var(--color-warning-text, #B7791F)',
  red: 'var(--color-danger-text, #DC2626)',
};

// Worst of a set of check statuses — drives the single icon color.
const worstHealth = (statuses: HealthStatus[]): HealthStatus | null => {
  if (!statuses.length) return null;
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('amber')) return 'amber';
  return 'green';
};

const EXPANDED_W = 242;
const RAIL_W = 50;

interface SidebarProps {
  activeView: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddWorkspace?: () => void;
}

const SI = ({ d, size = 16, vb = '0 0 18 18' }: { d: ReactNode; size?: number; vb?: string }) => (
  <svg width={size} height={size} viewBox={vb} fill="none"
    stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, color: 'inherit', display: 'block' }}>
    {d}
  </svg>
);

const IC = {
  dashboard: <SI d={<path d="M2.5 7.8L9 2.5L15.5 7.8V15.5H11.5V11H6.5V15.5H2.5V7.8Z" />} />,
  inbox: <SI d={<><rect x="2" y="4" width="14" height="10" rx="1.5" /><polyline points="2.5,5 9,10 15.5,5" /></>} />,
  myTasks: <SI d={<><circle cx="9" cy="9" r="6.5" /><polyline points="6.5,9.2 8.3,11.5 12,6.5" /></>} />,
  tasks: <SI d={<><path d="M2 4.5h14M2 9h14M2 13.5h9" /><circle cx="14" cy="13.5" r="1.5" /></>} />,
  events: <SI d={<><rect x="2.5" y="3.5" width="13" height="12" rx="1.5" /><line x1="2.5" y1="7.5" x2="15.5" y2="7.5" /><line x1="6" y1="1.5" x2="6" y2="5.5" /><line x1="12" y1="1.5" x2="12" y2="5.5" /></>} />,
  templates: <SI d={<><rect x="3" y="2.5" width="9.5" height="11" rx="1.2" /><path d="M5 5.5h5.5M5 8h5.5M5 10.5h3.5" /><path d="M6.5 15.5h7.5a1.5 1.5 0 0 0 1.5-1.5V5" /></>} />,
  cta: <SI d={<><rect x="2" y="3" width="10" height="6" rx="1.5" /><path d="M9.5 10.5l2 2 1.5-1L15.5 14l-2 1-1 1.5-2.5-3" strokeLinejoin="round" /></>} />,
  weeklyGoals: <SI d={<><rect x="2" y="3.5" width="14" height="12" rx="1.5" /><line x1="2" y1="7.5" x2="16" y2="7.5" /><line x1="6" y1="1.5" x2="6" y2="5.5" /><line x1="12" y1="1.5" x2="12" y2="5.5" /><polyline points="5.5,11 7.5,13 12.5,9.5" /></>} />,
  reports: <SI d={<><path d="M4 15.5V5.5M9 15.5V2.5M14 15.5V8.5" /><line x1="2" y1="15.5" x2="16" y2="15.5" /></>} />,
  reminders: <SI d={<><path d="M9 1.5c-3.2 0-5.5 2.5-5.5 5.5v3.5L2 12.5h14l-1.5-2.5V7c0-3-2.3-5.5-5.5-5.5z" /><line x1="9" y1="1.5" x2="9" y2="2.5" /><path d="M7 14.5a2 2 0 0 0 4 0" /></>} />,
  askMilo: <SI d={<path d="M9 1.5L10.4 6.8 15.5 9 10.4 11.2 9 16.5 7.6 11.2 2.5 9 7.6 6.8Z" />} />,
  workspace: <SI d={<><circle cx="9" cy="6.5" r="2.8" /><path d="M3 15.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /></>} />,
  radar: <SI d={<><circle cx="9" cy="9" r="6.5" /><circle cx="9" cy="9" r="3" /><line x1="9" y1="9" x2="13.2" y2="4.8" /></>} />,
  outreach: <SI d={<><polyline points="3,5.5 9,2.5 15,5.5 15,13.5 9,16.5 3,13.5 3,5.5" /><line x1="9" y1="2.5" x2="9" y2="16.5" /><line x1="3" y1="5.5" x2="15" y2="5.5" /></>} />,
  settings: <SI d={<><circle cx="9" cy="9" r="2.5" /><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.6 3.6l1.5 1.5M12.9 12.9l1.5 1.5M3.6 14.4l1.5-1.5M12.9 5.1l1.5-1.5" /></>} />,
  project: <SI d={<><rect x="2.5" y="2.5" width="13" height="13" rx="1.8" /><line x1="2.5" y1="7.5" x2="15.5" y2="7.5" /><line x1="7.5" y1="2.5" x2="7.5" y2="15.5" /></>} />,
  chevron: <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M2 3.5L5 6.5L8 3.5" /></svg>,
  signals: <SI d={<><path d="M9 9v6.5" /><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none" /><path d="M5.5 5.5a5 5 0 0 0 0 7" /><path d="M12.5 5.5a5 5 0 0 1 0 7" /><path d="M3.2 3.2a8.5 8.5 0 0 0 0 11.6" /><path d="M14.8 3.2a8.5 8.5 0 0 1 0 11.6" /></>} />,
  linkedin: <SI d={<><rect x="2.5" y="2.5" width="13" height="13" rx="1.8" /><line x1="5.5" y1="7.5" x2="5.5" y2="13" /><circle cx="5.5" cy="5" r="0.8" fill="currentColor" stroke="none" /><path d="M8.5 13V7.5M8.5 9.5c0-1.1 1-2 2.2-2s2.3.9 2.3 2.5V13" /></>} />,
  competitors: <SI d={<><circle cx="9" cy="9" r="6.5" /><circle cx="9" cy="9" r="3.5" /><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" /></>} />,
  accountIntel: <SI d={<><rect x="2.5" y="5" width="13" height="10.5" rx="1.2" /><line x1="2.5" y1="8.5" x2="15.5" y2="8.5" /><path d="M6 5V3.5h6V5" /><line x1="6" y1="11.5" x2="8" y2="11.5" /><line x1="6" y1="13.5" x2="10.5" y2="13.5" /></>} />,
  sequences: <SI d={<><circle cx="4.5" cy="4.5" r="1.8" /><circle cx="13.5" cy="9" r="1.8" /><circle cx="4.5" cy="13.5" r="1.8" /><path d="M6.3 4.5h3.5a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H8.2a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h1.3" /></>} />,
  icp: <SI d={<><circle cx="9" cy="9" r="6.5" /><path d="M5.5 9h7M9 5.5v7" /><circle cx="9" cy="9" r="2" /></>} />,
  email: <SI d={<><rect x="2" y="4" width="14" height="10" rx="1.5" /><polyline points="2.5,5 9,10 15.5,5" /></>} />,
  call: <SI d={<><path d="M3 4.5c0-1 .8-2 1.8-2h1.6c.4 0 .8.3.9.7L8 6c.1.4 0 .8-.3 1L6.5 8a8 8 0 0 0 3.5 3.5l1-1.2c.3-.3.7-.4 1.1-.3l2.8.7c.4.1.7.5.7.9v1.6c0 1-1 1.8-2 1.8C7.4 15 3 10.6 3 4.5z" strokeLinejoin="round" /></>} />,
  dots: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}><circle cx="3" cy="7" r="1.2" fill="currentColor" /><circle cx="7" cy="7" r="1.2" fill="currentColor" /><circle cx="11" cy="7" r="1.2" fill="currentColor" /></svg>,
  panel: <SI size={13} d={<><rect x="2" y="2" width="14" height="14" rx="1.5" /><line x1="7.5" y1="2" x2="7.5" y2="16" /></>} />,
  collapse: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M8 2L3.5 6.5L8 11" /><path d="M12 2L7.5 6.5L12 11" /></svg>,
  expand: <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M5 2L9.5 6.5L5 11" /><path d="M1 2L5.5 6.5L1 11" /></svg>,
};

interface NavItem {
  id: string; label: string; icon?: ReactNode; dot?: boolean; active?: boolean;
  /** Campaign rows are deletable. `kind` selects which delete API to call. */
  kind?: 'hr' | 'import'; campaignId?: string; deletable?: boolean;
}
interface NavSection { id: string; label: string; icon: ReactNode; items: NavItem[] }

// Import (lead-gen) campaigns shown in the sidebar. Cached at module level so
// the list survives Sidebar remounts on navigation (AppShell is per-page), the
// same stale-while-revalidate approach used for search campaigns in useCampaigns.
type ImportCampaignNav = { id: string; runId: string; name: string };

/** Creation time (epoch seconds) encoded in an ObjectId's first 4 bytes. Used to
 *  order campaigns by when they were actually created — consistent with the My
 *  Tasks worklist, and immune to a stale/copied `createdAt` field (e.g. clones). */
function oidTime(id: string): number {
  return /^[0-9a-fA-F]{24}$/.test(id) ? parseInt(id.slice(0, 8), 16) : -Infinity;
}
let importCampaignsCache: ImportCampaignNav[] | null = null;

const STATIC_NAV: NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',          icon: IC.dashboard,   dot: false },
  { id: 'inbox',       label: 'Inbox',              icon: IC.inbox,       dot: false },
  { id: 'myTasks',     label: 'My Tasks',           icon: IC.myTasks,     dot: false },
  { id: 'weeklyGoals', label: 'Weekly Goals',        icon: IC.weeklyGoals, dot: false },
  { id: 'reports',     label: 'Reports',            icon: IC.reports,     dot: false },
  { id: 'askMilo',     label: 'AI Assistant (Milo)', icon: IC.askMilo,     dot: false },
];

const WORKSPACE_BASE_ITEMS: NavItem[] = [];

const BOTTOM_SECTIONS: NavSection[] = [
  {
    id: 'market-radar', label: 'Market Radar', icon: IC.radar,
    items: [
      { id: 'signals',       label: 'Market Signals Feed',  icon: IC.signals },
      { id: 'competitors',   label: 'Competitor Tracker',   icon: IC.competitors },
      { id: 'account-intel', label: 'Account Intelligence', icon: IC.accountIntel },
      { id: 'events',        label: 'Events Feed',          icon: IC.events },
      { id: 'milo-assistant',label: 'AI Assistant (Milo)',  icon: IC.askMilo },
    ],
  },
  {
    id: 'outreach', label: 'Outreach Hub', icon: IC.outreach,
    items: [
      { id: 'email',             label: 'Email Composer',    icon: IC.email },
      { id: 'linkedin-composer', label: 'LinkedIn Composer', icon: IC.linkedin },
      { id: 'call',              label: 'Call Planner',      icon: IC.call },
      { id: 'templates',         label: 'Templates Library', icon: IC.templates },
      { id: 'cta-library',       label: 'CTA Library',       icon: IC.cta },
      { id: 'icp-selection',     label: 'ICP Selection',     icon: IC.icp },
    ],
  },
];

function WorkspaceSection({ activeView, onNavigate, collapsed, items, onAdd, onDelete }: {
  activeView: string; onNavigate: (id: string) => void; collapsed: boolean;
  items: NavItem[]; onAdd?: () => void; onDelete?: (item: NavItem) => void;
}) {
  if (collapsed) {
    return (
      <div style={{ flexShrink: 0, padding: '2px 0' }}>
        <div title="Campaigns" onClick={onAdd} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: `${RAIL_W}px`, height: '34px', margin: '0 auto',
          borderRadius: '6px', cursor: 'pointer', color: 'var(--color-text-2)',
        }}>
          {IC.workspace}
        </div>
      </div>
    );
  }
  return (
    <div style={{ flexShrink: 0, padding: '10px 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 8px 14px' }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px',
          color: 'var(--color-text-3)',
        }}>Campaigns</span>
        <button
          onClick={onAdd}
          title="New campaign"
          data-tour="new-campaign"
          style={{
            width: '20px', height: '20px', border: 'none', background: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '4px', color: 'var(--color-text-3)', fontSize: '18px', lineHeight: 1, padding: 0,
            transition: 'background .12s, color .12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-hover)'; e.currentTarget.style.color = 'var(--color-text-1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--color-text-3)'; }}
        >+</button>
      </div>
      {items.map(item => (
        <SubItem key={item.id} item={item} activeView={activeView} onNavigate={onNavigate} onDelete={onDelete} />
      ))}
    </div>
  );
}

function SubItem({ item, activeView, onNavigate, onDelete }: { item: NavItem; activeView: string; onNavigate: (id: string) => void; onDelete?: (item: NavItem) => void }) {
  const [hov, setHov] = React.useState(false);
  const isProject = !!item.icon;
  const isActive = item.active || activeView === item.id;
  return (
    <div
      data-tour={`nav-${item.id}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px 6px 14px', margin: '1px 8px', borderRadius: '7px',
        cursor: 'pointer', userSelect: 'none',
        background: isActive ? 'var(--color-brand-tint)' : hov ? 'var(--color-hover)' : 'transparent',
        transition: 'background 0.12s', gap: '6px', minWidth: 0,
      }}
      onClick={() => onNavigate(item.id)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
        {isProject ? (
          <span style={{ color: isActive ? 'var(--color-brand)' : 'var(--color-text-2)', display: 'flex', flexShrink: 0 }}>
            {item.icon}
          </span>
        ) : (
          <span style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: 'var(--color-text-3)', flexShrink: 0, marginLeft: '5px',
          }} />
        )}
        <span style={{
          fontSize: isProject ? '13.5px' : '13px',
          fontWeight: isProject ? 600 : 500,
          color: isProject
            ? (isActive ? 'var(--color-brand)' : 'var(--color-text-1)')
            : 'var(--color-text-2)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.label}
        </span>
      </div>
      {item.deletable && onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(item); }}
          title="Delete campaign"
          style={{
            flexShrink: 0, width: '22px', height: '22px', border: 'none', background: 'transparent',
            borderRadius: '4px', cursor: 'pointer', padding: 0,
            display: hov ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-3)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger-text)'; e.currentTarget.style.background = 'var(--color-danger-bg)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-3)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,4.5 15,4.5" />
            <path d="M6 4.5V3.2c0-.5.4-.9.9-.9h4.2c.5 0 .9.4.9.9V4.5" />
            <path d="M4.5 4.5l.8 10.1c0 .6.5 1.1 1.1 1.1h5.2c.6 0 1.1-.5 1.1-1.1l.8-10.1" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function Sidebar({ activeView, onNavigate, collapsed, onToggleCollapse, onAddWorkspace }: SidebarProps) {
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const [openSection, setOpenSection] = React.useState<string | null>(null);
  const { campaigns, reload: reloadCampaigns } = useCampaigns();
  const [importCampaigns, setImportCampaigns] = React.useState<ImportCampaignNav[]>(() => importCampaignsCache ?? []);

  const loadImportCampaigns = React.useCallback(async (force = false) => {
    try {
      const d = await listImportCampaigns();
      const next = d.campaigns.filter(c => c.runId).map(c => ({ id: c._id, runId: c.runId as string, name: c.name }));
      // Only update when the list changed (or forced after a delete) so an
      // identical response leaves the current items (and DOM) untouched.
      if (force || JSON.stringify(next) !== JSON.stringify(importCampaignsCache)) {
        importCampaignsCache = next;
        setImportCampaigns(next);
      }
    } catch { /* lead-funnel optional */ }
  }, []);

  React.useEffect(() => { void loadImportCampaigns(); }, [loadImportCampaigns]);

  // Unread notification count → badge on the Inbox item. Polled, and refreshed
  // immediately when the Inbox marks items read (via a window event).
  const [inboxUnread, setInboxUnread] = React.useState(0);
  React.useEffect(() => {
    let stop = false;
    const refresh = () => fetchNotificationUnreadCount()
      .then(r => { if (!stop) setInboxUnread(r.count || 0); })
      .catch(() => { /* ignore transient errors */ });
    refresh();
    const id = setInterval(refresh, 30000);
    const onChanged = () => refresh();
    window.addEventListener('notifications:changed', onChanged);
    return () => { stop = true; clearInterval(id); window.removeEventListener('notifications:changed', onChanged); };
  }, []);

  // System Health (Settings → System Health) status → tint the Settings nav icon.
  const [healthStatus, setHealthStatus] = React.useState<HealthStatus | null>(null);
  React.useEffect(() => {
    const onChanged = (e: Event) => { setHealthStatus((e as CustomEvent<HealthStatus | null>).detail ?? null); };
    window.addEventListener('system-health:status', onChanged as EventListener);
    return () => window.removeEventListener('system-health:status', onChanged as EventListener);
  }, []);

  // Background health poll: runs whenever the app is open (not just when Settings
  // is visited) so the Settings icon + nav reflect the live worst status and update
  // automatically while idle. Polls immediately, every 60s, and on tab refocus.
  React.useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetchSystemHealth()
        .then(d => {
          if (cancelled) return;
          const worst = worstHealth((d.checks || []).map(c => c.status));
          setHealthStatus(worst);
          window.dispatchEvent(new CustomEvent('system-health:status', { detail: worst }));
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Native (in-app) delete confirmation — replaces window.confirm.
  const [pendingDelete, setPendingDelete] = React.useState<NavItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const requestDeleteCampaign = React.useCallback((item: NavItem) => {
    if (!item.campaignId) return;
    setDeleteError(null);
    setPendingDelete(item);
  }, []);

  const confirmDeleteCampaign = React.useCallback(async () => {
    const item = pendingDelete;
    if (!item || !item.campaignId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (item.kind === 'import') {
        await deleteImportCampaign(item.campaignId);
        await loadImportCampaigns(true);
      } else {
        await deleteCampaign(item.campaignId);
        await reloadCampaigns();
      }
      // If the open campaign was the one deleted, leave its (now dead) route.
      if (activeView === item.id) onNavigate('dashboard');
      setPendingDelete(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete campaign');
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, activeView, onNavigate, loadImportCampaigns, reloadCampaigns]);

  const workspaceItems: NavItem[] = React.useMemo(() => {
    // Merge search (HR) + import (lead-gen) campaigns into one list ordered by
    // creation time (newest first), keyed off each campaign's ObjectId so it stays
    // consistent with the My Tasks worklist. The synthetic HR legacy bucket ("All
    // Existing Runs") isn't an ObjectId → sorts last.
    const campaignItems = [
      // HR campaigns → /campaigns/{id}
      ...campaigns.map(c => ({
        id: 'campaign-' + c.id, label: c.name, icon: IC.project,
        kind: 'hr' as const, campaignId: c.id, deletable: false,
        _ts: oidTime(c.id),
      })),
      // Import campaigns → /campaigns/import/{runId}
      ...importCampaigns.map(c => ({
        id: 'import-run-' + c.runId, label: c.name, icon: IC.project,
        kind: 'import' as const, campaignId: c.id, deletable: false,
        _ts: oidTime(c.id),
      })),
    ];
    campaignItems.sort((a, b) => b._ts - a._ts);
    return [
      ...WORKSPACE_BASE_ITEMS,
      ...campaignItems.map(({ _ts, ...item }) => item),
    ];
  }, [campaigns, importCampaigns]);

  React.useEffect(() => {
    const match = BOTTOM_SECTIONS.find(s => s.items.some(it => it.id === activeView));
    setOpenSection(match ? match.id : null);
  }, [activeView]);

  const toggleSection = (id: string) => {
    if (collapsed) { onToggleCollapse(); setOpenSection(id); return; }
    setOpenSection(prev => prev === id ? null : id);
  };

  const navItem = (active: boolean, hovered: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '9px',
    padding: collapsed ? '0' : '7px 14px',
    margin: collapsed ? '0 auto' : '1px 8px',
    width: collapsed ? `${RAIL_W}px` : 'auto',
    height: collapsed ? '36px' : 'auto',
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: collapsed ? '8px' : '7px',
    fontSize: '13.5px', fontWeight: 500,
    color: active ? 'var(--color-brand)' : 'var(--color-text-1)',
    cursor: 'pointer', userSelect: 'none',
    background: active ? 'var(--color-brand-tint)' : hovered ? 'var(--color-hover)' : 'transparent',
    transition: 'background 0.12s, color 0.12s',
    position: 'relative', whiteSpace: 'nowrap', overflow: 'hidden', flexShrink: 0,
  });

  const Divider = () => (
    <div style={{
      height: '1px', background: 'var(--color-border)',
      margin: collapsed ? '4px 10px' : '4px 14px', flexShrink: 0,
    }} />
  );

  return (
    <div style={{
      position: 'relative',
      width: `${collapsed ? RAIL_W : EXPANDED_W}px`,
      minWidth: `${collapsed ? RAIL_W : EXPANDED_W}px`,
      transition: 'width 0.2s ease, min-width 0.2s ease',
      flexShrink: 0, zIndex: 1,
    }}>
      <button onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          position: 'absolute', right: '-13px', top: '52px',
          width: '26px', height: '26px',
          border: '1px solid var(--color-border)', background: 'var(--color-surface)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '6px', color: 'var(--color-text-3)', zIndex: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
        {collapsed ? IC.expand : IC.collapse}
      </button>

      <aside style={{
        width: '100%', height: '100%', background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', overflowX: 'hidden', flexShrink: 0,
      }}>
        <div style={{ padding: collapsed ? '2px 0 4px' : '0 0 4px', flexShrink: 0 }}>
          {STATIC_NAV.map(item => {
            const active = activeView === item.id;
            const hovered = hoveredItem === item.id;
            return (
              <div key={item.id}
                data-tour={`nav-${item.id}`}
                title={collapsed ? item.label : undefined}
                style={navItem(active, hovered)}
                onClick={() => onNavigate(item.id)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}>
                <span style={{ color: active ? 'var(--color-brand)' : 'var(--color-text-2)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                )}
                {item.id === 'inbox' && inboxUnread > 0 && (
                  <span style={collapsed
                    ? { position: 'absolute', top: '3px', right: '5px', minWidth: '15px', height: '15px', padding: '0 3px', borderRadius: '8px', background: 'var(--color-danger, #C0392B)', color: '#fff', fontSize: '10px', fontWeight: 700, lineHeight: '15px', textAlign: 'center', boxShadow: '0 0 0 1.5px var(--color-surface)' }
                    : { minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '9px', background: 'var(--color-danger, #C0392B)', color: '#fff', fontSize: '11px', fontWeight: 700, lineHeight: '18px', textAlign: 'center', flexShrink: 0 }}>
                    {inboxUnread > 99 ? '99+' : inboxUnread}
                  </span>
                )}
                {item.dot && !collapsed && (
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: 'var(--color-danger)', flexShrink: 0,
                    boxShadow: '0 0 0 1.5px var(--color-surface)',
                  }} />
                )}
                {item.dot && collapsed && (
                  <span style={{
                    position: 'absolute', top: '6px', right: '9px',
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: 'var(--color-danger)',
                  }} />
                )}
              </div>
            );
          })}
        </div>

        <Divider />
        <WorkspaceSection
          activeView={activeView}
          onNavigate={onNavigate}
          collapsed={collapsed}
          items={workspaceItems}
          onAdd={onAddWorkspace}
          onDelete={requestDeleteCampaign}
        />
        <div style={{ flex: 1, minHeight: '12px' }} />

        <div style={{ flexShrink: 0 }}>
          {BOTTOM_SECTIONS.map(section => {
            const isOpen = openSection === section.id;
            return (
              <div key={section.id} style={{ padding: '10px 0 4px' }}>
                {collapsed ? (
                  <div title={section.label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: `${RAIL_W}px`, height: '34px', margin: '0 auto',
                    borderRadius: '6px', cursor: 'pointer', color: 'var(--color-text-2)',
                  }}
                    onClick={() => toggleSection(section.id)}>
                    {section.icon}
                  </div>
                ) : (
                  <div
                    onClick={() => toggleSection(section.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0 12px 8px 14px',
                      cursor: 'pointer', userSelect: 'none',
                    }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.7px', color: 'var(--color-text-3)',
                    }}>{section.label}</span>
                    <span style={{
                      display: 'flex', alignItems: 'center', color: 'var(--color-text-3)',
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.2s ease',
                    }}>
                      {IC.chevron}
                    </span>
                  </div>
                )}

                {!collapsed && isOpen && (
                  <div style={{ overflow: 'hidden', animation: 'slideDown 0.18s ease' }}>
                    {section.items.map(item => (
                      <SubItem key={item.id} item={item} activeView={activeView} onNavigate={onNavigate} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Divider />

        <div style={{ padding: '2px 0 10px', flexShrink: 0 }}>
          {(() => {
            const active = activeView === 'settings';
            const hovered = hoveredItem === 'settings';
            return (
              <div title={collapsed ? 'Settings' : undefined}
                data-tour="nav-settings"
                style={navItem(active, hovered)}
                onClick={() => onNavigate('settings')}
                onMouseEnter={() => setHoveredItem('settings')}
                onMouseLeave={() => setHoveredItem(null)}>
                <span style={{ color: active ? 'var(--color-brand)' : (healthStatus ? HEALTH_COLOR[healthStatus] : 'var(--color-text-2)'), display: 'flex', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
                  {IC.settings}
                  {healthStatus && (
                    <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: 7, height: 7, borderRadius: '50%', background: HEALTH_COLOR[healthStatus], boxShadow: '0 0 0 2px var(--color-bg)' }} />
                  )}
                </span>
                {!collapsed && <span>Settings</span>}
              </div>
            );
          })()}
        </div>
      </aside>

      {pendingDelete && (
        <div
          onClick={() => { if (!deleting) setPendingDelete(null); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: '420px', background: 'var(--color-bg)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-modal)', overflow: 'hidden',
          }}>
            <div style={{ padding: '18px 20px 8px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '8px' }}>
                Delete campaign
              </div>
              <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', lineHeight: 1.55 }}>
                Permanently delete <strong style={{ color: 'var(--color-text-1)' }}>{pendingDelete.label}</strong>
                {pendingDelete.kind === 'import'
                  ? ' and all of its imported leads and runs'
                  : '. Its runs are detached and kept under Ungrouped Runs'}. This cannot be undone.
              </div>
              {deleteError && (
                <div style={{ marginTop: '12px', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-danger-text)' }}>
                  {deleteError}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px 16px' }}>
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                style={{
                  padding: '8px 14px', border: '1px solid var(--color-border-2)', background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)',
                  cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
                }}>Cancel</button>
              <button
                onClick={confirmDeleteCampaign}
                disabled={deleting}
                style={{
                  padding: '8px 14px', border: 'none', background: 'var(--color-danger)', color: '#fff',
                  borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 700,
                  cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', opacity: deleting ? 0.7 : 1,
                }}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
