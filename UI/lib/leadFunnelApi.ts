'use client';

// ──────────────────────────────────────────────────────────────────────────
// Lead Funnel Assistant API client (the "import leads" / lead-generation agent).
// Talks to the Agent-Hub FastAPI backend under /api/lead-funnel and /api/users.
// Auth is shared with hrApi: a bearer token (+ X-User-Email fallback).
// ──────────────────────────────────────────────────────────────────────────

import { authStorage } from './authStorage';
import { ensureValidToken, doRefresh } from './tokenManager';

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API || 'http://localhost:8000';
const FALLBACK_EMAIL = process.env.NEXT_PUBLIC_HR_USER_EMAIL || '';

function authHeaders(token: string | null, json = true): Record<string, string> {
  const email = authStorage.getUser()?.email || FALLBACK_EMAIL;
  const h: Record<string, string> = { 'X-User-Email': email };
  if (json) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// Generic request against an absolute backend path (e.g. '/api/lead-funnel/...').
/** An error from an API call that preserves the HTTP status, so callers can react to
 *  specific failures — e.g. a 429 (LinkedIn rate/invite limit) → enter cooling mode. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** True when the failure is a LinkedIn rate/quota limit (HTTP 429) — the account is
 *  being throttled and further sends should pause ("cooling mode") rather than retry. */
export function isRateLimited(err: unknown): boolean {
  return err instanceof ApiError && err.status === 429;
}

async function request<T>(path: string, init?: RequestInit & { json?: boolean }): Promise<T> {
  let token = await ensureValidToken();
  const json = init?.json !== false;

  const doFetch = (t: string | null) =>
    fetch(`${API_BASE}${path}`, { ...init, headers: { ...authHeaders(t, json), ...(init?.headers || {}) } });

  let resp = await doFetch(token);
  if (resp.status === 401) {
    if (await doRefresh()) {
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
    } catch { /* non-JSON error body */ }
    throw new ApiError(detail, resp.status);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────
export interface EmailSender {
  id: string;
  engine: string;
  name: string;
  email: string;
  status: 'active' | 'needs_config';
  default: boolean;
  description?: string;
}

export interface ActiveUser {
  id: string;
  email: string;
  full_name: string | null;
  designation?: string | null;
  role?: string;
}

export interface ImportCampaignBody {
  name: string;
  industry: string;
  owners?: string[];
  senderEmail?: string;
  senderEngine?: string;
  importType?: 'prospects' | 'companies';
  /** ICP management levels (Apollo person_seniorities) — used for company discovery. */
  seniorities?: string[];
  titles?: string[];
  excludeTitles?: string[];
  departments?: string[];
  /** Outreach templates pinned as this campaign's defaults. When set, the outreach
   *  panel only offers these; when empty, all of the user's templates are offered. */
  defaultTemplateIds?: string[];
  /** user_id whose connected LinkedIn account sends this campaign's invites. */
  linkedinSenderUserId?: string;
  /** Companies/day to email from this campaign; summed into the My-Tasks goal. Default 3. */
  dailyEmailGoal?: number;
  /** Full per-channel, per-weekday commitment (Mon…Sun). Built at creation from the
   *  Monday goals (weekdays filled, weekends 0); editable later in Settings / Weekly Goals. */
  weeklyPlan?: WeeklyPlan;
}

export interface ImportCampaignResult {
  success: boolean;
  campaignId: string;
  runId: string;
}

export interface ImportFileResult {
  success: boolean;
  imported_count: number;
  updated_count: number;
  error_count: number;
  errors: string[];
  error?: string;
}

// ── Calls ─────────────────────────────────────────────────────────────────
export function fetchEmailSenders() {
  return request<{ success: boolean; senders: EmailSender[] }>('/api/lead-funnel/email-senders');
}

/** A connected LinkedIn account selectable as a campaign's invite sender. Normal
 *  users get only their own; the admin gets every connected account. */
export interface LinkedInSender {
  userId: string;
  name: string;
  email: string;
  status: string;
}
export function fetchLinkedInSenders() {
  return request<{ success: boolean; senders: LinkedInSender[]; isAdmin: boolean }>(
    '/api/lead-funnel/linkedin-senders'
  );
}

export function fetchActiveUsers() {
  return request<ActiveUser[]>('/api/users/active');
}

// ── Prospect selection prompt editor ───────────────────────────────────────
// Prompt records are campaign-scoped by the backend. The API intentionally
// keeps the campaign id in the query/body rather than inventing a second UI
// identifier: HR campaigns use their Mongo id and imports use agamx_campaigns._id.
export interface AgentPrompt {
  id: string;
  agent_id: string;
  prompt_type: string;
  prompt_text: string;
  is_active: boolean;
  version: number;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  campaign_id?: string | null;
  is_default?: boolean;
}

export interface AgentPromptListResponse {
  prompts: AgentPrompt[];
  versions?: AgentPrompt[];
  active_prompt_id?: string | null;
}

function normalizeAgentPrompt(raw: any): AgentPrompt {
  return {
    id: String(raw.id || raw._id),
    agent_id: 'prospect_selection',
    prompt_type: 'system',
    prompt_text: raw.prompt_text ?? raw.content ?? '',
    is_active: Boolean(raw.is_active ?? raw.active),
    version: Number(raw.version || 1),
    updated_by: raw.updated_by ?? raw.updatedBy ?? raw.createdBy ?? null,
    created_at: raw.created_at ?? raw.createdAt,
    updated_at: raw.updated_at ?? raw.updatedAt,
    campaign_id: raw.campaign_id ?? raw.campaignId ?? null,
    is_default: Boolean(raw.is_default ?? raw.isDefault),
  };
}

export interface SaveAgentPromptBody {
  prompt_text: string;
  prompt_type?: string;
  campaign_id?: string | null;
  set_as_default?: boolean;
}

const promptQuery = (campaignId?: string | null) => {
  const q = new URLSearchParams();
  if (campaignId) q.set('campaign_id', campaignId);
  q.set('include_versions', 'true');
  return q.toString();
};

export function fetchProspectSelectionPrompts(campaignId?: string | null, source: 'hr' | 'lead_funnel' = 'lead_funnel') {
  if (!campaignId) return Promise.resolve({ prompts: [] } as AgentPromptListResponse);
  return request<any[]>(`/api/icp/campaigns/${encodeURIComponent(campaignId)}/prompts?source=${source}`)
    .then(rows => rows.map(normalizeAgentPrompt))
    .then(prompts => ({ prompts, versions: prompts, active_prompt_id: prompts.find(p => p.is_active)?.id || null }));
}

export function saveProspectSelectionPrompt(campaignId: string, body: SaveAgentPromptBody, source: 'hr' | 'lead_funnel' = 'lead_funnel') {
  return request<any>(`/api/icp/campaigns/${encodeURIComponent(campaignId)}/prompts?source=${source}`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Prospect Selection',
      content: body.prompt_text,
      set_as_default: Boolean(body.set_as_default),
    }),
  }).then(normalizeAgentPrompt);
}

export function activateProspectSelectionPrompt(campaignId: string, promptId: string, source: 'hr' | 'lead_funnel' = 'lead_funnel') {
  return request<any>(`/api/icp/campaigns/${encodeURIComponent(campaignId)}/prompts/${encodeURIComponent(promptId)}/select?source=${source}`, {
    method: 'POST',
  }).then(normalizeAgentPrompt);
}

export interface ProspectSelectionDefault {
  name: string;
  content: string;
  hasDefault: boolean;
}
export function fetchProspectSelectionDefault() {
  return request<ProspectSelectionDefault>('/api/icp/default');
}

/** Persist an existing campaign version as the authenticated user's default ICP. */
export function setProspectSelectionDefault(campaignId: string, promptId: string, source: 'hr' | 'lead_funnel' = 'lead_funnel') {
  return request<{ success: boolean }>(`/api/icp/campaigns/${encodeURIComponent(campaignId)}/prompts/${encodeURIComponent(promptId)}/default?source=${source}`, {
    method: 'POST',
  });
}

// ── Prospect selection prompt test lab ─────────────────────────────────────
export interface ProspectSelectionTestCandidate {
  id: string;
  name: string;
  title?: string | null;
}

export interface ProspectSelectionTestCompany {
  companyName: string;
  prospects: ProspectSelectionTestCandidate[];
}

export interface ProspectSelectionEvaluation {
  prospectId: string;
  name: string;
  title?: string | null;
  companyName?: string | null;
  selected: boolean;
  decision?: 'selected' | 'rejected' | string;
  reason: string;
  rank?: number | null;
  role_tier?: string | number | null;
  roleTier?: string | number | null;
  [key: string]: unknown;
}

export interface ProspectSelectionTestInput {
  content: string;
  /** The current editor draft, retained here so callers can pass the test state directly. */
  draft?: string;
  prospectIds: string[];
  quota: number;
}

export function fetchProspectSelectionTestCandidates(campaignId: string, source: 'hr' | 'lead_funnel' = 'lead_funnel') {
  return request<ProspectSelectionTestCompany[]>(
    `/api/icp/campaigns/${encodeURIComponent(campaignId)}/test-candidates?source=${source}`,
  );
}

export function testProspectSelection(
  campaignId: string,
  body: ProspectSelectionTestInput,
  source: 'hr' | 'lead_funnel' = 'lead_funnel',
) {
  return request<{ evaluations: ProspectSelectionEvaluation[] }>(
    `/api/icp/campaigns/${encodeURIComponent(campaignId)}/test-selection?source=${source}`,
    {
      method: 'POST',
      // The backend contract calls the editor value `content`; `draft` is UI state only.
      body: JSON.stringify({ content: body.content || body.draft || '', prospectIds: body.prospectIds, quota: body.quota }),
    },
  );
}

// ── Current user profile (Settings → Profile / Members) ─────────────────────
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  designation: string | null;
  location: string | null;
  role: string;
  status: string;
  created_at: string | null;
  last_login_at: string | null;
}

/** The signed-in user's profile (agent_hub.users). */
export function fetchMyProfile() {
  return request<UserProfile>('/api/users/me');
}

export interface UpdateProfileBody {
  full_name?: string;
  company_name?: string;
  designation?: string;
  location?: string;
}

/** Update the signed-in user's profile. Email and role are not editable here. */
export function updateMyProfile(body: UpdateProfileBody) {
  return request<UserProfile>('/api/users/me', { method: 'PUT', body: JSON.stringify(body) });
}

export function createImportCampaign(body: ImportCampaignBody) {
  return request<ImportCampaignResult>('/api/lead-funnel/campaigns', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function importFileToRun(runId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  // json:false → let the browser set the multipart boundary Content-Type.
  return request<ImportFileResult>(`/api/lead-funnel/runs/${runId}/import`, {
    method: 'POST',
    body: form,
    json: false,
  });
}

// ── Import campaigns (agamx_campaigns) ──────────────────────────────────────
/** Per-channel, per-weekday commitment. Each array is 7 ints, Mon…Sun. */
export interface WeeklyPlan {
  email: number[];
  linkedin: number[];
  calls: number[];
}

/** Why a campaign's automation slot is (or isn't) editable at this moment.
 *
 *  `run_imminent` — the next run is inside the freeze window (`lockMinutes`).
 *  `run_in_progress` — the slot has passed and the run has not finished.
 *  Both release on their own: the first when the run fires, the second when it
 *  completes or its grace window expires. */
export interface AutomationEditLock {
  locked: boolean;
  reason: 'run_imminent' | 'run_in_progress' | null;
  /** ISO instant the lock is expected to lift. */
  opensAt: string | null;
  /** ISO instant of the next scheduled run. */
  nextRunAt: string | null;
  /** How many minutes before a run the freeze starts. */
  lockMinutes: number;
}

export interface ImportCampaignListItem {
  _id: string;
  name: string;
  industry: string;
  status: string;
  runId: string | null;
  totalRuns: number;
  lastRunStatus: string | null;
  lastRunAt: string | null;
  createdAt: string;
  /** "owner" (gets worklist + goals) or "collaborator" (view + manual send only). */
  myRole?: 'owner' | 'collaborator';
  /** Collaborator user ids (view + manual send, excluded from My Tasks/Weekly Goals). */
  collaborators?: string[];
  /** Per-campaign daily email goal (default 3 when absent on older docs). */
  dailyEmailGoal?: number;
  /** Complete weekly plan (saved, or derived from dailyEmailGoal). */
  weeklyPlan?: WeeklyPlan;
  /** Outreach templates pinned as this campaign's defaults (empty/absent = none pinned). */
  defaultTemplateIds?: string[];
  /** When true, the daily first-contact worklist is auto-sent (email always;
   *  LinkedIn invites too for connected users). Default off. */
  autoFirstContact?: boolean;
  /** IANA zone this campaign's automation runs in, e.g. "Europe/Berlin".
   *  Always a zone name, never an offset, so daylight saving is handled by the
   *  tz database rather than drifting an hour twice a year. */
  automationTimezone?: string;
  /** 24-hour local start time, "HH:MM". */
  automationTime?: string;
}

export function listImportCampaigns() {
  return request<{ success: boolean; campaigns: ImportCampaignListItem[] }>('/api/lead-funnel/campaigns');
}

export interface CampaignReportRow {
  company: string;
  prospectName: string;
  jobTitle: string;
  linkedinUrl: string;
  medium: 'Email' | 'LinkedIn';
  sentAt: string | null;
  status: string;
}

export interface CampaignReport {
  success: boolean;
  campaign: { id: string; name: string };
  range: { from: string; to: string };
  summary: {
    touches: number;
    emailsSent: number;
    linkedinInvites: number;
    opened: number;
    responses: number;
    bounced: number;
    responseRate: number;
  };
  daily: { date: string; emails: number; linkedin: number; responses: number; bounced: number }[];
  rows: CampaignReportRow[];
}

export function fetchCampaignReport(campaignId: string, from: string, to: string) {
  const qs = new URLSearchParams({ from, to });
  return request<CampaignReport>(`/api/lead-funnel/reports/campaign/${encodeURIComponent(campaignId)}?${qs.toString()}`);
}

/**
 * Permanently delete an import campaign and everything under it (runs,
 * prospects, outreach records). Cannot be undone.
 */
export function deleteImportCampaign(campaignId: string) {
  return request<{ success: boolean; deleted: string; runsDeleted: number }>(
    `/api/lead-funnel/campaigns/${campaignId}`,
    { method: 'DELETE' },
  );
}

export interface UpdateCampaignBody {
  name?: string;
  industry?: string;
  senderEmail?: string;
  senderEngine?: string;
  /** When set, an inbound prospect reply on this campaign is notification-forwarded
   *  (in-thread, from the sending mailbox) to this address. "" clears it. */
  forwardToEmail?: string;
  /** Fixed CC list copied on every outreach email this campaign sends (multi-value).
   *  Cleaned/de-duped server-side; [] clears it. */
  ccEmails?: string[];
  /** "active" feeds My Tasks; "paused" hides the campaign's companies there. */
  status?: 'active' | 'paused';
  /** Single-element = the owner (gets worklist + automation). */
  owners?: string[];
  /** Collaborators: view + manual send only, no My Tasks / Weekly Goals / automation. */
  collaborators?: string[];
  // ICP targeting filters (company-import campaigns) — used by prospect discovery.
  seniorities?: string[];
  titles?: string[];
  excludeTitles?: string[];
  departments?: string[];
  /** Outreach templates pinned as this campaign's defaults (empty = offer all). */
  defaultTemplateIds?: string[];
  /** LinkedIn follow-up templates pinned as this campaign's defaults (empty = use the
   *  user's newest follow-up template). */
  /** Pinned LinkedIn invite templates used for invite notes and automation. */
  defaultLinkedinInviteTemplateIds?: string[];
  defaultLinkedinTemplateIds?: string[];
  /** user_id whose connected LinkedIn account sends this campaign's invites. ""
   *  clears the override (revert to the acting user's own account). */
  linkedinSenderUserId?: string;
  /** Per-campaign daily email goal (companies/day). */
  dailyEmailGoal?: number;
  /** Per-channel, per-weekday commitment (Mon…Sun). Saving this also syncs
   *  dailyEmailGoal to Monday's email value server-side. */
  weeklyPlan?: WeeklyPlan;
  /** Toggle daily automated first contact for this campaign. */
  autoFirstContact?: boolean;
  /** IANA zone this campaign's automation runs in, e.g. "Europe/Berlin".
   *  Always a zone name, never an offset, so daylight saving is handled by the
   *  tz database rather than drifting an hour twice a year. */
  automationTimezone?: string;
  /** 24-hour local start time, "HH:MM". */
  automationTime?: string;
}

export function updateImportCampaign(campaignId: string, body: UpdateCampaignBody) {
  return request<{ success: boolean; campaignId: string; updated: Record<string, any> }>(
    `/api/lead-funnel/campaigns/${campaignId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  );
}

/** Re-run Apollo prospect discovery for a company-import run using its current
 *  ICP filters. New matches are merged in; nothing existing is removed. */
export interface CompanyRediscoverIcp {
  seniorities?: string[];
  titles?: string[];
  excludeTitles?: string[];
  departments?: string[];
}

/**
 * Re-run Apollo prospect discovery for ONE company with an ad-hoc ICP. Scoped
 * to this company only — merges unique people, does not touch the run's saved
 * ICP, run status, or other companies.
 */
export function rediscoverCompanyProspects(runId: string, companyName: string, icp: CompanyRediscoverIcp) {
  return request<{ success: boolean; company: string; found: number; stored: number; new: number; skipped: number }>(
    `/api/lead-funnel/runs/${runId}/companies/${encodeURIComponent(companyName)}/rediscover`,
    { method: 'POST', body: JSON.stringify(icp) }
  );
}

/** A previewed prospect from a company "Search again" dry-run — not yet saved. */
export interface PreviewProspectCandidate {
  apolloId: string;
  firstName: string;
  lastName: string;
  title?: string;
  seniority?: string;
  companyName?: string;
  prospectDetails?: { linkedinUrl?: string; location?: string; [k: string]: unknown };
  [k: string]: unknown;
}

/**
 * PREVIEW (dry-run) Apollo discovery for ONE company: returns the NEW matches
 * as candidates WITHOUT writing anything. Pair with saveCompanyProspects to
 * commit the ones the user selects.
 */
export function previewCompanyProspects(runId: string, companyName: string, icp: CompanyRediscoverIcp) {
  return request<{ success: boolean; company: string; found: number; alreadyInList: number; candidates: PreviewProspectCandidate[] }>(
    `/api/lead-funnel/runs/${runId}/companies/${encodeURIComponent(companyName)}/rediscover`,
    { method: 'POST', body: JSON.stringify({ ...icp, dry_run: true }) }
  );
}

/** Persist the reviewed candidates the user picked from a preview. */
export function saveCompanyProspects(runId: string, companyName: string, candidates: PreviewProspectCandidate[]) {
  return request<{ success: boolean; company: string; stored: number; new: number; skipped: number }>(
    `/api/lead-funnel/runs/${runId}/companies/${encodeURIComponent(companyName)}/rediscover/save`,
    { method: 'POST', body: JSON.stringify({ candidates }) }
  );
}

export function rediscoverProspects(runId: string) {
  return request<{ success: boolean; status: string; message?: string }>(
    `/api/lead-funnel/runs/${runId}/rediscover`,
    { method: 'POST' }
  );
}

import type { OutreachEmailPage } from './hrApi';

/** Sent outreach emails for an import campaign (same shape as the HR endpoint). */
export function fetchImportCampaignOutreach(campaignId: string, cursor?: string | null, limit = 30) {
  const q = new URLSearchParams({ limit: String(limit) });
  if (cursor) q.set('cursor', cursor);
  return request<OutreachEmailPage>(`/api/lead-funnel/campaigns/${campaignId}/outreach?${q}`);
}

// ── Run detail: meta / companies / prospects ────────────────────────────────
export interface LeadFunnelRun {
  _id: string;
  runName: string;
  industry: string;
  industrySlug: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  campaignId?: string | null;
  importType?: 'prospects' | 'companies';
  stats: { totalFetched: number; preFilterRejected: number; enriched: number; postFilterRejected: number; selected: number };
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Single-element = the owner. */
  owners?: string[];
  /** Parent campaign's collaborators (view + manual send only), surfaced on the run. */
  collaborators?: string[];
  senderEmail?: string;
  senderEngine?: string;
  /** Parent campaign's reply-forward address (surfaced on the run for Settings).
   *  Empty/absent = forwarding off. */
  forwardToEmail?: string;
  /** Parent campaign's fixed CC list, copied on every outreach email (surfaced on the
   *  run for Settings). Empty/absent = no CC. */
  ccEmails?: string[];
  /** Outreach templates pinned as this campaign's defaults (empty/absent = offer all). */
  defaultTemplateIds?: string[];
   /** Parent campaign's pinned LinkedIn invite templates. */
   defaultLinkedinInviteTemplateIds?: string[];
   /** Parent campaign's pinned LinkedIn follow-up templates (surfaced on the run for
   *  Settings). Only follow-up templates are pinnable; invites use the user's own. */
  defaultLinkedinTemplateIds?: string[];
  /** Parent campaign's configured LinkedIn invite sender (user_id), or null. */
  linkedinSenderUserId?: string | null;
  /** Parent campaign's per-day email goal (surfaced on the run for Settings). */
  dailyEmailGoal?: number;
  /** Parent campaign's lifecycle status ("active" | "paused"), for Settings. */
  campaignStatus?: string;
  /** Parent campaign's automated-first-contact toggle, for Settings. */
  campaignAutoFirstContact?: boolean;
  /** IANA zone this campaign's automation runs in, e.g. "Europe/Berlin".
   *  Always a zone name, never an offset, so daylight saving is handled by the
   *  tz database rather than drifting an hour twice a year. */
  automationTimezone?: string;
  /** 24-hour local start time, "HH:MM". */
  automationTime?: string;
  /** Whether the schedule above may be edited right now. The slot is frozen from
   *  `lockMinutes` before a run until that run finishes, because it defines the
   *  work-day boundary that the run, its budget row and its tasks are keyed by.
   *  The API refuses a locked change with 409 regardless of what the UI does. */
  automationEditLock?: AutomationEditLock;
  /** Parent campaign's weekly plan (surfaced on the run for Settings). */
  weeklyPlan?: WeeklyPlan;
  filters?: {
    seniorities?: string[];
    titles?: string[];
    excludeTitles?: string[];
    departments?: string[];
  };
}

export interface AISignal {
  signal: 'green' | 'yellow' | 'orange' | 'red';
  label: string;
  summary: string;
  confidence: number;
  keywords: string[];
  analyzedAt: string;
}

export interface LeadFunnelCompany {
  _id: string;
  companyName: string;
  companySize: string | null;
  companyDomain: string | null;
  companyLinkedin: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  location: string | null;
  prospectCount: number;
  prospectIds: string[];
  status: string;
  aiSignal?: AISignal;
}

export interface LeadFunnelProspect {
  _id: string;
  runId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string;
  companyName: string | null;
  companyDomain: string | null;
  companyLinkedin: string | null;
  companyStatus: string;
  /**
   * Per-prospect outreach state. Only set (to 'contacted') once an email has
   * actually been sent to THIS person — absent/null otherwise. Do not confuse
   * with `companyStatus`, which flips to 'contacted' for every prospect at the
   * company as soon as any one of them is emailed.
   */
  status?: string | null;
  /** Detected once when an email preview/send needs the {{Title}} honorific, then
   *  persisted. Drives Mr/Ms in previews so they match what the backend renders. */
  gender?: 'male' | 'female' | 'unknown' | null;
  industrySlug: string;
  prospectDetails: {
    linkedinUrl?: string; phone?: string; location?: string; city?: string; state?: string; country?: string;
    /** Persisted LinkedIn lifecycle state (set once an invite/message is sent). */
    linkedin?: {
      status?: LinkedInStatus;
      invitedAt?: string | null;
      connectedAt?: string | null;
      error?: string | null;
      note?: string | null;
      urnId?: string | null;
    };
  };
  isEnriched: boolean;
}

/**
 * Statuses that mean "we have actually emailed this person".
 *
 * `contacted` is set on send; the value then advances to `replied` when they
 * answer. Both must count as sent — matching on `contacted` alone hides the
 * badge on exactly the prospects who responded.
 */
const CONTACTED_STATUSES = new Set(['contacted', 'replied', 'opened', 'bounced']);

/**
 * True when an email has been sent to THIS prospect.
 *
 * Always use this instead of testing a status field inline. In particular do
 * NOT use `companyStatus`: that is a company-level flag which flips to
 * 'contacted' for every prospect at the company as soon as any one of them is
 * emailed, so it marks the whole list as sent.
 */
export function isProspectContacted(p: Pick<LeadFunnelProspect, 'status'>): boolean {
  return CONTACTED_STATUSES.has((p.status ?? '').toLowerCase());
}

interface Paged<T> { success: boolean; total: number; page: number; pages: number; } // base
export interface CompaniesResponse extends Paged<LeadFunnelCompany> { companies: LeadFunnelCompany[] }
export interface ProspectsResponse extends Paged<LeadFunnelProspect> { prospects: LeadFunnelProspect[] }

export function fetchRun(runId: string) {
  return request<{ success: boolean; run: LeadFunnelRun }>(`/api/lead-funnel/runs/${runId}`);
}

export function fetchCompanies(runId: string, page = 1, limit = 20, search?: string) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) q.set('search', search);
  return request<CompaniesResponse>(`/api/lead-funnel/runs/${runId}/companies?${q}`);
}

export function fetchProspects(runId: string, page = 1, limit = 20, company?: string, search?: string) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (company) q.set('company', company);
  if (search) q.set('search', search);
  return request<ProspectsResponse>(`/api/lead-funnel/runs/${runId}/prospects?${q}`);
}

// ── Outreach templates (agamx_outreachTemplates) ────────────────────────────
export interface OutreachTemplate {
  _id: string;
  name?: string;
  industry: string;
  persona: string;
  outreachType: string;
  subject?: string;
  language?: string;
  tags?: string[];
  template?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Payload for create/update — every field optional except `template` on create. */
export interface OutreachTemplateInput {
  name?: string;
  industry?: string;
  persona?: string;
  outreachType?: string;
  subject?: string;
  language?: string;
  tags?: string[];
  template?: string;
}

export function fetchOutreachTemplates() {
  return request<{ success: boolean; templates: OutreachTemplate[]; total: number }>(
    `/api/lead-funnel/templates?limit=100`
  );
}

/** Create a new outreach template. The backend auto-tags it with the caller's email. */
export function createOutreachTemplate(body: OutreachTemplateInput) {
  return request<{ success: boolean; id: string }>(`/api/lead-funnel/templates`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Update an existing template. Only the provided fields are changed. */
export function updateOutreachTemplate(id: string, body: OutreachTemplateInput) {
  return request<{ success: boolean }>(`/api/lead-funnel/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** Permanently delete a template. */
export function deleteOutreachTemplate(id: string) {
  return request<{ success: boolean }>(`/api/lead-funnel/templates/${id}`, {
    method: 'DELETE',
  });
}

/** The current user's default email template id (used whenever a campaign has no
 *  template configured), or null. */
export function fetchDefaultTemplate() {
  return request<{ success: boolean; defaultTemplateId: string | null }>(
    `/api/lead-funnel/templates/default`
  );
}

/** Set (or clear, with null) the current user's default email template. */
export function setDefaultTemplate(templateId: string | null) {
  return request<{ success: boolean; defaultTemplateId: string | null }>(
    `/api/lead-funnel/templates/default`,
    { method: 'PUT', body: JSON.stringify({ templateId }) }
  );
}

// ── LinkedIn message templates (agamx_linkedinTemplates) ─────────────────────
// Deliberately minimal: a name and a plain-text message body. The only
// supported placeholders are {{Prospect_Name}} and {{Prospect_Company}}, which
// the campaign screen substitutes at view/send time.
/** A template's category. `invite` templates pre-fill the connection-invite note;
 *  `follow-up` templates pre-fill the message sent after a prospect accepts and are the
 *  ones pinned as a campaign default. Legacy templates may have no category. */
export type LinkedInTemplateCategory = 'invite' | 'follow-up';

export interface LinkedInTemplate {
  _id: string;
  name?: string;
  message?: string;
  tags?: string[];
  category?: LinkedInTemplateCategory;
  createdAt?: string;
  updatedAt?: string;
}

/** Payload for create/update — `message` required on create. */
export interface LinkedInTemplateInput {
  name?: string;
  message?: string;
  tags?: string[];
  category?: LinkedInTemplateCategory;
}

/** List the caller's LinkedIn templates, optionally filtered to one category. */
export function fetchLinkedInTemplates(category?: LinkedInTemplateCategory) {
  const cat = category ? `&category=${encodeURIComponent(category)}` : '';
  return request<{ success: boolean; templates: LinkedInTemplate[]; total: number }>(
    `/api/lead-funnel/linkedin-templates?limit=100${cat}`
  );
}

/** Fetch a single LinkedIn template by id (works even when it isn't in the
 *  caller's scoped list, e.g. a default pinned by another user). */
export function fetchLinkedInTemplateById(id: string) {
  return request<{ success: boolean; template: LinkedInTemplate }>(
    `/api/lead-funnel/linkedin-templates/${encodeURIComponent(id)}`,
  );
}

/** Create a new LinkedIn template. The backend auto-tags it with the caller's email. */
export function createLinkedInTemplate(body: LinkedInTemplateInput) {
  return request<{ success: boolean; id: string }>(`/api/lead-funnel/linkedin-templates`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Update an existing LinkedIn template. Only the provided fields are changed. */
export function updateLinkedInTemplate(id: string, body: LinkedInTemplateInput) {
  return request<{ success: boolean }>(`/api/lead-funnel/linkedin-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** Permanently delete a LinkedIn template. */
export function deleteLinkedInTemplate(id: string) {
  return request<{ success: boolean }>(`/api/lead-funnel/linkedin-templates/${id}`, {
    method: 'DELETE',
  });
}

// ── Outreach ────────────────────────────────────────────────────────────────
/** Runtime-edited email content for a single prospect (this send only). */
export interface EmailOverride { subject?: string; body?: string }

export function sendOutreach(
  runId: string,
  prospectIds: string[],
  templateId?: string | null,
  overrides?: Record<string, EmailOverride> | null,
) {
  const payload: { prospectIds: string[]; templateId?: string; overrides?: Record<string, EmailOverride> } = { prospectIds };
  if (templateId) payload.templateId = templateId;
  if (overrides && Object.keys(overrides).length) payload.overrides = overrides;
  return request<{ success: boolean; status: string; total: number; message?: string }>(`/api/lead-funnel/runs/${runId}/send-email`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Reveal real emails for the given prospects via Apollo (spends credits). */
export function enrichProspectEmails(runId: string, prospectIds: string[]) {
  return request<{ success: boolean; enriched: number; total: number; message?: string }>(
    `/api/lead-funnel/runs/${runId}/enrich-emails`,
    { method: 'POST', body: JSON.stringify({ prospectIds }) }
  );
}

// ── Account Intel (batched deep research) ───────────────────────────────────

export interface AccountIntelItem {
  companyName: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  signal: string | null;
  slug: string | null;
  error: string;
  updatedAt: string | null;
}
export interface AccountIntelProgress {
  success: boolean;
  summary: { queued: number; running: number; complete: number; failed: number };
  items: AccountIntelItem[];
  /** True while anything is still queued or running — drives the UI poller. */
  active: boolean;
}

/**
 * Queue deep account research for the selected companies. Returns immediately;
 * the backend drains the queue at bounded concurrency over minutes-to-hours.
 * `skipped` lists companies with no LinkedIn URL — they cannot be researched.
 */
export function startAccountIntel(runId: string, companyNames: string[], forceRefresh = false) {
  return request<{ success: boolean; batchId: string; requested: number; queued: number; skipped: string[] }>(
    `/api/lead-funnel/runs/${runId}/account-intel`,
    { method: 'POST', body: JSON.stringify({ companyNames, forceRefresh }) }
  );
}

export function fetchAccountIntelProgress(runId: string) {
  return request<AccountIntelProgress>(`/api/lead-funnel/runs/${runId}/account-intel`);
}

// ── In-app reply (Campaigns inbox) ──────────────────────────────────────────

export interface OutreachReplyItem {
  direction?: 'inbound' | 'outbound' | string;
  from?: string; to?: string; subject?: string; body?: string;
  receivedAt?: string; sentAt?: string;
}
export interface OutreachReplyDetail {
  id: string;
  runId: string | null;
  prospectId: string | null;
  subject: string;
  body: string;
  status: string;
  replies: OutreachReplyItem[];
  sentAt: string | null;
  mailbox: string;
  prospectEmail: string;
  recipient: string;
  mode: 'reply' | 'followup';
  replyToMessageId: string;
  conversationId: string;
  canReply: boolean;
  latestReplyAutoReply: boolean;
  recipientOptedOut: boolean;
}
/** Thread + everything the reply composer needs (recipient, mailbox, warnings). */
export function fetchOutreachReplyDetail(outreachId: string) {
  return request<OutreachReplyDetail>(`/api/lead-funnel/outreach/${outreachId}`);
}
/** Send an in-thread reply / follow-up. Returns the updated thread. */
export function sendOutreachReply(outreachId: string, payload: { body: string; recipient?: string; includeSignature?: boolean }) {
  return request<{ success: boolean; id: string; status: string; replies: OutreachReplyItem[]; recipient: string; mode: string; canReply: boolean }>(
    `/api/lead-funnel/outreach/${outreachId}/reply`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}
/** Hand this thread over: forward the full thread to `recipient` (empty = the campaign's
 *  configured Forward-Replies-To), with Reply-To set to the prospect so the recipient can
 *  reply to the prospect directly. */
export function forwardOutreach(outreachId: string, payload: { recipient?: string; note?: string; cc?: string[] }) {
  return request<{ success: boolean; recipient: string }>(
    `/api/lead-funnel/outreach/${outreachId}/forward`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}
// ── Notifications (Inbox → Notifications tab + sidebar unread badge) ──────────
export interface AppNotification {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  campaignId: string | null;
  campaignName: string | null;
  link: string | null;
  read: boolean;
  createdAt: string | null;
}
export function fetchNotifications(params?: { limit?: number; before?: string; unreadOnly?: boolean }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.before) q.set('before', params.before);
  if (params?.unreadOnly) q.set('unread_only', 'true');
  const qs = q.toString();
  return request<{ notifications: AppNotification[]; nextCursor: string | null; hasMore: boolean; unreadCount: number }>(
    `/api/notifications${qs ? `?${qs}` : ''}`
  );
}
export function fetchNotificationUnreadCount() {
  return request<{ count: number }>(`/api/notifications/unread-count`);
}
export function markNotificationRead(id: string) {
  return request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' });
}
export function markAllNotificationsRead() {
  return request<{ success: boolean; updated: number }>(`/api/notifications/read-all`, { method: 'POST' });
}

/** "Mark as replied" on a Responses-rail thread: reconciles just this one thread from
 *  Microsoft Graph and resolves it. `status` is `replied` when we've since replied
 *  (drops from the rail) or `skipped` when nothing from us was found (hidden until the
 *  prospect writes again). Replaces the deprecated daily bulk reply-sync. */
export function resolveOutreachResponse(outreachId: string) {
  return request<{ success: boolean; handled: boolean; status: 'replied' | 'skipped'; appended: number }>(
    `/api/lead-funnel/outreach/${outreachId}/resolve-response`,
    { method: 'POST' }
  );
}

// ── System Health (Settings → System Health) ──────────────────────────────────
export type HealthStatus = 'green' | 'amber' | 'red';

export interface SystemHealthCheck {
  area: 'Account' | 'Campaign';
  campaignId?: string | null;
  campaignName?: string | null;
  check: string;
  status: HealthStatus;
  detail: string;
  link?: string | null;
}

export interface SystemHealthResponse {
  checks: SystemHealthCheck[];
  /** ISO-8601 UTC instant the shown result was computed. Render in the viewer's tz. */
  checkedAt?: string | null;
  /** 'snapshot' = last scheduled run; 'live' = just recomputed. */
  source?: 'snapshot' | 'live';
}

export function fetchSystemHealth() {
  return request<SystemHealthResponse>(`/api/system-health`);
}

/** Recompute health now and update the stored snapshot (the Refresh now button). */
export function refreshSystemHealth() {
  return request<SystemHealthResponse>(`/api/system-health/refresh`, { method: 'POST' });
}

export interface ChangelogEntry {
  category: 'New' | 'Improved' | 'Fixed' | string;
  title: string;
  description: string;
}
export interface ChangelogRelease {
  id: string;
  version: string;
  title?: string | null;
  /** ISO-8601 release date. */
  date?: string | null;
  entries: ChangelogEntry[];
}

export function fetchChangelog() {
  return request<{ releases: ChangelogRelease[] }>(`/api/changelog`);
}
export function getReplySignature() {
  return request<{ success: boolean; signature: string; exists: boolean }>(`/api/lead-funnel/reply-signature`);
}
export function saveReplySignature(signature: string) {
  return request<{ success: boolean; signature: string }>(`/api/lead-funnel/reply-signature`, { method: 'PUT', body: JSON.stringify({ signature }) });
}

// ── Sales Profile (ICP + offering → Context Setter) ─────────────────────────

export interface SalesProfileFields {
  product_oneliner: string;
  what_we_sell: string;
  icp: string;
  buying_roles: string;
  pains_solved: string;
  disqualifiers: string;
}
/** The Context Setter's structured understanding of the seller. */
export interface SellerContextView {
  product_summary: string;
  value_props: string[];
  icp_industries: string[];
  icp_sizes: string;
  icp_geos: string[];
  business_models: string[];
  buying_committee: { role: string; why: string }[];
  pains_solved: string[];
  signals_to_watch: string[];
  disqualifiers: string[];
  default_focus_hint: string;
}
export interface SalesProfileResponse {
  success: boolean;
  hasProfile: boolean;
  profile: SalesProfileFields;
  derived: SellerContextView | null;
  derivedAt: string | null;
  /** Days after an unanswered outreach email a prospect surfaces in LinkedIn follow-ups. */
  followUpWindowDays: number;
}
export function getSalesProfile() {
  return request<SalesProfileResponse>('/api/sales-profile');
}
export function saveSalesProfile(profile: SalesProfileFields) {
  return request<SalesProfileResponse>('/api/sales-profile', { method: 'PUT', body: JSON.stringify(profile) });
}
/** Set the follow-up window (days). Server clamps to a sane range. */
export function saveFollowUpWindow(days: number) {
  return request<{ success: boolean; followUpWindowDays: number }>(
    '/api/sales-profile/follow-up-window', { method: 'PUT', body: JSON.stringify({ days }) }
  );
}
/** Run the Context Setter now and return how the engine reads the profile. */
export function previewSalesProfile() {
  return request<{ success: boolean; derived: SellerContextView | null; message?: string }>(
    '/api/sales-profile/preview', { method: 'POST' }
  );
}

export interface ProspectPostGroup {
  prospectId: string;
  name: string;
  title: string;
  linkedinUrl: string;
  postCount: number;
  posts: LinkedinPost[];
}
/** The company's listed prospects, each with their scraped posts (grouped by person). */
export function fetchCompanyProspectPosts(runId: string, companyName: string) {
  return request<{ success: boolean; prospects: ProspectPostGroup[]; totalPosts: number }>(
    `/api/lead-funnel/runs/${runId}/companies/${encodeURIComponent(companyName)}/prospect-posts`
  );
}

export interface OutreachLogRecord {
  _id: string;
  jobTitle: string;
  prospectName: string;
  prospectCompany: string;
  status: 'sent' | 'failed' | 'pending' | 'skipped' | string;
  errorMessage?: string | null;
  updatedAt: string | null;
}
export interface OutreachLogsResponse {
  success: boolean;
  summary: { sent: number; failed: number; pending: number; skipped: number; replied?: number };
  total: number;
  records: OutreachLogRecord[];
}
export function fetchOutreachLogs(runId: string) {
  return request<OutreachLogsResponse>(`/api/lead-funnel/runs/${runId}/outreach-logs`);
}

// ── Overview (aggregated dashboard) ─────────────────────────────────────────
export interface RunOverview {
  success: boolean;
  companies: {
    total: number;
    contacted: number;
    signal: { green: number; yellow: number; orange: number; red: number; notAnalyzed: number };
    size: { small: number; medium: number; large: number };
    topLocations: { name: string; count: number }[];
  };
  prospects: {
    total: number;
    withEmail: number;
    byLevel: { csuite: number; vp: number; head: number; director: number; other: number };
  };
  outreach: { sent: number; failed: number; pending: number; skipped: number; replied: number };
  funnel: { companies: number; prospects: number; withEmail: number; emailed: number; replied: number };
  recent: { name: string; company: string; status: string; at: string | null }[];
}
export function fetchRunOverview(runId: string) {
  return request<RunOverview>(`/api/lead-funnel/runs/${runId}/overview`);
}

export function fetchEmailPreview(runId: string, prospectId: string, templateId?: string | null) {
  const q = new URLSearchParams({ prospectId });
  if (templateId) q.set('templateId', templateId);
  return request<{ success: boolean; html?: string; subject?: string; persona?: string; industry?: string; gender?: 'male' | 'female' | 'unknown'; error?: string }>(
    `/api/lead-funnel/runs/${runId}/preview-email?${q}`
  );
}

// ── Enrichment + AI signal (companies & people) ─────────────────────────────
export interface LinkedinPost {
  urnId: string;
  text: string;
  postedAt: string;
  reactions: { total: number; like: number; praise: number; appreciation: number; empathy: number; interest: number; maybe: number };
  comments: number;
  shares: number;
  mediaType: string;
  hashtags: string[];
  language: string;
  postUrl?: string;
}

export interface CompanyDetails {
  _id: string; companyName: string; companyLinkedin: string; linkedinSlug: string;
  runId: string; posts: LinkedinPost[]; postCount: number; enrichmentCount: number; aiSignal?: AISignal;
}
export interface PersonDetails {
  _id: string; prospectId: string; fullName: string; linkedinUrl: string; linkedinSlug: string;
  runId: string; posts: LinkedinPost[]; postCount: number; enrichmentCount: number;
}

export interface EnrichmentStatus {
  success: boolean;
  enrichment: {
    _id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: { post_count: number; enrichment_count: number; was_updated: boolean };
    errorMessage?: string;
  };
}

export function fetchCompanyDetails(companyName: string) {
  return request<{ success: boolean; company: CompanyDetails | null }>(
    `/api/lead-funnel/companies/${encodeURIComponent(companyName)}/details`
  ).catch(err => {
    // Backend 404s when not enriched yet — treat as "no details".
    if (err instanceof Error && /not found|404/i.test(err.message)) return { success: false, company: null as CompanyDetails | null };
    throw err;
  });
}

export function enrichCompany(companyName: string, runId: string, numPosts = 5) {
  return request<{ success: boolean; enrichmentId: string }>(
    `/api/lead-funnel/companies/${encodeURIComponent(companyName)}/enrich?run_id=${runId}`,
    { method: 'POST', body: JSON.stringify({ num_posts: numPosts }) }
  );
}

export function analyzeCompanySignal(companyName: string) {
  return request<{ success: boolean; aiSignal: AISignal; companyName: string }>(
    `/api/lead-funnel/companies/${encodeURIComponent(companyName)}/analyze-signal`,
    { method: 'POST' }
  );
}

export function fetchPersonDetails(prospectId: string) {
  return request<{ success: boolean; person: PersonDetails | null }>(
    `/api/lead-funnel/people/${encodeURIComponent(prospectId)}/details`
  ).catch(err => {
    if (err instanceof Error && /not found|404/i.test(err.message)) return { success: false, person: null as PersonDetails | null };
    throw err;
  });
}

export function enrichPerson(prospectId: string, runId: string, numPosts = 5) {
  return request<{ success: boolean; enrichmentId: string }>(
    `/api/lead-funnel/people/${encodeURIComponent(prospectId)}/enrich?run_id=${runId}`,
    { method: 'POST', body: JSON.stringify({ num_posts: numPosts }) }
  );
}

export function getEnrichmentStatus(enrichmentId: string) {
  return request<EnrichmentStatus>(`/api/lead-funnel/enrichments/${enrichmentId}/status`);
}

// ── LinkedIn board (My-Tasks "LinkedIn" tab) ────────────────────────────────
export type LinkedInStatus =
  | 'needs_url' | 'url_sourced' | 'invite_sent' | 'connected' | 'messaged' | 'failed';

export interface LinkedInState {
  status: LinkedInStatus;
  profileUrl?: string | null;
  urnId?: string | null;
  draftMessage?: string | null;
  error?: string | null;
  invitedAt?: string | null;
  connectedAt?: string | null;
  lastMessageAt?: string | null;
  lastIntentScrapeAt?: string | null;
}

export interface LinkedInActivity {
  status: LinkedInStatus;
  accountUserId?: string | null;
  accountUsername?: string | null;
  inviteMessage?: string | null;
  inviteSentAt?: string | null;
  acceptedAt?: string | null;
  message?: string | null;
  messageSentAt?: string | null;
}

/** Read recorded LinkedIn activity; unlike the draft endpoint, never renders a template. */
export function fetchLinkedInActivity(prospectId: string, runId: string) {
  return request<{ success: boolean } & LinkedInActivity>(
    `/api/lead-funnel/people/${encodeURIComponent(prospectId)}/linkedin/activity?run_id=${encodeURIComponent(runId)}`
  );
}

/** Why a prospect is in the follow-up list: emailed this long ago with no reply. */
export interface FollowUpSignal {
  emailedAt: string | null;
  daysSince: number | null;
  subject: string;
}

export interface LinkedInProspect {
  id: string;
  runId: string;
  firstName?: string;
  lastName?: string;
  name: string;
  title?: string;
  companyName?: string;
  /** Parent campaign metadata for standalone accepted-invite cards. */
  campaignId?: string | null;
  campaignName?: string | null;
  runName?: string | null;
  linkedin: LinkedInState;
  hasIntent?: boolean;
  hasProfile?: boolean;
  /** Present only on prospects returned by the follow-ups endpoint. */
  followUp?: FollowUpSignal;
  /** Worklist task state (`pending` | `done`) — present only on My-Tasks worklist rows. */
  taskStatus?: 'pending' | 'done';
  /** Live send-queue state for this prospect's LinkedIn invite, when one is pending. */
  queueStatus?: 'queued' | 'sending' | null;
}

export interface LinkedInAccount {
  companyName: string;
  industry?: string | null;
  companySize?: string | null;
  companyDomain?: string | null;
  companyLinkedin?: string | null;
  location?: string | null;
  selectionStatus?: 'selected' | 'rejected' | null;
  selectionReason?: string | null;
  runId: string;
  /** Parent campaign (for grouping/labelling on the board). */
  campaignId?: string | null;
  campaignName?: string | null;
  /** Run display name — fallback group label when there is no campaign. */
  runName?: string | null;
  prospectCount: number;
  statusRollup: Record<LinkedInStatus, number>;
  prospects: LinkedInProspect[];
}

export interface LinkedInAccountsResponse {
  success: boolean;
  accounts: LinkedInAccount[];
  recentlyConnected: LinkedInProspect[];
  total: number;
  page: number;
  pages: number;
}

/** Company-level accounts + their prospects' LinkedIn lifecycle state. */
export function fetchLinkedInAccounts(campaignId?: string | null, page = 1, limit = 20, search?: string) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (campaignId) q.set('campaignId', campaignId);
  if (search) q.set('search', search);
  return request<LinkedInAccountsResponse>(`/api/lead-funnel/linkedin/accounts?${q}`);
}

export interface LinkedInFollowUpsResponse {
  success: boolean;
  accounts: LinkedInAccount[];   // each prospect carries a `followUp` signal
  windowDays: number;
}
/** Accounts to chase on LinkedIn: emailed ≥window days ago with no reply. */
export function fetchLinkedInFollowUps(campaignId?: string | null) {
  const q = new URLSearchParams();
  if (campaignId) q.set('campaignId', campaignId);
  const qs = q.toString();
  return request<LinkedInFollowUpsResponse>(`/api/lead-funnel/linkedin/follow-ups${qs ? `?${qs}` : ''}`);
}

export interface LinkedInWorklistResponse {
  success: boolean;
  date: string;
  /** Sum of each active campaign's per-day LinkedIn goal for today. */
  goal: number;
  /** Invites already sent today (tasks marked done). */
  done: number;
  remaining: number;
  /** Invite candidates bounded to the day's per-campaign goal; each prospect
   *  carries a `linkedin` lifecycle state and a `taskStatus`. */
  accounts: LinkedInAccount[];
  windowDays: number;
}

/** Today's bounded LinkedIn *invite* worklist — only the day's per-campaign goal
 *  worth of invite candidates, not every follow-up prospect at once. */
export function fetchLinkedInWorklist() {
  return request<LinkedInWorklistResponse>(`/api/lead-funnel/linkedin/my-tasks/today?tzOffset=${tzOffset()}`);
}

/** Skip a prospect from today's LinkedIn worklist; refills the freed slot with the
 *  next invite candidate from the same campaign. */
export function skipLinkedInTask(prospectId: string) {
  return request<LinkedInWorklistResponse>('/api/lead-funnel/linkedin/my-tasks/skip', {
    method: 'POST',
    body: JSON.stringify({ prospectId, tzOffset: tzOffset() }),
  });
}

/** Mark a prospect's LinkedIn invite task done for today. The task keeps its slot
 *  and counts toward the day's goal (`done` increments) — unlike skip. */
export function markLinkedInTaskDone(prospectId: string) {
  return request<LinkedInWorklistResponse>('/api/lead-funnel/linkedin/my-tasks/done', {
    method: 'POST',
    body: JSON.stringify({ prospectId, tzOffset: tzOffset() }),
  });
}

/** Live-sync accepted invites from the caller's own LinkedIn connections. */
export function syncLinkedInAccepted(campaignId?: string | null) {
  const q = new URLSearchParams();
  if (campaignId) q.set('campaignId', campaignId);
  const qs = q.toString();
  return request<{ success: boolean; matched: number; connections: number }>(
    `/api/lead-funnel/linkedin/sync-accepted${qs ? `?${qs}` : ''}`, { method: 'POST' }
  );
}

/** Render an invite note or DM draft for a prospect (server-side token fill). */
export function fetchLinkedInDraft(
  prospectId: string, runId: string, type: 'invite' | 'message', templateId?: string | null,
) {
  const q = new URLSearchParams({ run_id: runId, type });
  if (templateId) q.set('templateId', templateId);
  return request<{ success: boolean; type: string; draft: string; templateConfigured?: boolean }>(
    `/api/lead-funnel/people/${encodeURIComponent(prospectId)}/linkedin/draft?${q}`
  );
}

/** Find + persist a LinkedIn profile URL for a prospect (name + company search). */
export function sourceLinkedInUrl(prospectId: string, runId: string) {
  return request<{ success: boolean; profileUrl: string; status: LinkedInStatus; matchedName?: string }>(
    `/api/lead-funnel/people/${encodeURIComponent(prospectId)}/linkedin/source-url?run_id=${runId}`,
    { method: 'POST' }
  );
}

/** Send a connection request (human-triggered). */
export function sendLinkedInInvite(prospectId: string, runId: string, note?: string, templateId?: string | null) {
  const body: Record<string, unknown> = {};
  if (note != null) body.note = note;
  if (templateId) body.templateId = templateId;
  // Default path enqueues and returns status:"queued"; the worker sends it and the
  // lifecycle status advances to invite_sent later.
  return request<{ success: boolean; status: LinkedInStatus | 'queued'; noteDropped?: boolean; message?: string }>(
    `/api/lead-funnel/people/${encodeURIComponent(prospectId)}/linkedin/invite?run_id=${runId}`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

/** Poll whether the invite was accepted (distance == 1st degree). */
export function checkLinkedInConnection(prospectId: string, runId: string) {
  return request<{ success: boolean; connected: boolean; status: LinkedInStatus }>(
    `/api/lead-funnel/people/${encodeURIComponent(prospectId)}/linkedin/check-connection?run_id=${runId}`,
    { method: 'POST' }
  );
}

/** Send a DM to a connected prospect. */
export function sendLinkedInMessage(prospectId: string, runId: string, message?: string, templateId?: string | null) {
  const body: Record<string, unknown> = {};
  if (message != null) body.message = message;
  if (templateId) body.templateId = templateId;
  return request<{ success: boolean; status: LinkedInStatus }>(
    `/api/lead-funnel/people/${encodeURIComponent(prospectId)}/linkedin/message?run_id=${runId}`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export interface LinkedInIntentResponse {
  success: boolean;
  fullName?: string;
  linkedinUrl?: string;
  posts: LinkedinPost[];
  postCount: number;
  lastEnrichedAt: string | null;
}

/** Real-time intent = the prospect's latest scraped LinkedIn posts. */
export function fetchLinkedInIntent(prospectId: string) {
  return request<LinkedInIntentResponse>(
    `/api/lead-funnel/people/${encodeURIComponent(prospectId)}/linkedin/intent`
  );
}

// ── Communication history (unified email + LinkedIn timeline) ────────────────
export type CommChannel = 'email' | 'linkedin';
export type CommEventType =
  | 'email_sent' | 'email_reply' | 'email_failed'
  | 'invite_sent' | 'invite_accepted' | 'message_sent';

export interface CommEvent {
  channel: CommChannel;
  type: CommEventType;
  /** ISO timestamp, or null when unknown. */
  at: string | null;
  status: string;
  subject: string;
  snippet: string;
  from: string;
  accountUsername?: string | null;
  accountUserId?: string | null;
}

export interface CommHistoryResponse {
  events: CommEvent[];
}

export function fetchCommunicationHistory(prospectId: string, runId?: string | null) {
  const q = runId ? `?runId=${encodeURIComponent(runId)}` : '';
  return request<CommHistoryResponse>(
    `/api/lead-funnel/prospects/${encodeURIComponent(prospectId)}/communication-history${q}`
  );
}

/** Trigger a fresh post scrape (reuses the person-enrichment endpoint). */
export function refreshLinkedInIntent(prospectId: string, runId: string, numPosts = 10) {
  return enrichPerson(prospectId, runId, numPosts);
}

// ── Full LinkedIn profile via Apify (collapsible Profile section) ────────────
export interface LinkedInResumeExperience {
  title?: string; company_name?: string; location?: string; employment_type?: string;
  description?: string; summary?: string; skills?: string[];
  starts_at?: string | null; ends_at?: string | null; is_current?: boolean;
}
export interface LinkedInResumeEducation {
  school_name?: string; degree_name?: string; field_of_study?: string;
  starts_at?: string | null; ends_at?: string | null;
}
export interface LinkedInResume {
  fullName?: string; headline?: string; summary?: string; location?: string;
  currentTitle?: string; currentCompany?: string; totalYears?: number | null;
  skills?: string[]; titles?: string[];
  experience?: LinkedInResumeExperience[];
  education?: LinkedInResumeEducation[];
  certifications?: { name?: string; authority?: string }[];
  languages?: { name?: string; proficiency?: string }[];
}
export interface LinkedInProfileDoc {
  prospectId: string;
  linkedinUrl?: string;
  publicIdentifier?: string | null;
  memberUrn?: string | null;      // ACoAA… fsd_profile URN
  objectUrn?: string | null;
  connectionsCount?: number | null;
  followerCount?: number | null;
  openToWork?: boolean | null;
  hiring?: boolean | null;
  profilePicture?: unknown;
  profile?: LinkedInResume;
  contact?: { email?: string | null; linkedin?: string | null };
  enrichedAt?: string | null;
}

/** Fetch the FULL profile via Apify (also captures the member URN for invites). */
export function enrichLinkedInProfile(prospectId: string, runId: string) {
  return request<{ success: boolean; profile: LinkedInProfileDoc; hasUrn: boolean }>(
    `/api/lead-funnel/people/${encodeURIComponent(prospectId)}/linkedin/enrich-profile?run_id=${runId}`,
    { method: 'POST' }
  );
}

/** Read the stored Apify profile for the collapsible Profile section. */
export function fetchLinkedInProfile(prospectId: string) {
  return request<{ success: boolean; profile: LinkedInProfileDoc | null }>(
    `/api/lead-funnel/people/${encodeURIComponent(prospectId)}/linkedin/profile`
  );
}

// ── Integrations (Settings → Integrations) ──────────────────────────────────
// Credentials are encrypted at rest server-side; these endpoints never return
// the stored password — only the connection status.
export type IntegrationStatus =
  | 'unverified' | 'connected' | 'reauth_required' | 'error' | null;

export interface LinkedInIntegrationStatus {
  connected: boolean;
  username: string | null;
  status: IntegrationStatus;
  /** How the user connected: 'cookies' (Browser Use login) or legacy 'password'. */
  authMethod?: 'password' | 'cookies' | null;
  lastVerifiedAt?: string | null;
  cookiesCapturedAt?: string | null;
  lastError?: string | null;
  updatedAt?: string | null;
}

/** A Browser Use login session the user completes in an embedded live browser. */
export interface LinkedInLoginSession {
  sessionId: string;
  liveUrl: string;
  expiresAt?: string | null;
}

/** Current LinkedIn connection status for the signed-in user (no secrets). */
export function getLinkedInIntegration() {
  return request<LinkedInIntegrationStatus>('/api/integrations/linkedin');
}

/** Start a passwordless login: opens a Browser Use browser (returns the live URL
 *  to embed) that the user logs into LinkedIn in. No credentials touch us. */
export function startLinkedInLogin(proxyCountry?: string) {
  return request<LinkedInLoginSession>('/api/integrations/linkedin/login/start', {
    method: 'POST',
    body: JSON.stringify(proxyCountry ? { proxyCountry } : {}),
  });
}

/** After the user logs in, harvest + validate the cookies and store them.
 *  Rejects with a 409-flavoured error while the login isn't finished yet. */
export function completeLinkedInLogin(sessionId: string) {
  return request<LinkedInIntegrationStatus>('/api/integrations/linkedin/login/complete', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

/** Abort an in-progress login and stop the (billable) Browser Use session. */
export function cancelLinkedInLogin(sessionId: string) {
  return request<{ success: boolean }>('/api/integrations/linkedin/login/cancel', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

/** Save + immediately verify LinkedIn credentials. Password is encrypted server-side. */
export function saveLinkedInIntegration(username: string, password: string) {
  return request<LinkedInIntegrationStatus>('/api/integrations/linkedin', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

/** Re-test the stored credentials (Reconnect). */
export function verifyLinkedInIntegration() {
  return request<LinkedInIntegrationStatus>('/api/integrations/linkedin/verify', {
    method: 'POST',
  });
}

/** Delete the stored LinkedIn credentials. */
export function disconnectLinkedInIntegration() {
  return request<{ success: boolean }>('/api/integrations/linkedin', {
    method: 'DELETE',
  });
}

// ── My Tasks (persisted cross-campaign daily email worklist) ─────────────────
// The Emails tab of My Tasks. The backend seeds ~5 highest-signal un-emailed
// companies per day across every campaign the user can access; completing (an
// email was sent) or removing one refills the next-best company.

export type DailyTaskSignal = 'green' | 'yellow' | 'orange' | 'red' | null;

export interface DailyTaskProspect {
  id: string;
  runId: string;
  firstName?: string | null;
  lastName?: string | null;
  name: string;
  title?: string | null;
  email?: string | null;
  hasEmail: boolean;
  /** True once an email has been sent (or is mid-send) to this specific person.
   *  The company closes only when every emailable prospect is `sent`. */
  sent?: boolean;
  /** Live send-queue state for this prospect's email, when one is pending. */
  queueStatus?: 'queued' | 'sending' | null;
  linkedinUrl?: string | null;
  location?: string | null;
  selectionStatus?: 'selected' | 'rejected' | null;
  /** The model's stated reason for selecting or rejecting this person. */
  selectionReason?: string | null;
  /** Seniority tier the model placed them in, e.g. "Tier 1". */
  selectionTier?: string | null;
  /** Their rank within the company when selected. */
  selectionRank?: number | null;
  /** True when a person overrode the model's decision by hand. */
  selectionManual?: boolean;
}

export interface DailyTask {
  companyName: string;
  runId: string | null;
  /** The campaign this company belongs to (null for orphan/legacy runs). */
  campaignId?: string | null;
  campaignName?: string | null;
  /** Run display name — fallback label when there is no campaign. */
  runName?: string | null;
  /** Which campaign system this company came from. Sending is only wired for lead_funnel. */
  source?: 'lead_funnel' | 'hr';
  status: 'pending' | 'done' | 'removed';
  addedBy: 'auto' | 'manual';
  signal: DailyTaskSignal;
  completedAt: string | null;
  industry?: string | null;
  companyDomain?: string | null;
  companyLinkedin?: string | null;
  companySize?: string | null;
  location?: string | null;
  prospects: DailyTaskProspect[];
}

/** A replied prospect surfaced in the inline Responses rail — open the thread
 *  via fetchOutreachReplyDetail(outreachId). */
export interface DailyResponse {
  outreachId: string;
  prospectId: string | null;
  prospectName: string;
  title?: string | null;
  companyName?: string | null;
  campaignName?: string | null;
  subject: string;
  snippet: string;
  repliedAt: string | null;
}

export interface MyTasksToday {
  success: boolean;
  date: string;
  /** EMAILS targeted today (summed per-campaign weekly-plan target). */
  goal: number;
  /** EMAILS completed today — the only field comparable to `goal`. A company counts
   *  min(2, its emailable prospects), so this is NOT the number of cards done. */
  doneEmails?: number;
  /** COMPANIES completed today (how many cards are struck through). Do not compare
   *  this against `goal`: a 20-email goal seeds only ~10 companies, so it can never
   *  reach it. Optional-chained via `doneEmails` everywhere progress is shown. */
  done: number;
  /** Companies on today's board (pending + done). */
  companyCount?: number;
  /** Emails still to send today (goal - doneEmails). */
  remaining: number;
  streak: number;
  /** Today's per-channel targets from the weekly plan (email mirrors `goal`). */
  channelGoals?: { email: number; linkedin: number; calls: number };
  tasks: DailyTask[];
  responses: DailyResponse[];
}

/** Minutes to add to local time to reach UTC (JS convention; IST = -330). */
function tzOffset(): number {
  return typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0;
}

/** Today's worklist + counters + streak + replied prospects. Seeds on first call. */
export function fetchMyTasksToday() {
  return request<MyTasksToday>(`/api/lead-funnel/my-tasks/today?tzOffset=${tzOffset()}`);
}

/** Per-day actuals for the current work-week (companies emailed + LinkedIn invites
 *  done), cross-campaign. Read-only — does not seed the worklist. */
export interface WeeklyProgressDay {
  date: string;
  weekday: number;   // 0 = Mon … 6 = Sun
  isToday: boolean;
  emailDone: number;
  linkedinDone: number;
}
export interface WeeklyProgress {
  success: boolean;
  weekStart: string;
  today: string;
  days: WeeklyProgressDay[];
  emailWeekDone: number;
  linkedinWeekDone: number;
}
export function fetchWeeklyProgress() {
  return request<WeeklyProgress>('/api/lead-funnel/my-tasks/weekly-progress');
}

/** Mark a company's task done (an email was sent) and refill a slot. */
export function completeMyTask(companyName: string, outreachId?: string | null) {
  return request<MyTasksToday>('/api/lead-funnel/my-tasks/complete', {
    method: 'POST',
    body: JSON.stringify({ companyName, tzOffset: tzOffset(), outreachId: outreachId ?? null }),
  });
}

/** Remove a company from today's worklist (won't reappear today) and refill. */
export function removeMyTask(companyName: string) {
  return request<MyTasksToday>('/api/lead-funnel/my-tasks/remove', {
    method: 'POST',
    body: JSON.stringify({ companyName, tzOffset: tzOffset() }),
  });
}

/** Permanently skip a company from My Tasks (until un-skipped on the campaign
 *  screen). Marks the account "Skipped" everywhere and refills the freed slot. */
export function skipMyTask(companyName: string) {
  return request<MyTasksToday>('/api/lead-funnel/my-tasks/skip', {
    method: 'POST',
    body: JSON.stringify({ companyName, tzOffset: tzOffset() }),
  });
}

/** Skip or un-skip a company from the campaign screen. `status: 'skipped'` hides it
 *  from My Tasks; `'active'` restores it. */
export function setCompanyStatus(runId: string, companyName: string, status: 'skipped' | 'active') {
  return request<{ success: boolean; companyName: string; status: string; updated: number }>(
    `/api/lead-funnel/runs/${runId}/companies/${encodeURIComponent(companyName)}/status`,
    { method: 'POST', body: JSON.stringify({ status }) },
  );
}

/** Select or deselect one prospect for today.
 *
 *  This is not cosmetic: automated first contact emails the SELECTED prospects and
 *  nobody else, so this call decides who actually gets contacted from a company.
 *
 *  A company holds at most 2 selections a day. Selecting a third rejects with 409
 *  and a message naming who to deselect first. */
export function setProspectSelection(
  prospectId: string,
  selected: boolean,
  source: 'lead_funnel' | 'hr' = 'lead_funnel',
) {
  return request<MyTasksToday & { selection?: { selectedCount: number; maxPerCompany: number } }>(
    '/api/lead-funnel/my-tasks/prospect-selection',
    {
      method: 'POST',
      body: JSON.stringify({ prospectId, selected, source, tzOffset: tzOffset() }),
    },
  );
}

/** Manual "Add account": pull one more company into today's worklist. */
export function refillMyTasks() {
  return request<MyTasksToday>('/api/lead-funnel/my-tasks/refill', {
    method: 'POST',
    body: JSON.stringify({ tzOffset: tzOffset() }),
  });
}

/** On-demand "Refresh accounts": retire today's un-emailed accounts and reseed a
 *  brand-new set (excluding everything shown today or on any prior day). The same
 *  rotation the daily 08:00 job runs — surfaced so it can be triggered immediately. */
export function rotateMyTasks() {
  return request<MyTasksToday>('/api/lead-funnel/my-tasks/rotate', {
    method: 'POST',
    body: JSON.stringify({ tzOffset: tzOffset() }),
  });
}

/** Rendered draft for an HR/search-campaign prospect (no send). */
export interface HrEmailPreview {
  success: boolean;
  subject?: string;
  html?: string;
  hasEmail?: boolean;
  recipient?: string;
  error?: string;
}
export function fetchHrEmailPreview(prospectId: string) {
  return request<HrEmailPreview>(`/api/lead-funnel/my-tasks/hr/preview?prospectId=${encodeURIComponent(prospectId)}`);
}

/** Send one outreach email to an HR/search-campaign prospect; marks the company done. */
export function sendHrOutreach(prospectId: string) {
  return request<MyTasksToday>('/api/lead-funnel/my-tasks/hr/send', {
    method: 'POST',
    body: JSON.stringify({ prospectId, tzOffset: tzOffset() }),
  });
}

// ── Company intel for the compose panel (overview + facts) ──

export interface CompanyIntelProfile {
  name?: string;
  industry?: string;
  description?: string;
  website?: string;
  headquarters?: string;
  staff_count?: number | null;
  follower_count?: number | null;
  founded_year?: number | null;
  company_type?: string;
  logo_url?: string;
  linkedin_url?: string;
}

/** Company overview + facts, resolved server-side (account-intel → cache →
 *  live Apify profile fetch). `source` says how rich the payload is. */
export interface CompanyIntel {
  company: CompanyIntelProfile | null;
  overview: { summary?: string; headline?: string; talking_points?: string[] } | null;
  buyingSignals: { items?: Array<{ title: string }> } | null;
  source: 'intel' | 'profile' | null;
}

export function fetchCompanyIntel(linkedin: string, name: string) {
  const qs = new URLSearchParams({ linkedin: linkedin || '', name: name || '' });
  return request<CompanyIntel>(`/api/lead-funnel/company-intel?${qs.toString()}`);
}

// ── Scheduler audit log (Settings → Scheduler Health) ────────────────────────
export interface SchedulerRun {
  id: string;
  job: string;
  runKey: string;
  agent?: string | null;
  status: 'started' | 'success' | 'failed' | 'skipped' | 'interrupted';
  host?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  summary?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

/** Recent scheduled-job runs (auto-first-contact, LinkedIn sync, reply sync, job
 *  schedules), newest first — powers the Scheduler Health panel in Settings. */
export function fetchSchedulerAudit(limit = 100, job?: string) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (job) qs.set('job', job);
  return request<{ success: boolean; runs: SchedulerRun[]; jobs: string[] }>(
    `/api/scheduler/audit?${qs.toString()}`
  );
}

/** A workspace-wide scheduled job, not tied to any one campaign (My Tasks refresh,
 *  LinkedIn accepted-invite sync). Fires on a fixed daily cadence for everyone. */
export interface SystemSchedule {
  id: string;
  name: string;
  description: string;
  cadence: string;
  /** 24-hour "HH:MM" local start time in `timezone`. */
  time: string;
  timezone: string;
  scope: string;
}

/** The workspace-wide system schedules, with timings read live from the backend's
 *  scheduler constants — powers the "System schedules" section of the Schedules panel. */
export function fetchSystemSchedules() {
  return request<{ success: boolean; timezone: string; jobs: SystemSchedule[] }>(
    `/api/scheduler/system`
  );
}

// ── Template testing ────────────────────────────────────────────────────────
// A template is only proven once it has been rendered AND delivered: the in-app
// preview is not what the mail server sends. These endpoints render with values you
// supply and send through the same mailbox and Graph call outreach uses.

/** One value a template needs before it can be rendered. */
export interface TemplateTestField {
  field: string;
  label: string;
  /** The exact token spellings this template used — shown so the author can see
   *  which placeholder a value feeds. */
  tokens: string[];
  hasDefault: boolean;
}

/** A mailbox the test can be sent from — one configured sender of a campaign this
 *  template is pinned to. */
export interface TemplateTestSender {
  email: string;
  engine?: string;
  campaignId?: string | null;
  /** The first campaign this sender serves (for a compact label). */
  campaignName?: string | null;
  /** Every campaign this sender serves, when one inbox is shared by several. */
  campaignNames?: string[];
  default?: boolean;
}

export interface TemplateTestInfo {
  success: boolean;
  templateId: string;
  name?: string | null;
  subject?: string | null;
  fields: TemplateTestField[];
  /** Placeholder-shaped tokens the renderer does not understand — typos, caught
   *  here rather than silently stripped at delivery. */
  unknownTokens: string[];
  /** Mailboxes offered to send this test from (campaign-derived). Empty for LinkedIn
   *  and campaign-scoped tests, which already know their sender. */
  senders?: TemplateTestSender[];
  /** Which sender to preselect. */
  senderEmail?: string | null;
  /** LinkedIn only. */
  type?: string | null;
  inviteLimit?: number;
}

export interface TemplateTestResult {
  success: boolean;
  sent?: boolean;
  sender?: string;
  recipient?: string;
  subject?: string;
  body?: string;
  /** LinkedIn only. */
  message?: string;
  length?: number;
  inviteLimit?: number;
  withinInviteLimit?: boolean;
  warning?: string;
  emailedTo?: string;
  templateName?: string;
}

export function fetchTemplateTestInfo(templateId: string) {
  return request<TemplateTestInfo>(`/api/lead-funnel/templates/${templateId}/test-info`);
}

export function sendTemplateTest(
  templateId: string,
  body: { recipient: string; values: Record<string, string>; senderEmail?: string; send?: boolean },
) {
  return request<TemplateTestResult>(`/api/lead-funnel/templates/${templateId}/test-send`, {
    method: 'POST', body: JSON.stringify({ send: true, ...body }),
  });
}

export function fetchLinkedInTemplateTestInfo(templateId: string) {
  return request<TemplateTestInfo>(`/api/lead-funnel/linkedin-templates/${templateId}/test-info`);
}

export function sendLinkedInTemplateTest(
  templateId: string,
  body: { values: Record<string, string>; emailTo?: string; senderEmail?: string },
) {
  return request<TemplateTestResult>(`/api/lead-funnel/linkedin-templates/${templateId}/test-send`, {
    method: 'POST', body: JSON.stringify(body),
  });
}

export function fetchCampaignTestInfo(campaignId: string, templateId?: string) {
  const q = templateId ? `?templateId=${encodeURIComponent(templateId)}` : '';
  return request<TemplateTestInfo & { senderEmail?: string; templateName?: string; pinnedTemplateIds?: string[] }>(
    `/api/lead-funnel/campaigns/${campaignId}/test-send${q}`,
  );
}

export function sendCampaignTest(
  campaignId: string,
  body: { recipient: string; values: Record<string, string>; templateId?: string; send?: boolean },
) {
  return request<TemplateTestResult>(`/api/lead-funnel/campaigns/${campaignId}/test-send`, {
    method: 'POST', body: JSON.stringify({ send: true, ...body }),
  });
}
