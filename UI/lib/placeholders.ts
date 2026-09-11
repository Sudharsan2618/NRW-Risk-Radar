// Canonical template-placeholder substitution, shared by every preview surface
// (email + LinkedIn). Kept in lockstep with the backend `render_placeholders`
// (services/placeholders.py — the one renderer every backend send/preview path
// funnels through) so what the user previews matches what is actually sent.
//
// Three distinct name tokens the composer offers:
//   {{Prospect_FirstName}} → first name
//   {{Prospect_LastName}}  → last name
//   {{Prospect_Name}}      → full name (first + last)
//   {{Prospect_Company}}   → company
//   {{Title}}              → courtesy honorific (Mr/Ms), formerly {{Alise}}
//   {{JobTitle}}           → the prospect's job title
// Legacy spellings are accepted as aliases so older templates keep rendering.

export interface PlaceholderValues {
  first?: string;
  last?: string;
  company?: string;
  jobTitle?: string;
  /** Courtesy honorific (Mr/Ms). Falls back to the first name when omitted —
   *  the frontend preview has no gender, matching the backend's unknown-gender
   *  fallback. */
  honorific?: string;
}

// Canonical placeholder tokens, exposed so editors can render "insert" chips
// from a single source of truth.
export const PH = {
  FIRST: '{{Prospect_FirstName}}',
  LAST: '{{Prospect_LastName}}',
  FULL: '{{Prospect_Name}}',
  COMPANY: '{{Prospect_Company}}',
  TITLE: '{{Title}}',
  JOB_TITLE: '{{JobTitle}}',
} as const;

/** Courtesy honorific for {{Title}}, mirroring the backend `build_salutation`.
 *  Unknown/absent gender falls back to the first name — a neutral greeting. */
export function honorificFor(gender: string | null | undefined, first: string, lang = 'english'): string {
  const isGerman = (lang || '').toLowerCase().includes('german');
  const g = (gender || '').trim().toLowerCase();
  if (g === 'male' || g === 'm') return isGerman ? 'Herr' : 'Mr';
  if (g === 'female' || g === 'f') return isGerman ? 'Frau' : 'Ms';
  return (first || '').trim();
}

// A placeholder the renderer could not resolve — a typo, or a token nothing
// substitutes. Mirrors the backend's `_LEFTOVER_TOKEN`: deliberately strict, so
// ordinary copy containing a stray brace is never eaten.
const LEFTOVER_TOKEN = /\{\{\s*[A-Za-z_][A-Za-z0-9_ ]{0,48}\}\}/g;

export function substitutePlaceholders(template: string, v: PlaceholderValues): string {
  const first = v.first || '';
  const last = v.last || '';
  const full = `${first} ${last}`.trim() || first;
  const company = v.company || '';
  const jobTitle = v.jobTitle || '';
  const honorific = v.honorific || first;
  // split/join avoids regex-escaping the tokens that contain a space
  // (e.g. "{{Prospect Name}}").
  return (template || '')
    // first name
    .split('{{Prospect_FirstName}}').join(first)
    .split('{{Prospect_First_Name}}').join(first)
    .split('{{FIRST_NAME}}').join(first)
    // last name
    .split('{{Prospect_LastName}}').join(last)
    .split('{{Prospect_Last_Name}}').join(last)
    .split('{{LAST_NAME}}').join(last)
    .split('{{LASTNAME}}').join(last)
    // full name
    .split('{{Prospect_Name}}').join(full)
    .split('{{Prospect Name}}').join(full)
    .split('{{prospect_name}}').join(full)
    .split('{{PROSPECT_NAME}}').join(full)
    // company
    .split('{{Prospect_Company}}').join(company)
    .split('{{Prospect Company}}').join(company)
    .split('{{COMPANY_NAME}}').join(company)
    .split('{{FIRMENNAME}}').join(company)
    // courtesy honorific (Title, ex-Alise)
    .split('{{Title}}').join(honorific)
    .split('{{Alise}}').join(honorific)
    .split('{{alise}}').join(honorific)
    // job title
    .split('{{JOB_POSTED_TITLE}}').join(jobTitle)
    .split('{{JobTitle}}').join(jobTitle)
    .split('{{Job_Title}}').join(jobTitle)
    .split('{{PROSPECT_TITLE}}').join(jobTitle)
    .split('{{Prospect_Title}}').join(jobTitle)
    // links (previews render these inert)
    .split('{{BOOKING_LINK}}').join('#')
    .split('{{UNSUBSCRIBE_LINK}}').join('#')
    // Anything still in {{…}} form is a token nothing substitutes. The backend
    // strips these before delivery, so the preview must strip them too — the
    // author sees the same gap here and can fix the typo before sending.
    .replace(LEFTOVER_TOKEN, '');
}
