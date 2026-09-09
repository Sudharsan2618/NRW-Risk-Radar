SWARION Sales AI  |  Product Design Document

Agamx Technology Solutions GmbH  |  Confidential

# **SWARION**

# **Sales AI Platform**

_SaaS Product Design Document — Grounded to the current build_

Agamx Technology Solutions GmbH  |  Version 2.0  |  2026  |  Confidential

# **1. Document Overview**

## **1.1  Purpose**

This document is the product design specification for Swarion (internal codename "Milo") — a SaaS platform that brings structure, intelligence, and automation to the B2B sales lifecycle: discovering companies and prospects, enriching them with verified contact data, and running multichannel outreach (email + LinkedIn + phone) with an AI co-pilot alongside.

This version describes the application as it exists today — its screens, flows, and behaviours — as a single shared reference for product, design, and engineering.

## **1.2  Design Philosophy**

Swarion's design language is a **calm, light-first, token-driven system** — closer to Asana / Linear than to a dense analyst console. High-contrast typography, a single brand-blue accent, generous whitespace, and **contextual side panels** that surface AI insight and actions without pulling the user off their current screen. A persistent left rail carries primary navigation; workspace controls live in a slim top bar.

## **1.3  Core Design Principles**

- **Activity-First, Not Record-First** — Swarion structures what a rep _does_ (today's tasks, this week's connections), not just what it stores.

- **Progressive Disclosure** — lists stay calm; depth (company dossiers, prospect profiles, AI briefs) opens in side panels and pop-outs on demand.

- **AI as Co-Pilot** — the platform drafts, enriches, scores buying intent, and prepares briefs; the human always sends and decides.

- **Per-User by Design** — outreach acts (LinkedIn invites/messages, email sends) are performed from **each user's own connected accounts**, and their state is scoped to that user — never shared across the team.

- **Credit-Aware** — enrichment (verified email / mobile) consumes metered credits, surfaced inline so reps always see what an action costs and what remains.

- **Organic Pacing** — manual sends are deliberately paced with cooling periods so outreach cadence stays human and account-safe.

## **1.4  Target Users**

|**Role**|**Primary Goal**|**Key Screens**|
|---|---|---|
|Sales Executive|Execute daily selling with structure|My Tasks, Weekly Goals, Campaign → Prospects, Outreach Templates|
|Sales Manager|Monitor campaigns and pipeline health|Dashboard, Inbox, Campaign Overview|
|Revenue Ops / Admin|Configure integrations, enrichment, and targeting|Settings → Integrations, Settings → Sales Profile|

# **2. Information Architecture — Navigation**

Swarion uses a **collapsible left rail** (hover- or click-to-expand) plus a persistent **top App Bar**. The rail has three zones: a fixed **Home** group at the top, a dynamic **Campaigns (Workspace)** list in the middle, and expandable **Market Radar** / **Outreach Hub** accordion sections near the bottom, with **Settings** pinned at the very bottom.

## **2.1  Primary Navigation (Left Rail)**

|**#**|**Section**|**Items**|**Tabs / Sub-views**|
|---|---|---|---|
|**1**|**Home**|Dashboard|_(KPI cards + pipeline funnel)_|
|||Inbox|Campaigns · Team Updates · Agent Log · Notifications|
|||My Tasks|Emails · LinkedIn · Phone Calls|
|||Weekly Goals|_(per-day plan editor)_|
|||AI Assistant (Milo)|_(single chat surface)_|
|**2**|**Campaigns (Workspace)**|New Campaign →|_(picker: Search · Import prospects · Import company)_|
|||Import campaign workspace|Overview · Workflow **(Companies · Prospects)** · Settings|
|||Search campaign workspace|Jobs list → Prospects|
|||Prospects panel _(shared, slide-in)_|All · Accepted · Rejected|
|**3**|**Market Radar**|Market Signals Feed|Buying Signals · Hiring Trends · Real-Time Intent|
|||Competitor Tracker|Buying Signals · Hiring Trends · Real-Time Intent|
|||Account Intelligence|_(company intel with tabs)_|
|**4**|**Outreach Hub**|Email Composer / Templates Library|_(list + editor)_|
|||LinkedIn Composer|_(list + editor)_|
|**5**|**Settings**|Account · Workspace · Billing · Integrations · Sales Profile|Account (Profile · Notifications · Display) · Workspace (Limits · API Keys · Members) · Billing (Billing & Plans) · Integrations (Outlook · LinkedIn · Apollo) · Sales Profile (ICP · Follow-up cadence)|

_Note: The rail auto-collapses when a rep enters a campaign, handing the space to the campaign's own inner navigation._

## **2.2  Top App Bar**

Persistent across screens: global search field, workspace controls, trial/upgrade indicator, and the user avatar / account menu.

## **2.3  New Campaign Picker**

Triggered by the **+** next to "Campaigns". Opens an inline sheet with three entry points:

- **Search** — build an ICP and let the platform discover people via Apollo.

- **Import prospects** — start from a list of people.

- **Import company** — start from target companies and discover the right people inside them.

# **3. Functional Screens — HOME**

## **3.1  Dashboard**

_Default landing screen. Campaign-performance overview._

A calm, card-driven summary of selling performance:

- **Greeting header** — time-of-day greeting with the rep's first name.

- **KPI cards** — Response Rate, Contact Velocity (touches/week), Booking Rate, each with a trend arrow and a one-line context hint.

- **Pipeline funnel** — an area-proportional funnel (New → Contacted → Replied → Meeting → Opportunity) with the goal stage highlighted.

- **Insight cards** — categorised with a small uppercase label, kept visually calm.

## **3.2  Inbox**

_A unified feed of campaign and system activity._ Four tabs:

- **Campaigns** — a live tree of campaigns (both Search and Import) with the outreach emails actually sent from them; selecting a message renders its email preview and thread. The rep can **reply or follow up in-thread from within the app** — the message is sent through the connected mailbox and threaded onto the original conversation, with the rep's own saved signature appended. HR/search-kind threads can still be opened in Outlook.

- **Team Updates** — a team activity feed.

- **Agent Log** — a chronological log of agent actions: leads imported, enriched, qualified, emails generated and sent, replies synced.

- **Notifications** — replies, campaign completions, task assignments, and goal progress.

A dedicated **mail detail** view opens an individual message and its full thread.

## **3.3  My Tasks**

_The rep's daily execution board — the heart of day-to-day selling._

The header shows the week, a weekly connection counter, a **streak** counter, and per-channel **goal rings** (done / goal) driven by the rep's Weekly Goals plan. The whole board **resets once a day at 08:00 CET — the same instant for every user** — so each morning brings a fresh set of accounts to work (see §8.4). Three channel tabs:

**A. Emails tab — daily accounts worklist**
A cross-campaign list of companies to email today. The daily target is the **sum of each accessible campaign's own per-day email goal** (from the Weekly Goals plan). Behaviour:

- The worklist offers **every company that has not yet been fully contacted**, drawn from all of the rep's campaigns — including ones earlier in the list that were previously skipped over — so nothing in the middle is missed. A company the rep **permanently skips** drops out for good (and is reflected on the campaign screen).

- Each company row expands into its **prospects**. The rep picks a contact and the right panel shows the **company overview, AI research bullets, facts & figures**, and an **AI-drafted, tokenised outreach email** for that person, with a template picker (the campaign's pinned templates or the rep's full library) and in-place wording edits.

- Sending is **per prospect**. A company **stays on the list until every one of its contactable prospects has been emailed** — so the rep can work through all four people at an account rather than the company closing after the first send. Each emailed prospect is marked done, and the account clears only when the last one is contacted.

- A **cooling period of 2–3 minutes runs between sends**, shown as a live countdown on the send button, keeping cadence organic (see §8.5).

- An inline **Responses** rail lists threads that are waiting on the rep's reply, newest first; a reply can be composed and sent from here, which moves the thread out of the queue.

**B. LinkedIn tab — live board (per-user)**
The production LinkedIn workflow board:

- **Today's invite worklist** — a per-campaign, per-day list of the invites to send today, bounded by the LinkedIn goal in the Weekly Goals plan.

- **Follow-up accounts** — company rows (expanding into prospect cards) for people the rep emailed who haven't replied within the rep's follow-up window, ready for a LinkedIn touch.

- **Recently Accepted Invites** — people who accepted the rep's invitations, newest first. This list is **refreshed automatically once a day** by reading the rep's own LinkedIn connections (see §8.6); a manual refresh is also available.

- **Right panel** for the selected prospect:
   - **Profile** — a collapsible, auto-enriched LinkedIn profile (headline, experience, education, skills, certifications, connection count).
   - **Real-time intent** — the prospect's latest scraped LinkedIn posts (reactions / comments / shares), refreshable once connected.
   - **Compose / action bar** — contextual to where the prospect is in the flow: source a profile URL, send an invite (with an opt-in **Add Message** note), check whether the invite was accepted, or message a connection.

- A **2–3 minute cooling period** runs between invites; if LinkedIn rate-limits the account, the app automatically enters a longer cooling mode and explains why, so invites are never fired into a limit.

- **Per-user isolation:** every invite / connection / message is performed from **the rep's own connected LinkedIn account** and is visible only to them. A teammate viewing the same prospect sees their own state, never the rep's (see §8.1).

**C. Phone Calls tab — call board**
Replied prospects ready to call plus a prioritised call queue on the left; on the right a **call brief** panel — an exec summary (company + prospect), quick links, a "read before calling" narrative, AI talking points, a during-call reference grid (open signals, best time, likely objection), and a pinned action bar (outcome selector, next step, notes, mark as done).

## **3.4  Weekly Goals**

_The rep's plan of how much to reach out each day._

A per-week plan of **email, LinkedIn, and call targets across the seven weekdays**. The plan is the single source of the per-day numbers shown as goal rings in My Tasks and mirrored in Settings. Editing is forgiving — adjusting an early day can cascade its value to days the rep hasn't hand-tuned — so a week can be shaped quickly. The plan directly drives how many accounts the Emails and LinkedIn worklists seed each day.

## **3.5  AI Assistant — "Milo"**

_A conversational co-pilot for drafting, research, and summaries._

A chat surface where the rep can ask Milo to draft outreach, research prospects, or summarise profiles — a message composer, streamed responses, and a disclaimer that the human sends and decides.

# **4. Functional Screens — SALES CAMPAIGNS**

A campaign is the container for a discovery + outreach effort. Two families exist, both live.

## **4.1  Search Campaigns**

_Start from an ICP; discover people via Apollo._

- **Create** — define the campaign (industry, roles/titles, seniority, geography), owners, and sending identity.

- **Results workspace** — discovered **jobs/roles** expand into **prospects**. Selecting prospects opens the **Prospects panel** (§4.3) for enrichment and email outreach.

## **4.2  Import Campaigns**

_Start from companies or a prospect list._ The campaign detail workspace has its own inner navigation:

**Companies tab** — a list of imported/target companies with size band, location, and prospect count, plus an **AI buying-signal read** of each account — an at-a-glance sense of how ready it is to engage, derived from its recent LinkedIn activity (see §8.3). Each company opens a **company dossier pop-out** (recent LinkedIn posts + the AI signal's rationale), and a signal can be re-analysed on demand.

**Prospects tab** — a filterable list of people (by management level — C-Suite / VP / Head / Director / Other — and by enrichment). Key capabilities:

- **Search again (per company)** — re-run Apollo discovery for one company with an ad-hoc ICP (management level, include/exclude titles, departments). Results are **previewed as candidates** to review and selectively **save** — nothing is written until the rep confirms.

- **Prospects panel** (§4.3) for enrichment + outreach.

**Overview** — an aggregate view of the run: a discovery→outreach funnel (companies → prospects → with email → emailed → replied), buying-signal distribution, seniority mix, and top locations.

**Outreach activity** — a per-run log of the outreach sent for the campaign.

## **4.3  Prospects Panel (Enrichment + Outreach)**

_A slide-in workspace, shared by Search and Import campaigns, for turning a prospect into a contacted lead. Left = prospect list with multi-select; right = the selected prospect's dossier._

### **Enrichment (credit-aware)**

- Reveal a **verified email** or **email + mobile** via Apollo. Costs are metered and shown live as **quota rings** in the header: _Daily Email Limit_, _Daily Mobile Limit_, and a per-job **Mail Limit Per Job**. Buttons disable and explain themselves when a quota is exhausted.

- Mobile numbers can arrive asynchronously (webhook) — the panel polls and updates the number when it lands.

- Bulk enrichment for the whole selection is available from the footer.

### **Outreach email preview**

- A **template picker** (the campaign's pinned templates, or all of the user's templates) renders a live, tokenised email preview for the prospect, with a language tag.

- **Edit content** lets the rep tweak the wording _for this send only_ — layout/format stays locked, and edited prospects are flagged.

- A gender-uncertain greeting surfaces a warning so the salutation can be fixed before sending.

- **Send** dispatches to the whole cross-company selection at once via the connected email identity. Batch sends are paced automatically on the server so consecutive emails go out on an organic cadence.

### **LinkedIn connection (per-user)**

Directly above the email preview, a LinkedIn section lets the rep act on the same prospect:

- **Send invite** by default (a plain invite, which draws on LinkedIn's larger connection quota).

- **Add message** reveals an optional note editor and a picker of the rep's **own LinkedIn templates** (placeholders `{{Prospect_Name}}` / `{{Prospect_Company}}` are filled in live). A note is capped at 300 characters, with the LinkedIn personalised-invite limit called out.

- The invite is sent from the rep's **own connected LinkedIn account**, with a **2–3 minute cooling period** between invites (and a longer automatic back-off if LinkedIn rate-limits the account).

- Guardrails: no LinkedIn URL → the action is disabled; LinkedIn not connected → an inline prompt to connect it in Settings.

# **5. Functional Screens — MARKET RADAR**

## **5.1  Market Signals Feed**

_A feed of external market signals (news, hiring, intent),_ with sub-tabs (signals / hiring / intent) and search.

## **5.2  Competitor Tracker**

_Track a set of competitor companies — news, hiring trends, real-time intent,_ using the same sub-tab pattern.

## **5.3  Account Intelligence**

_Deep intelligence on a target account._ Enter a company (search saved companies, or paste a **LinkedIn slug / URL**, optionally a website) and the platform returns account intelligence with tabs (buying signals and more), backed by a live enrichment service with a visible processing log and a backend health indicator. The analysis is **grounded in the rep's Sales Profile (ICP)** — a context-setting step frames the account against who the rep actually sells to before the intelligence is generated. Analysed companies are cached for quick re-access.

# **6. Functional Screens — OUTREACH HUB**

## **6.1  Email Templates Library**

_(Reached via both "Email Composer" and "Templates Library".)_ A full CRUD library of outreach email templates: name, subject, language, tags, and a rich body with personalisation placeholders (e.g. `{{FIRST_NAME}}`, `{{COMPANY_NAME}}`, `{{JOB_POSTED_TITLE}}`, `{{BOOKING_LINK}}`). Templates are organised by industry/persona and pluggable into any campaign's Prospects panel.

## **6.2  LinkedIn Composer (Templates)**

A deliberately minimal library of LinkedIn message templates — a title and a plain-text body — supporting exactly two placeholders, `{{Prospect_Name}}` and `{{Prospect_Company}}`, substituted at send time. A live preview shows the rendered message. Templates are **scoped to the signed-in user** and feed the "Add message" picker in the LinkedIn invite flow (§4.3).

# **7. Functional Screens — SETTINGS**

Grouped in an inner side nav.

## **7.1  Account**

- **Profile** — name, email, job title, photo, password (identity is live from the signed-in account).

- **Notifications** — email notification toggles.

- **Display** — colour mode (Light / Dark / System), density, language.

## **7.2  Workspace**

- **Limits** — concurrency / usage limits.

- **API Keys** — key management.

- **Members** — team members, from the real workspace roster.

## **7.3  Billing**

- **Billing & Plans** — plan, seats, invoices.

## **7.4  Integrations**

Connector cards:

- **LinkedIn (per-user, passwordless)** — the rep connects LinkedIn by logging in inside a **pop-out live browser window**; the session cookies are captured and validated server-side (no password is ever stored by Swarion) and kept encrypted. The pop-out reports success back to the panel in real time, and the connection can be reconnected or disconnected. **This connection is what authorises that rep's LinkedIn invites and messages** across My Tasks and the Prospects panel.

- **Apollo** — enrichment provider (powers verified email/mobile lookups and prospect discovery).

- **Outlook / Email** — the sending identity for outreach email.

## **7.5  Sales Profile**

The rep's **ideal-customer profile (ICP)** and **follow-up cadence** (how many days to wait before a no-reply becomes a follow-up task). The ICP grounds Account Intelligence (§5.3) and the follow-up window feeds the LinkedIn follow-up worklist (§3.3).

# **8. Cross-Cutting Behaviours**

## **8.1  Per-User LinkedIn Model**

LinkedIn actions are inherently personal: an invite goes out from **your** account, so its state must be **yours**. Swarion stores each prospect's LinkedIn lifecycle (invited / connected / messaged, with timestamps and notes) **per user**, while the profile identity (the person's URL, member URN) is shared as a common fact. Consequences:

- Your board shows only the invites **you** sent. A teammate sees the same prospect as ready to invite until _they_ act.

- Acceptance checks run against each inviter's **own** account.

- If a rep hasn't connected LinkedIn, their LinkedIn actions are safely disabled with a prompt to connect in Settings.

## **8.2  Enrichment & Credits**

Verified email and mobile lookups consume metered credits, tracked at three levels and shown as rings: **Daily Email**, **Daily Mobile**, and **per-Job Mail** quotas. The UI prevents over-spend and explains every disabled state. Credits reset daily.

## **8.3  AI Buying Signals**

Imported companies can be analysed into an **AI buying-signal read** from their recent LinkedIn activity — a concise sense of how ready an account is to engage — surfaced on company rows and dossiers, and grounded by the rep's Sales Profile so the read reflects who they actually sell to. It helps reps prioritise which accounts to work first.

## **8.4  Daily Worklist Reset (08:00 CET)**

The My Tasks email and LinkedIn worklists roll over to a fresh day at **08:00 Europe/Berlin — the same instant for every user, regardless of their own timezone** (and DST-aware). The first time a rep opens the board after the reset, a new day's accounts are seeded automatically; work done the previous day rolls off. The same daily boundary drives the Recently Accepted Invites refresh and the reply reconciliation below.

## **8.5  Send Pacing / Cooling Periods**

To keep outreach human and account-safe, **manual sends are paced**. After each email send, and after each LinkedIn invite, the next send of that channel is held for a random **2–3 minutes** with a live countdown on the button. The cooling period persists across reloads, so it can't be side-stepped by refreshing. If LinkedIn rate-limits an account, the app enters a **longer automatic cooling mode** and surfaces the reason rather than retrying into the limit. Campaign batch email sends are paced on the server in the same spirit.

## **8.6  Reply Capture & Reconciliation**

Prospect replies are captured in near-real-time through Microsoft Graph notifications and threaded onto the outreach record, which powers the Responses rail (§3.3) and the Inbox (§3.2). Because notifications can be missed — and because a rep sometimes replies to a prospect **manually from Outlook** — a **daily reconciliation runs at 08:00 CET**: for each recently active thread it re-reads the whole conversation and merges anything not already recorded (a missed prospect reply, or the rep's own manual reply), then updates the thread accordingly. The result is that a manually-answered thread correctly leaves the "awaiting reply" queue, and a missed reply still surfaces.

# **9. Authentication & Sessions**

- **Login** — email-based sign-in, with SSO/OAuth callback handling.

- **Sign Up** — account creation.

- **Sessions** — the backend mints the application session token and rotates refresh tokens, and a **devices** view lists the account's active sessions.

- **LinkedIn login pop-out** — the dedicated window that hosts the live LinkedIn login for the per-user integration (§7.4).

# **10. Visual Design System**

The app is fully **CSS-variable / token driven** (enabling light & dark theming via the Display setting). Key tokens as actually used:

|**Token**|**Value**|**Usage**|
|---|---|---|
|`--color-brand`|`#4573D2`|Primary actions, active states, links, accents|
|`--color-brand-text`|`#2C4A88`|Text on subtle brand surfaces|
|`--color-brand-subtle`|`#EEF4FF`|Selected rows, chips, accents|
|`--color-bg`|`#FFFFFF`|Page & card background|
|`--color-surface`|`#F6F5F5`|Alternating rows, headers, panels|
|`--color-text-1`|`#1E1F21`|Primary text|
|`--color-success / warning / danger`|semantic greens / ambers / reds|Contextual feedback — form validation, alerts, confirmations|
|`--radius-sm / md / lg / full`|`5px / 7px / 10px / pill`|Cards, inputs, chips, pills|
|Fonts|**Figtree** (UI), **JetBrains Mono** (data)|All UI / numeric & mono text|

Design principles in the code: bordered cards over heavy shadows, uppercase micro-labels with letter-spacing for section captions, brand-tinted icon chips per section, and side panels / pop-outs for depth.

# **11. Future Direction**

The following are on the forward roadmap and not part of the current build. They are captured here as direction, not specification:

- **Prospect Board (Kanban)** — a lifecycle board with drag-and-drop and per-card quick actions.

- **Prospect List View** — a spreadsheet-style table with inline edit, bulk operations, and CSV export.

- **Prospect Profile (deep-dive)** — Overview / Activity / Outreach / Integration-data tabs with an AI co-pilot panel.

- **Sequences** — a visual, multi-channel cadence builder (Email → Wait → LinkedIn → Call) with reply/branch conditions. Today, channels are orchestrated per-prospect through My Tasks and the Prospects panel.

- **Call Planner** — a dedicated pre / during / post-call screen (a working prototype of the concept already lives in My Tasks → Phone Calls).

- **CTA Library** — a reusable library of calls-to-action for outreach.

- **Pipeline** — Overview, Deal View, Forecast, and Win/Loss analysis.

- **Team** — an activity dashboard, rep scorecards, coaching notes, and goal tracking.

- **Reports** — activity and pipeline reporting with a custom report builder.

- **Events Feed** — a stream of market/company events for Market Radar.

- **Command Palette (Cmd/Ctrl-K)** — natural-language quick actions.

- **Admin suite** — workspace configuration, user & role management + teams, a broader integration center (CRM / calendar / intent / telephony / warehouse), automation rules, AI configuration, and audit & compliance.

- **Market Radar** — live data wiring for the Market Signals Feed and Competitor Tracker.

- **Milo** — connecting the AI assistant to the live backend for real drafting and research.

# **12. Appendix — Screen Inventory**

|**ID**|**Screen**|**Section**|
|---|---|---|
|S-01|Dashboard|Home|
|S-02|Inbox (Campaigns / Team Updates / Agent Log / Notifications)|Home|
|S-03|Inbox — Mail detail & in-app reply|Home|
|S-04|My Tasks — Emails worklist|Home|
|S-05|My Tasks — LinkedIn board (per-user)|Home|
|S-06|My Tasks — Phone Calls board|Home|
|S-07|Weekly Goals|Home|
|S-08|AI Assistant (Milo)|Home / Market Radar|
|S-09|New Campaign picker|Campaigns|
|S-10|Search campaign — create|Campaigns|
|S-11|Search campaign — results|Campaigns|
|S-12|Import campaign — Companies|Campaigns|
|S-13|Import campaign — Prospects|Campaigns|
|S-14|Import campaign — Overview|Campaigns|
|S-15|Import campaign — Outreach activity|Campaigns|
|S-16|Prospects panel (enrichment + email + LinkedIn)|Campaigns|
|S-17|Company dossier pop-out|Campaigns|
|S-18|Prospect dossier pop-out|Campaigns|
|S-19|Market Signals Feed|Market Radar|
|S-20|Competitor Tracker|Market Radar|
|S-21|Account Intelligence|Market Radar|
|S-22|Email Templates Library / Composer|Outreach Hub|
|S-23|LinkedIn Composer (Templates)|Outreach Hub|
|S-24|Settings — Account (Profile / Notifications / Display)|Settings|
|S-25|Settings — Workspace (Limits / API Keys / Members)|Settings|
|S-26|Settings — Billing & Plans|Settings|
|S-27|Settings — Integrations (LinkedIn, Apollo, Outlook)|Settings|
|S-28|Settings — Sales Profile (ICP · Follow-up cadence)|Settings|
|S-29|Login / Sign Up / Sessions / LinkedIn login pop-out|Auth|

Version 2.0  |  Agamx Technology Solutions GmbH  |  2026  |  Confidential
