'use client';

// ──────────────────────────────────────────────────────────────────────────
// HR Assistant API client.
// Talks to the Agent-Hub FastAPI backend under /api/v1. Authentication is a
// single X-User-Email header (the backend matches it against its users table).
// ──────────────────────────────────────────────────────────────────────────

import { authStorage } from './authStorage';
import { ensureValidToken, doRefresh } from './tokenManager';

const API_BASE =
  process.env.NEXT_PUBLIC_AGENT_API || 'http://localhost:8000';

// Dev-only fallback identity, used when no authenticated session exists yet.
const FALLBACK_EMAIL =
  process.env.NEXT_PUBLIC_HR_USER_EMAIL || '';

function headers(token: string | null): HeadersInit {
  const email = authStorage.getUser()?.email || FALLBACK_EMAIL;
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    // The backend resolves the user from the JWT, falling back to X-User-Email.
    'X-User-Email': email,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/**
 * Recursively mirror `_id` → `id` so the UI can use `id` regardless of
 * whether a payload uses Pydantic's alias output (`_id`) or the plain field
 * name (`id`). The original `_id` is preserved for any caller that still
 * reads it.
 */
function normalizeIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalizeIds) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeIds(v);
    }
    if ('_id' in out && out.id === undefined) out.id = out._id;
    return out as T;
  }
  return value;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Make sure the access token is fresh (silent refresh if near expiry).
  let token = await ensureValidToken();

  const doFetch = (authToken: string | null) =>
    fetch(`${API_BASE}/api/v1${path}`, {
      ...init,
      headers: { ...headers(authToken), ...(init?.headers || {}) },
    });

  let resp = await doFetch(token);

  // On 401, attempt a single refresh + retry before giving up.
  if (resp.status === 401) {
    const refreshed = await doRefresh();
    if (refreshed) {
      token = authStorage.getActiveToken();
      resp = await doFetch(token);
    }
    if (resp.status === 401) {
      authStorage.clear();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Your session has expired. Please sign in again.');
    }
  }

  if (!resp.ok) {
    let detail = `${resp.status} ${resp.statusText}`;
    try {
      const body = await resp.json();
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  if (resp.status === 204) return undefined as T;
  const json = await resp.json();
  return normalizeIds(json) as T;
}

// ── Types mirroring the backend schemas ──────────────────────────────────

export interface RunConfig {
  searchTitles: string[];
  searchLocations: string[];
  targetIndustries: string[]; // industry slugs
  hoursOld: number;
  resultsPerSearch: number;
  siteName: string[];
  icpConfigSnapshot?: { icpConfigId?: string | null; version: number } | null;
}

export interface CampaignStats {
  totalRuns: number;
  activeRuns: number;
  totalJobsScraped: number;
  totalProspects: number;
  totalEmailsSent: number;
}

export interface Campaign {
  id: string;            // backend _id (or "legacy")
  name: string;
  source: string;
  status: string;        // active | paused
  isLegacy: boolean;
  runConfig: RunConfig | null;
  jobType: string | null;
  dailyEmailGoal?: number;
  weeklyPlan?: { email: number[]; linkedin: number[]; calls: number[] };
  /** When true, the daily first-contact worklist is auto-sent (email always;
   *  LinkedIn invites too for connected users). Default off. */
  autoFirstContact?: boolean;
  /** IANA zone this campaign's automation runs in, e.g. "Europe/Berlin".
   *  Absent when never set — the scheduler applies the deployment default. */
  automationTimezone?: string;
  /** 24-hour local start time, "HH:MM". Absent = deployment default. */
  automationTime?: string;
  /** Pinned outreach template IDs; the first is used for automated sends. */
  defaultTemplateIds?: string[];
  /** Pinned LinkedIn message-template IDs (agamx_linkedinTemplates); the first is the
   *  default pre-filled for invite notes / connection messages on the LinkedIn tab. */
   /** Pinned LinkedIn follow-up template IDs; the first is the default after acceptance. */
   defaultLinkedinTemplateIds?: string[];
   /** Pinned LinkedIn invite-template IDs used for connection notes and automation. */
   defaultLinkedinInviteTemplateIds?: string[];
  /** Mailbox this campaign's outreach sends from. Absent = the server's default
   *  search-campaign mailbox (HR_KIRAH_EMAIL_SENDER). */
  senderEmail?: string;
  senderEngine?: string;
  /** When set, an inbound prospect reply on this campaign is notification-forwarded
   *  (in-thread, from the sending mailbox) to this address. Absent/empty = off. */
  forwardToEmail?: string;
  /** Fixed CC list copied on every outreach email this campaign sends (multi-value).
   *  Absent/empty = no CC. */
  ccEmails?: string[];
  stats: CampaignStats;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  createdBy: string | null;
  /** Single-element = the owner (gets worklist + automation). */
  owners: string[] | null;
  /** Collaborators: view + manual send only, no My Tasks / Weekly Goals / automation. */
  collaborators?: string[] | null;
  /** "owner" or "collaborator" for the current user. */
  myRole?: 'owner' | 'collaborator';
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RunStats {
  /** Every posting pulled from the boards, duplicates included. Scrape volume, NOT
   *  what the run produced — use `qualifiedJobs` for that. */
  totalJobsScraped: number;
  uniqueCompanies: number;
  acceptedCompanies: number;
  rejectedCompanies: number;
  totalProspects: number;
  inserted?: number;
  duplicates?: number;
  /** Scrape-time counter, tallied BEFORE de-duplication. Not the final figure. */
  acceptedJobs?: number;
  rejectedJobs?: number;
  skippedCompanies?: number;
  /** The end of the funnel: jobs that passed quality review AND have prospects —
   *  the jobs a person can actually work, matching the run's Accepted tab. */
  qualifiedJobs?: number;
}

export interface Run {
  id: string;
  title: string;
  source: string;
  status: string;        // active | completed | failed | cancelled
  runStartedAt: string;
  runEndedAt: string | null;
  stats: RunStats;
  runConfig: RunConfig;
  campaignId?: string | null;
  scheduledFromId?: string | null;   // set when this run was fired by a schedule
  reportUrl?: string | null;         // here.now pipeline report for this run
  createdBy: string | null;
  owners: string[] | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface JobRow {
  _id: string;
  runId: string;
  companyId: string | null;
  title: string;
  company: string;
  industry: string | null;
  location: string | null;
  qualityStatus: 'good' | 'poor';
  rejectionReason: string | null;
  postedDate: string | null;
  prospectCount: number;
  outreachCount: number;
}

export interface JobsResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  jobs: JobRow[];
}

export interface ProspectRow {
  _id: string;
  runId: string;
  companyId: string;
  apolloId?: string;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string;
  seniority: string;
  isAccepted: boolean;
  isEnriched: boolean;
  mobileEnrichmentStatus?: 'enriched' | 'pending' | 'credit_limit_exceeded' | null;
  strategy?: string;
  filterStep?: string;
  rejectionReason: string | null;
  matchReasons: string[];
  industrySlug: string;
  prospectDetails?: {
    linkedinUrl?: string;
    phone?: string;
    location?: string;
    seniorityWeight?: number;
  };
}

/**
 * Outreach email template returned alongside a job's prospects. The `template`
 * is raw HTML containing `{{PLACEHOLDER}}` tokens that the UI substitutes with
 * the active prospect's details before rendering.
 */
export interface EmailTemplate {
  _id: string;
  industry?: string;
  persona?: string;
  outreachType?: string;
  template: string;
  subject?: string;
  artifactFields?: unknown[];
}

export interface ProspectsResponse {
  prospects: ProspectRow[];
  total: number;
  job: { _id: string; title: string; company: string };
  emailTemplate?: EmailTemplate | null;
}

export interface OutreachStatusResponse {
  runId: string;
  summary: { pending: number; sent: number; failed: number; skipped: number };
  total: number;
  records: OutreachRecord[];
}

export interface OutreachRecord {
  _id: string;
  jobId: string;
  jobTitle?: string;
  prospectId?: string;
  name?: string;
  // The /outreach-status aggregation returns the joined prospect/company names
  // under these keys (mirrors the import campaign's outreach-logs shape).
  prospectName?: string;
  prospectCompany?: string;
  email?: string;
  company?: string;
  phone?: string;
  status?: string;
  detailedStatus?: string;
  sentAt?: string | null;
  updatedAt?: string | null;
}

// ── ICP config (drives the create form's option lists) ────────────────────

export interface IcpConfig {
  id: string | null;
  version: number;
  isActive: boolean;
  titles: { title: string; isActive: boolean; isDefault: boolean }[];
  locations: { location: string; country: string; isActive: boolean; isDefault: boolean }[];
  industries: { slug: string; displayName: string; isTarget: boolean; linkedinNames: string[] }[];
  personaMappings: { industrySlug: string; personaTitles: string[] }[];
  defaultPersonaTitles: string[];
}

// ── Campaigns ─────────────────────────────────────────────────────────────

export function listCampaigns() {
  return request<Campaign[]>('/campaigns');
}

export function getCampaign(id: string) {
  return request<Campaign>(`/campaigns/${id}`);
}

export interface CampaignCreateBody {
  name: string;
  source?: string;
  runConfig: RunConfig;
  jobType?: string | null;
  /** Single-element = the owner. */
  owners?: string[] | null;
  /** Collaborators: view + manual send only (no worklist). */
  collaborators?: string[] | null;
  /** Companies/day to email from this campaign; summed into the My-Tasks goal. */
  dailyEmailGoal?: number;
  /** Full per-channel, per-weekday commitment (Mon…Sun). Built at creation from the
   *  Monday goals (weekdays filled, weekends 0); editable later in Settings / Weekly Goals. */
  weeklyPlan?: { email: number[]; linkedin: number[]; calls: number[] };
  /** Toggle daily automated first contact for this campaign. */
  autoFirstContact?: boolean;
  /** Pinned outreach template IDs from agamx_outreachTemplates. */
  defaultTemplateIds?: string[];
  /** Pinned LinkedIn invite-template IDs from agamx_linkedinTemplates. */
  defaultLinkedinInviteTemplateIds?: string[];
  /** Pinned LinkedIn follow-up template IDs from agamx_linkedinTemplates. */
  defaultLinkedinTemplateIds?: string[];
  /** Mailbox this campaign's outreach sends from; empty = server default. */
  senderEmail?: string;
  senderEngine?: string;
  /** When set, an inbound prospect reply on this campaign is notification-forwarded
   *  (in-thread, from the campaign's sending mailbox) to this address. Empty = off. */
  forwardToEmail?: string;
  /** Fixed CC list copied on every outreach email this campaign sends (multi-value).
   *  Cleaned/de-duped server-side; [] clears it. */
  ccEmails?: string[];
  /** IANA zone this campaign's automation runs in, e.g. "Europe/Berlin". */
  automationTimezone?: string;
  /** 24-hour local start time, "HH:MM". */
  automationTime?: string;
}

export function createCampaign(body: CampaignCreateBody) {
  return request<Campaign>('/campaigns', {
    method: 'POST',
    body: JSON.stringify({ source: 'jobspy', ...body }),
  });
}

export function updateCampaign(id: string, body: Partial<CampaignCreateBody> & { status?: string; weeklyPlan?: { email: number[]; linkedin: number[]; calls: number[] } }) {
  return request<Campaign>(`/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteCampaign(id: string, deleteRuns = false) {
  return request<{ status: string }>(`/campaigns/${id}?delete_runs=${deleteRuns}`, {
    method: 'DELETE',
  });
}

export function listCampaignRuns(campaignId: string, page = 1, limit = 50) {
  return request<Run[]>(`/campaigns/${campaignId}/runs?page=${page}&limit=${limit}`);
}

/**
 * Permanently delete a run and everything that belongs to it (jobs, prospects,
 * outreach records, enrichment credits/transactions). Cannot be undone.
 */
export function deleteRun(runId: string) {
  return request<{ status: string; runId: string }>(`/runs/${runId}`, {
    method: 'DELETE',
  });
}

/**
 * Restart a cancelled or failed run from where it stopped.
 *
 * Resume is phase-aware and idempotent, not a re-run: job scraping is skipped if
 * jobs were already persisted, company extraction if companies were, and prospect
 * discovery re-runs but skips people it already has. A run that died before
 * persisting anything therefore restarts from the beginning — which is correct,
 * there is nothing to keep.
 *
 * Returns as soon as the work is queued; the run flips to `active` and progress
 * shows up on the next reload. Only `cancelled` and `failed` runs are accepted;
 * anything else is a 400.
 */
export function resumeRun(runId: string) {
  return request<{ status: string; runId: string; message: string }>(
    `/runs/${runId}/resume`, { method: 'POST' },
  );
}

export function startCampaignRun(campaignId: string) {
  return request<Run>(`/campaigns/${campaignId}/runs`, { method: 'POST' });
}

// ── Schedules ─────────────────────────────────────────────────────────────
export type ScheduleFrequency = 'once' | 'daily' | 'repeat' | 'weekly' | 'monthly';

export interface ScheduleCreateBody {
  name: string;
  source?: string;
  campaignId?: string;          // links fired runs back to the campaign
  runConfig: RunConfig;
  frequency: ScheduleFrequency;
  timeOfDay?: string;           // 'HH:MM' (repeat/weekly/monthly/daily)
  daysOfWeek?: number[];        // 0=Sun..6=Sat (repeat)
  dayOfWeek?: number;           // 0..6 (weekly)
  dayOfMonth?: number;          // 1..31 (monthly)
  runAt?: string;               // ISO instant (once)
  timezone?: string;
  isActive?: boolean;
}

export interface Schedule {
  id?: string;
  name: string;
  campaignId?: string | null;
  frequency: ScheduleFrequency;
  timeOfDay?: string | null;     // 'HH:MM'
  daysOfWeek?: number[] | null;  // 0=Sun..6=Sat (repeat)
  dayOfWeek?: number | null;     // 0..6 (weekly)
  dayOfMonth?: number | null;    // 1..31 (monthly)
  runAt?: string | null;         // ISO instant (once)
  timezone: string;
  cron?: string | null;
  isActive: boolean;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export function createSchedule(body: ScheduleCreateBody) {
  return request<Schedule>('/schedules', {
    method: 'POST',
    body: JSON.stringify({ source: 'jobspy', isActive: true, ...body }),
  });
}

/** All shared schedules (run_schedules collection), workspace-wide. */
export function listSchedules() {
  return request<Schedule[]>('/schedules');
}

/**
 * Schedules configured for a specific campaign. The backend has no per-campaign
 * route, so we list all shared schedules and filter by campaignId here.
 */
export async function listCampaignSchedules(campaignId: string) {
  const all = await listSchedules();
  return all.filter(s => s.campaignId === campaignId);
}

// ── Runs ────────────────────────────────────────────────────────────────

export function getRun(runId: string) {
  return request<Run>(`/runs/${runId}`);
}

export function getRunJobs(runId: string, page = 1, limit = 50, quality?: 'good' | 'poor', search?: string) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (quality) q.set('quality', quality);
  if (search && search.trim()) q.set('search', search.trim());
  return request<JobsResponse>(`/runs/${runId}/jobs?${q}`);
}

export function getJobProspects(jobId: string) {
  return request<ProspectsResponse>(`/jobs/${jobId}/prospects`);
}

export function getOutreachStatus(runId: string) {
  return request<OutreachStatusResponse>(`/runs/${runId}/outreach-status`);
}

// ── Outreach (email flow) ──────────────────────────────────────────────────

export interface EmailFlowProspect {
  prospectId: string;
  companyId: string;
  firstName: string;
  email?: string;
  industrySlug?: string;
  title: string;
  companyName?: string;
  jobTitle?: string;
}

export interface EmailFlowJob {
  jobId: string;
  prospects: EmailFlowProspect[];
}

export function triggerEmailFlow(runId: string, jobs: EmailFlowJob[]) {
  return request<{ status: string; message: string }>('/outreach/trigger-email-flow', {
    method: 'POST',
    body: JSON.stringify({ runId, jobs }),
  });
}

// ── Prospect enrichment (email + mobile) ────────────────────────────────────

export interface EnrichmentCreditStatus {
  runId: string;
  dailyLimit: number;
  perJobLimit: number;
  creditsUsed: number;
  creditsRemaining: number;
  mobileLimit?: number;
  mobileCreditsUsed?: number;
  mobileCreditsRemaining?: number;
  jobCredits: Record<string, number>;
  periodStart: string | null;
  periodEnd: string | null;
  lastRefreshedAt: string | null;
}

export interface EnrichProspectsResponse {
  enriched: number;
  triggered?: number;
  failed?: number;
  total: number;
  message: string;
  skippedNoCredit?: number;
  creditStatus?: EnrichmentCreditStatus;
  /** Phones resolved synchronously in the Apollo response. Key = prospect _id. */
  phones?: Record<string, string>;
}

/**
 * Enrich prospects to reveal a verified business email (and optionally trigger a
 * mobile-number lookup when `revealPhone` is true). Consumes email credits, plus
 * mobile credits when a phone is requested.
 */
export function enrichProspects(
  prospectIds: string[],
  runId?: string,
  jobId?: string,
  revealPhone?: boolean,
) {
  const body: Record<string, unknown> = { prospectIds };
  if (runId) body.runId = runId;
  if (jobId) body.jobId = jobId;
  if (revealPhone) body.revealPhone = true;
  return request<EnrichProspectsResponse>('/prospects/enrich', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Trigger a mobile-number lookup only. Phones may resolve synchronously (returned
 * in `phones`) or asynchronously via Apollo webhook (status becomes `pending`).
 */
export function enrichProspectsMobile(prospectIds: string[], runId?: string, jobId?: string) {
  const body: Record<string, unknown> = { prospectIds };
  if (runId) body.runId = runId;
  if (jobId) body.jobId = jobId;
  return request<EnrichProspectsResponse>('/prospects/enrich-mobile', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchEnrichmentCredits(runId: string) {
  return request<EnrichmentCreditStatus>(`/runs/${runId}/enrichment-credits`);
}

// ── ICP config ──────────────────────────────────────────────────────────────

export function getIcpConfig() {
  return request<IcpConfig>('/icp/config');
}

// ── Agent activity log ────────────────────────────────────────────────────────

/** A single contacted person, captured on email/outreach log entries. */
export interface AgentLogRecipient {
  name?: string;
  email?: string;
  company?: string;
}

/** Extra structured detail carried on a log entry (shape varies by event). */
export interface AgentLogMetadata {
  channel?: 'email' | 'linkedin' | 'auto' | string;
  sender?: string;
  sentCount?: number;
  failedCount?: number;
  skippedCount?: number;
  recipients?: AgentLogRecipient[];
  sourced?: number;
  accepted?: number;
  refreshed?: number;
  emailsQueued?: number;
  invitesSent?: number;
  companies?: number;
  error?: string | null;
  [key: string]: unknown;
}

export interface AgentLogEntry {
  id: string;
  eventType: string;
  message: string;
  summary: string | null;
  agent: string;
  campaignId: string | null;
  campaignName: string | null;
  runId: string | null;
  metadata: AgentLogMetadata;
  createdAt: string;
}

export interface AgentLogPage {
  logs: AgentLogEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * User-scoped agent activity feed, newest first. Cursor-paginated: pass the
 * previous page's `nextCursor` to load the next batch ("load more").
 *
 * `sinceHours` bounds the feed to a recent window (24 = last day, 72 = 3 days,
 * etc.). Pass `null`/omit for all-time.
 */
export function fetchAgentLogs(cursor?: string | null, limit = 50, sinceHours?: number | null) {
  const q = new URLSearchParams({ limit: String(limit) });
  if (cursor) q.set('cursor', cursor);
  if (sinceHours) q.set('since_hours', String(sinceHours));
  return request<AgentLogPage>(`/agent-logs?${q}`);
}

// ── Campaign outreach (sent emails) ──────────────────────────────────────────

/** An inbound reply captured on an outreach record (by the mail webhook). */
export interface OutreachReply {
  from: string;
  subject: string;
  body: string;          // HTML
  receivedAt: string | null;
  // Present on lead-funnel threads once the in-app reply feature is used:
  direction?: 'inbound' | 'outbound' | string;
  to?: string;
  sentAt?: string | null;
}

export interface OutreachEmail {
  id: string;
  kind: 'hr' | 'import';
  outreachId?: string;   // hr: used to fetch the rendered template
  runId?: string;        // import: used with prospectId for the preview
  prospectId?: string;   // import
  prospectName: string;
  /** Prospect's LinkedIn profile URL (when known) — the name renders as a link. */
  prospectLinkedinUrl?: string;
  company: string;
  /** Company's LinkedIn page URL (when known) — the company renders as a link. */
  companyLinkedinUrl?: string;
  email: string;
  subject: string;
  status: string;
  sentAt: string | null;
  /** The actual sent email HTML, stored on the outreach record. Shown verbatim
   *  in the preview pane so the thread reflects what really left the mailbox. */
  body?: string;
  replies?: OutreachReply[];
  lastReplyAt?: string | null;
}

export interface OutreachEmailPage {
  emails: OutreachEmail[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Sent outreach emails for an HR campaign, newest first, cursor-paginated. */
export function fetchCampaignOutreach(campaignId: string, cursor?: string | null, limit = 30) {
  const q = new URLSearchParams({ limit: String(limit) });
  if (cursor) q.set('cursor', cursor);
  return request<OutreachEmailPage>(`/campaigns/${campaignId}/outreach?${q}`);
}

export interface OutreachEmailTemplateCtx {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  companyName: string;
  industrySlug: string;
  subject: string;
  emailTemplate: { template?: string; subject?: string } | null;
}

/** HR: template + prospect context for an outreach record (render client-side). */
export function fetchOutreachEmailTemplate(outreachId: string) {
  return request<OutreachEmailTemplateCtx>(`/outreach/${outreachId}/email-template`);
}
