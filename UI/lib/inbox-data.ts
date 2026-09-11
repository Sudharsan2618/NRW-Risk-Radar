// Shared Inbox data + helpers.
// Static placeholder data (no backend wired yet) used by both the in-app
// Inbox list/reading pane and the standalone full-screen mail page.

export interface Mail {
  id: string;
  sender: string;
  email: string;
  subject: string;
  preview: string;
  body: string;
  date: string;      // display label
  ts: number;        // sort key (newest = largest)
  unread?: boolean;
}

export const CAMPAIGN_MAIL: Mail[] = [
  { id: 'c1', sender: 'Rajesh K. · Acme Corp', email: 'rajesh@acme.com', subject: 'Re: Quick question about your integration', preview: 'Thanks for reaching out — this looks like a strong fit for our team…', body: 'Thanks for reaching out — this looks like a strong fit for our team. Could you share a bit more on how the onboarding works and what the timeline usually looks like?\n\nHappy to set up a call next week.\n\nBest,\nRajesh', date: '21 Mar', ts: 21_1400, unread: true },
  { id: 'c2', sender: 'Priya M. · TechFlow', email: 'priya@techflow.io', subject: 'Interested — can we schedule a call?', preview: 'This is timely. We are evaluating a few options this quarter…', body: 'This is timely. We are evaluating a few options this quarter and would like to understand your pricing for a 20-seat team.\n\nAre you free Thursday afternoon?\n\nPriya', date: '21 Mar', ts: 21_1015, unread: true },
  { id: 'c3', sender: 'David L. · Northwind', email: 'david.l@northwind.com', subject: 'Re: D1C Outreach', preview: 'Appreciate the note. Forwarding this to our ops lead…', body: 'Appreciate the note. Forwarding this to our ops lead who owns this decision. Expect to hear back shortly.\n\nDavid', date: '20 Mar', ts: 20_1630 },
  { id: 'c4', sender: 'Anita S. · Globex', email: 'anita@globex.com', subject: 'Pricing details?', preview: 'Can you send across the pricing tiers and contract terms?', body: 'Can you send across the pricing tiers and contract terms? We would like to compare before our internal review.\n\nThanks,\nAnita', date: '20 Mar', ts: 20_0920 },
  { id: 'c5', sender: 'Mark T. · Initech', email: 'mark.t@initech.com', subject: 'Not the right time', preview: 'Thanks, but we are not looking at new tools this quarter…', body: 'Thanks, but we are not looking at new tools this quarter. Please do reach back out in Q3.\n\nMark', date: '19 Mar', ts: 19_1100 },
];

export const TEAM_MAIL: Mail[] = [
  { id: 't1', sender: 'Saurabh S.', email: 'saurabh@swarion.com', subject: 'Landing page draft ready for review', preview: 'First pass of the integration landing page is up — would love eyes…', body: 'First pass of the integration landing page is up — would love eyes on the hero and the pricing section before I take it further.\n\nLink is in the shared drive.\n\nSaurabh', date: '21 Mar', ts: 21_1500, unread: true },
  { id: 't2', sender: 'Milo (AI Assistant)', email: 'milo@swarion.com', subject: 'Weekly campaign summary', preview: '130 leads qualified · 130 emails sent · 42 replies this week…', body: 'Here is your weekly summary:\n\n• 250 leads imported\n• 130 leads qualified for outreach\n• 130 emails sent · 0 bounces\n• 42 replies · 12 positive\n\nPositive replies have been synced to your Pipeline.\n\n— Milo', date: '21 Mar', ts: 21_0800 },
  { id: 't3', sender: 'Priya (Design)', email: 'priya.d@swarion.com', subject: 'Creatives v2 uploaded', preview: 'Updated the creatives based on yesterday’s feedback…', body: 'Updated the creatives based on yesterday’s feedback — tightened the spacing and swapped the accent colour. Ready whenever you want to push them live.\n\nPriya', date: '20 Mar', ts: 20_1700 },
  { id: 't4', sender: 'Saurabh S.', email: 'saurabh@swarion.com', subject: 'Standup notes — 20 Mar', preview: 'Quick recap of what we covered and the action items…', body: 'Quick recap:\n\n• Integration landing page — in progress\n• Creatives — v2 done\n• Review meeting moved to 23 Mar\n\nAction items assigned in the dashboard.\n\nSaurabh', date: '20 Mar', ts: 20_0930 },
];

export function getMailById(id: string): Mail | null {
  return [...CAMPAIGN_MAIL, ...TEAM_MAIL].find(m => m.id === id) ?? null;
}

/* ── Avatar helpers ── */
export const AVATARS = ['var(--color-avatar-blue)', 'var(--color-avatar-green)', 'var(--color-avatar-amber)', 'var(--color-avatar-purple)', 'var(--color-avatar-pink)'];
export const colorFor = (s: string) => AVATARS[s.charCodeAt(0) % AVATARS.length];
export const initials = (s: string) => s.replace(/[^A-Za-z ].*$/, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || s.slice(0, 2).toUpperCase();
