// Product tour step definitions. Each step spotlights a real element (found by
// its `data-tour` attribute) and, when needed, first navigates to the route
// where that element lives. Because the sidebar is mounted on every page and is
// force-expanded while the tour runs, sidebar entries are the most reliable
// anchors; navigating to the matching route also reveals the real screen behind
// the dimmed overlay (and auto-opens the relevant sidebar section).

export type Placement = 'right' | 'left' | 'top' | 'bottom';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** CSS selector for the element to spotlight. Omit for a centered card. */
  target?: string;
  /** Route to push before showing this step. */
  route?: string;
  /** Preferred tooltip side relative to the target. */
  placement?: Placement;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'dashboard',
    title: 'Your dashboard',
    body: 'Start every day here. Response, velocity and booking rates, your pipeline funnel, and live AI strategic insights — all at a glance.',
    target: '[data-tour="nav-dashboard"]',
    route: '/dashboard',
    placement: 'right',
  },
  {
    id: 'inbox',
    title: 'Inbox',
    body: 'Every prospect reply and conversation lands here, so you can respond without ever leaving Swarion.',
    target: '[data-tour="nav-inbox"]',
    route: '/inbox',
    placement: 'right',
  },
  {
    id: 'myTasks',
    title: 'My Tasks',
    body: 'Your action list across all campaigns — LinkedIn invites to send, follow-ups due, and connections to check.',
    target: '[data-tour="nav-myTasks"]',
    route: '/my-tasks',
    placement: 'right',
  },
  {
    id: 'askMilo',
    title: 'AI Assistant (Milo)',
    body: 'Ask Milo to draft outreach, summarise an account, or tell you what to do next. Your AI copilot for the entire funnel.',
    target: '[data-tour="nav-askMilo"]',
    route: '/ai-assistant',
    placement: 'right',
  },
  {
    id: 'newCampaign',
    title: 'Create a campaign',
    body: 'Click the + to launch a campaign — search for fresh accounts, or import a target list to kick off outreach.',
    target: '[data-tour="new-campaign"]',
    route: '/dashboard',
    placement: 'right',
  },
  {
    id: 'prospects',
    title: 'Import prospects',
    body: 'Bring in leads by name and company. Imported prospects flow straight into the invite → connect → message pipeline.',
    target: '[data-tour="new-campaign"]',
    route: '/campaigns/new-import?type=prospects',
    placement: 'right',
  },
  {
    id: 'accountIntel',
    title: 'Account Intelligence',
    body: 'Deep-dive any company: buying signals, hiring trends and key people — so every outreach lands with real context.',
    target: '[data-tour="nav-account-intel"]',
    route: '/account-intel',
    placement: 'right',
  },
  {
    id: 'templates',
    title: 'Templates',
    body: 'Create and reuse email and LinkedIn templates with tokens like {{first_name}} to personalise outreach at scale.',
    target: '[data-tour="nav-templates"]',
    route: '/outreach-templates',
    placement: 'right',
  },
  {
    id: 'settings',
    title: 'Settings & Integrations',
    body: 'Connect LinkedIn, Outlook and Apollo, and manage your workspace, API keys and billing. Your LinkedIn login here powers per-user invites and messages.',
    target: '[data-tour="nav-settings"]',
    route: '/settings',
    placement: 'right',
  },
];
