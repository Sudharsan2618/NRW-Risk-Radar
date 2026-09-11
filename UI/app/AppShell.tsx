'use client';
import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AppBar } from '@/components/milo/AppBar';
import { Sidebar } from '@/components/milo/Sidebar';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useTour } from '@/contexts/TourContext';

const ROUTE_FOR_ID: Record<string, string> = {
  dashboard: '/dashboard',
  inbox: '/inbox',
  myTasks: '/my-tasks',
  tasks: '/dashboard',
  weeklyGoals: '/weekly-goals',
  reports: '/reports',
  reminders: '/dashboard',
  askMilo: '/ai-assistant',
  'milo-assistant': '/ai-assistant',
  'design-agency': '/dashboard',
  'account-intel': '/account-intel',
  competitors: '/competitors',
  signals: '/market-signals',
  email: '/outreach-templates',
  templates: '/outreach-templates',
  'icp-selection': '/icp-selection',
  'linkedin-composer': '/linkedin-templates',
  settings: '/settings',
};

const ID_FOR_PATH: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/inbox': 'inbox',
  '/my-tasks': 'myTasks',
  '/weekly-goals': 'weeklyGoals',
  '/reports': 'reports',
  '/ai-assistant': 'askMilo',
  '/account-intel': 'account-intel',
  '/competitors': 'competitors',
  '/market-signals': 'signals',
  '/outreach-templates': 'templates',
  '/icp-selection': 'icp-selection',
  '/linkedin-templates': 'linkedin-composer',
  '/settings': 'settings',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(true);
  const [isPinned, setIsPinned] = React.useState(false);

  // Auto-collapse is delayed so a brief mouse slip off the sidebar (or a diagonal
  // move toward its content) doesn't snap it shut. Opening stays instant.
  const COLLAPSE_DELAY_MS = 1000;
  const collapseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPendingCollapse = React.useCallback(() => {
    if (collapseTimer.current !== null) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);
  // Clear any pending timer on unmount.
  React.useEffect(() => cancelPendingCollapse, [cancelPendingCollapse]);

  // While the product tour runs, keep the sidebar expanded and pinned so its
  // nav entries stay reliable spotlight targets.
  const tour = useTour();
  const tourActive = !!tour?.isActive;
  const effectiveCollapsed = tourActive ? false : collapsed;

  const [showCampaignPicker, setShowCampaignPicker] = React.useState(false);

  const isNewCampaignRoute = pathname === '/campaigns/new-search' || pathname === '/campaigns/new-import';

  React.useEffect(() => {
    if (isNewCampaignRoute) {
      setShowCampaignPicker(true);
    } else {
      setShowCampaignPicker(false);
    }
  }, [pathname, isNewCampaignRoute]);

  let activeView = ID_FOR_PATH[pathname] || 'dashboard';
  // Import (lead-gen) run detail: /campaigns/import/{runId}
  const importMatch = pathname.match(/^\/campaigns\/import\/([^/]+)/);
  const campaignMatch = pathname.match(/^\/campaigns\/([^/]+)(?:\/.*)?$/);
  const NON_CAMPAIGN_SLUGS = ['new', 'new-search', 'new-import', 'import'];
  const isCampaignRoute = !!(campaignMatch && !NON_CAMPAIGN_SLUGS.includes(campaignMatch[1]));
  if (importMatch) {
    activeView = 'import-run-' + importMatch[1];
  } else if (isCampaignRoute && campaignMatch) {
    activeView = 'campaign-' + campaignMatch[1];
  }

  // Auto-collapse outer sidebar when entering a campaign route (the inner
  // nav takes its place). Manual expand stays respected on subsequent renders.
  const wasCampaignRoute = React.useRef(false);
  React.useEffect(() => {
    if (isCampaignRoute && !wasCampaignRoute.current) {
      setCollapsed(true);
      setIsPinned(false);
    }
    wasCampaignRoute.current = isCampaignRoute;
  }, [isCampaignRoute]);

  const onNavigate = (id: string) => {
    if (id.startsWith('import-run-')) {
      router.push('/campaigns/import/' + id.slice('import-run-'.length));
      return;
    }
    if (id.startsWith('campaign-')) {
      router.push('/campaigns/' + id.slice('campaign-'.length));
      return;
    }
    const route = ROUTE_FOR_ID[id];
    if (route) router.push(route);
  };

  const onAddWorkspace = () => setShowCampaignPicker(true);

  // Manual toggle (AppBar button / Sidebar chevron): pin open or unpin closed.
  // Cancel any pending auto-collapse so a queued timer can't shut a just-pinned bar.
  const toggleCollapse = React.useCallback(() => {
    cancelPendingCollapse();
    setCollapsed(prev => {
      setIsPinned(prev);
      return !prev;
    });
  }, [cancelPendingCollapse]);

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <AppBar
          sidebarCollapsed={effectiveCollapsed}
          onToggleCollapse={toggleCollapse}
        />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <div
            onMouseEnter={() => {
              cancelPendingCollapse();
              if (!tourActive && !isPinned) setCollapsed(false);
            }}
            onMouseLeave={() => {
              if (tourActive || isPinned) return;
              cancelPendingCollapse();
              collapseTimer.current = setTimeout(() => {
                collapseTimer.current = null;
                setCollapsed(true);
              }, COLLAPSE_DELAY_MS);
            }}
            onClick={() => {
              cancelPendingCollapse();
              if (!tourActive) setIsPinned(true);
            }}
            style={{ display: 'flex', flexShrink: 0 }}
          >
            <Sidebar
              activeView={activeView}
              onNavigate={onNavigate}
              collapsed={effectiveCollapsed}
              onToggleCollapse={toggleCollapse}
              onAddWorkspace={onAddWorkspace}
            />
          </div>
          {showCampaignPicker && (
            <React.Suspense fallback={<div style={{ width: '220px', borderRight: '1px solid var(--color-border)', background: 'var(--color-bg)' }} />}>
              <NewCampaignSheet onClose={() => setShowCampaignPicker(false)} activePath={pathname} />
            </React.Suspense>
          )}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

interface NewCampaignSheetProps {
  onClose: () => void;
  activePath: string;
}

function NewCampaignSheet({ onClose, activePath }: NewCampaignSheetProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');

  let activeId = '';
  if (activePath === '/campaigns/new-search') {
    activeId = 'search';
  } else if (activePath === '/campaigns/new-import') {
    if (typeParam === 'companies') {
      activeId = 'import-companies';
    } else {
      activeId = 'import-prospects';
    }
  }

  const OPTIONS = [
    {
      id: 'search',
      path: '/campaigns/new-search',
      label: 'Search',
      icon: (
        <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="5.5" /><line x1="12" y1="12" x2="16.5" y2="16.5" />
        </svg>
      ),
    },
    {
      id: 'import-prospects',
      path: '/campaigns/new-import?type=prospects',
      label: 'Import prospects',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
        </svg>
      ),
    },
    {
      id: 'import-companies',
      path: '/campaigns/new-import?type=companies',
      label: 'Import company',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
    },
  ];

  return (
    <nav style={{
      width: '220px',
      minWidth: '220px',
      borderRight: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
      overflowY: 'auto',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 14px 12px',
        borderBottom: '1px solid var(--color-border)',
        marginBottom: '8px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: 'var(--color-text-3)' }}>New Campaign</span>
        <button onClick={onClose}
          title="Close panel"
          style={{
            width: '22px', height: '22px', border: 'none', background: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '5px', color: 'var(--color-text-3)', transition: 'background .12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="11" y2="11" />
            <line x1="11" y1="1" x2="1" y2="11" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '4px 0 16px' }}>
        {OPTIONS.map(item => {
          const active = activeId === item.id;
          return (
            <div key={item.id} onClick={() => router.push(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                padding: '7px 14px', margin: '1px 8px',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                fontSize: '13.5px', fontWeight: active ? 600 : 500,
                color: active ? 'var(--color-brand)' : 'var(--color-text-1)',
                background: active ? 'var(--color-brand-tint)' : 'transparent',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { if(!active) e.currentTarget.style.background = 'var(--color-hover)'; }}
              onMouseLeave={e => { if(!active) e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ color: active ? 'var(--color-brand)' : 'var(--color-text-2)', display: 'flex' }}>
                {item.icon}
              </span>
              {item.label}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
