'use client';

// ── Types mirroring the backend result_models / report_models ──
export type SrcKind = 'linkedin' | 'web' | 'news' | 'feeds' | 'x';

export interface CompanyProfile {
  slug: string;
  name: string;
  industry: string;
  description: string;
  website: string;
  headquarters: string;
  staff_count: number | null;
  follower_count: number | null;
  founded_year?: number | null;
  company_type?: string;
  specialities: string[];
  logo_url: string;
  linkedin_url: string;
}

export interface BuyingSignalItem {
  src: SrcKind;
  title: string;
  when: string;
  tag: string;
  highlight: boolean;
  sub?: string | null;
  url: string;
}
export interface BuyingSignalsResult {
  signal: 'green' | 'yellow' | 'orange' | 'red';
  signal_label: string;
  signal_summary: string;
  items: BuyingSignalItem[];
}

export interface LeadershipHire { name: string; title: string; from_company: string; start: string }
export interface Promotion { name: string; from_role: string; to_role: string; when: string }
export interface HiringMetric { label: string; value: string; detail: string }
export interface SourceRef { label: string; url: string }
export interface HiringTrendsResult {
  derived: boolean;
  hires: LeadershipHire[];
  promotions: Promotion[];
  metrics: HiringMetric[];
  sources: SourceRef[];
  summary: string;
}

export interface IntentItem {
  src: SrcKind;
  name: string;
  role: string;
  title: string;
  hl: string;
  posted: string;
  likes: string;
  comments: string;
  url: string;        // the POST url
  photo?: string;     // the person's profile picture (from the Apify actor)
  person_url?: string; // the PERSON's LinkedIn profile (≠ the post url)
}
export interface RealTimeIntentResult { intents: IntentItem[]; summary: string }

// ── Deep sections ──
export interface OverviewBrief {
  temperature: 'hot' | 'warm' | 'cold';
  score: number;
  headline: string;
  summary: string;
  talking_points: string[];
  recommended_actions: string[];
}
export interface JobDepartment { name: string; open_count: number }
export interface JobRole { title: string; team: string; location: string }
export interface JobPostingsResult {
  total_open_roles: number;
  departments: JobDepartment[];
  sample_roles: JobRole[];
  top_department: string;
  velocity: string;
  tech_hints: string[];
  signals: string[];
  source_url: string;
  summary: string;
}
export interface ReviewSource { title: string; url: string; snippet: string }
export interface ReviewsResult {
  rating: number | null;
  review_count: number;
  pros: string[];
  cons: string[];
  feature_gaps: string[];
  sentiment: string;
  switch_triggers: string[];
  sales_angles: string[];
  sources: ReviewSource[];
  g2_url: string;
  summary: string;
}
export interface Topic {
  label: string;
  trend: 'rising' | 'steady' | 'new' | 'fading' | '';
  mentions: number;
  outreach_angle: string;
  evidence_urls: string[];
}
export interface TopicsResult {
  topics: Topic[];
  window_days: number;
  sources_used: string[];
  summary: string;
}
export interface ReportChange {
  kind: string;
  summary: string;
  detail: string;
  direction: 'up' | 'down' | 'new' | 'gone' | '';
  evidence_ids: string[];
}

/** A versioned research report — the durable artifact one run produces. */
export interface ResearchReport {
  slug: string;
  version: number;
  status: string;
  run_id: string;
  company: CompanyProfile | null;
  buying_signals: BuyingSignalsResult;
  hiring_trends: HiringTrendsResult;
  real_time_intent: RealTimeIntentResult;
  overview: OverviewBrief | null;
  job_postings: JobPostingsResult | null;
  reviews: ReviewsResult | null;
  topics: TopicsResult | null;
  changes: ReportChange[];
  evidence_ids: string[];
  model_info: Record<string, string>;
  enriched_at: string | null;
  created_at: string | null;
}

export interface VersionInfo {
  version: number;
  status: string;
  enriched_at: string | null;
  run_id: string;
  change_count: number;
}

export interface ProgressEvent { stage: string; message: string }

export interface ResearchHandlers {
  onJob?: (jobId: string) => void;
  onProgress?: (e: ProgressEvent) => void;
  onCompany?: (c: CompanyProfile) => void;
  /** `result` is a SINGLE section's result keyed by `stage` — see PARTIAL_KEY. */
  onPartial?: (stage: string, result: unknown) => void;
  onComplete?: (result: ResearchReport) => void;
  onError?: (message: string) => void;
}

export const EMPTY_REPORT: ResearchReport = {
  slug: '', version: 0, status: '', run_id: '',
  company: null,
  buying_signals: { signal: 'orange', signal_label: '', signal_summary: '', items: [] },
  hiring_trends: { derived: true, hires: [], promotions: [], metrics: [], sources: [], summary: '' },
  real_time_intent: { intents: [], summary: '' },
  overview: null, job_postings: null, reviews: null, topics: null,
  changes: [], evidence_ids: [], model_info: {},
  enriched_at: null, created_at: null,
};

/** SSE `partial` stage → the report field it fills. */
export const PARTIAL_KEY: Record<string, keyof ResearchReport> = {
  overview: 'overview',
  buying: 'buying_signals',
  jobs: 'job_postings',
  reviews: 'reviews',
  topics: 'topics',
  hiring: 'hiring_trends',
  intent: 'real_time_intent',
};

const API_BASE =
  process.env.NEXT_PUBLIC_AGENT_API || 'http://localhost:8000';

export interface CachedCompany {
  slug: string;
  name: string;
  industry: string;
  logo_url: string;
  enriched_at: string | null;
  companyLinkedin?: string;
  cached?: boolean;
}

export interface HealthStatus {
  ok: boolean;
  apify: boolean;
  firecrawl: boolean;
  openai: boolean;
  mongo: boolean;
  model_fast: string;
  model_smart: string;
}

/** Fetch the list of known companies. Never throws — returns [] on failure. */
export async function fetchCompanies(
  signal?: AbortSignal,
): Promise<{ companies: CachedCompany[]; online: boolean }> {
  try {
    const resp = await fetch(`${API_BASE}/api/account-intel/companies`, { signal });
    if (!resp.ok) return { companies: [], online: false };
    const data = await resp.json();
    return { companies: Array.isArray(data.companies) ? data.companies : [], online: true };
  } catch {
    return { companies: [], online: false };
  }
}

/** Health probe. Returns null when the backend is unreachable. */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthStatus | null> {
  try {
    const resp = await fetch(`${API_BASE}/api/account-intel/health`, { signal });
    if (!resp.ok) return null;
    return (await resp.json()) as HealthStatus;
  } catch {
    return null;
  }
}

/** Latest stored report for a company (null when it has never been researched). */
export async function fetchReport(slug: string, signal?: AbortSignal): Promise<ResearchReport | null> {
  try {
    const resp = await fetch(`${API_BASE}/api/account-intel/companies/${encodeURIComponent(slug)}`, { signal });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data.report as ResearchReport) || null;
  } catch {
    return null;
  }
}

/** Version history (newest first). */
export async function fetchVersions(slug: string, signal?: AbortSignal): Promise<VersionInfo[]> {
  try {
    const resp = await fetch(`${API_BASE}/api/account-intel/companies/${encodeURIComponent(slug)}/versions`, { signal });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data.versions) ? data.versions : [];
  } catch {
    return [];
  }
}

/** One specific version of a report. */
export async function fetchVersion(slug: string, version: number, signal?: AbortSignal): Promise<ResearchReport | null> {
  try {
    const resp = await fetch(
      `${API_BASE}/api/account-intel/companies/${encodeURIComponent(slug)}/versions/${version}`, { signal });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data.report as ResearchReport) || null;
  } catch {
    return null;
  }
}

/**
 * Attach to a RUNNING (or finished) job's SSE stream.
 *
 * The stream is resumable: the server replays the job's persisted progress
 * before streaming live events, so re-attaching after a reload shows the whole
 * run instead of re-triggering research. Returns a detach function.
 */
export function attachToJob(jobId: string, handlers: ResearchHandlers): () => void {
  let done = false;
  const es = new EventSource(`${API_BASE}/api/account-intel/jobs/${jobId}/stream`);

  const on = (name: string, fn: (d: any) => void) =>
    es.addEventListener(name, (ev) => {
      let data: any = {};
      try { data = JSON.parse((ev as MessageEvent).data); } catch { /* ignore */ }
      fn(data);
    });

  on('progress', (d) => handlers.onProgress?.(d));
  on('company', (d) => d.company && handlers.onCompany?.(d.company));
  on('partial', (d) => handlers.onPartial?.(d.stage, d.result));
  on('complete', (d) => { done = true; if (d.result) handlers.onComplete?.(d.result); es.close(); });

  // NOTE: 'error' fires for BOTH a server-sent error event (has .data) and a
  // native connection drop (no .data). Only the former is a real failure; the
  // latter after `done` is just the server closing the finished stream.
  es.addEventListener('error', (ev) => {
    const raw = (ev as MessageEvent).data;
    if (raw) {
      let d: any = {};
      try { d = JSON.parse(raw); } catch { /* ignore */ }
      done = true;
      handlers.onError?.(d.message || 'Research failed');
      es.close();
      return;
    }
    if (!done) {
      handlers.onError?.('Connection to the research stream was interrupted.');
      es.close();
    }
  });

  return () => { done = true; es.close(); };
}

/**
 * Start a background research job, then stream its progress.
 *
 * The API is async-only: POST returns a job_id immediately and progress comes
 * from GET /jobs/{id}/stream, so a long run survives a disconnect.
 * Returns an abort function (detaches the stream; the job keeps running).
 */
export function researchAccount(
  body: { company_linkedin: string; company_website?: string; force_refresh?: boolean },
  handlers: ResearchHandlers,
): () => void {
  const controller = new AbortController();
  let detach: (() => void) | null = null;
  let aborted = false;

  (async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/account-intel/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok) {
        handlers.onError?.(`Request failed (${resp.status})`);
        return;
      }
      const data = await resp.json();
      if (!data?.job_id) { handlers.onError?.('Backend did not return a job id'); return; }
      if (aborted) return;
      handlers.onJob?.(data.job_id);
      detach = attachToJob(data.job_id, handlers);
    } catch (e: any) {
      if (e?.name !== 'AbortError') handlers.onError?.(e?.message || 'Network error');
    }
  })();

  return () => { aborted = true; controller.abort(); detach?.(); };
}
