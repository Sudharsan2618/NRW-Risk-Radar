# Salesforce Sales AI — Research Summary
*Scraped via Firecrawl, June 2026. Raw pages saved alongside this file (01–06).*

## Sources scraped
| File | URL | Notes |
|---|---|---|
| 01-ai-sales-marketing.md | salesforce.com/marketing/ai/ai-sales-marketing/ | Thought-leadership: AI in sales & marketing |
| 02-sales-agents-personas.md | help.salesforce.com … sales_agents_personas | Setup/permissions for Agentforce SDR & Sales Coach |
| 03-einstein-sales-ai.md | salesforce.com/sales/ai/ | **Core: Sales AI / Agentforce Sales feature list** |
| 04-agentforce-pricing.md | salesforce.com/agentforce/pricing/ | Agentforce consumption pricing |
| 05-agentforce-sales.md | salesforce.com/agentforce/sales/ | 404 (redirected) |
| 06-what-is-agentforce.md | salesforce.com/agentforce/what-is-agentforce/ | Agentforce overview |

---

## Salesforce Sales AI — capabilities (from /sales/ai/)

**Agents (autonomous):**
- **Prospecting** — surfaces high-intent accounts with prioritized lists; enriches signals from Salesforce, the web, and 3rd-party sources.
- **Engagement** — engages & qualifies prospects autonomously across web, email, voice; personalized outreach, product Q&A, meeting scheduling; hands qualified leads to sellers.
- **Pipeline Management** — auto-updates fields (stage, next steps); suggestive or automatic mode.
- **Account Management** — researches accounts, builds POVs, updates account plans, preps for meetings.

**Conversation intelligence:**
- **Call Insights** — flags key moments, objections, pricing attitudes, competitor mentions.
- **Call Explorer** — natural-language search across all calls.
- **Sales Signals** — groups topics (objections, pricing, competitors) across the pipeline.

**AI in the flow of work:**
- **Embedded Summarization** — one-click AI summaries for account/opportunity/lead/contact.
- **AI-driven Deal Insights** — opportunity health, lead potential, risk.
- **Predictive Scoring** — forecast accuracy with explainable factors.

**AI sales planning:**
- Territory Optimization Summary, Formula Generation, Segment Generation.

**Data foundation (Data 360):** conversation data, unified customer data, external/unstructured data.

---

## Agentforce SDR & Sales Coach — access requirements (from help article)
- Available **only in Enterprise, Performance, and Unlimited editions** — **with the Agentforce Sales Coach add-on**.
- **Each agent requires a new (paid) user**; assign a specific permission set per agent.
- Roles to configure: **Sales Agents** (the agent user), **Agent Managers** (configure), **Agent Users** (reps who use it).
- Permission sets: "Agentforce SDR Agent", "Configure Agentforce SDR Agent", "Use Agentforce SDR Agent", etc.
- **Takeaway:** autonomous sales AI is gated behind top editions + add-on + per-agent licenses + admin permission-set setup.

---

## Pricing

**Sales Cloud editions** (USD / user / month, billed annually):
| Edition | Price |
|---|---|
| Starter Suite | $25 |
| Pro Suite | $100 |
| Enterprise | $165 |
| Unlimited | $330 |
| Einstein 1 / Agentforce Sales | $500 |

**Agentforce consumption pricing** (on top of licenses):
- **Salesforce Foundations** — $0 (limited: Builder, Prompt Builder, Agent Script, Coworker, Vibes).
- **Flex Credits** — **$500 per 100k credits** (pay per action).
- **Conversations** — **$2 per conversation** (customer-facing agents, pre-purchase only).
- Buying models: Pre-Purchase, Pre-Commit, PayGo.

**Takeaway:** meaningful AI usage = edition license ($165–$500/user) **plus** consumption charges (credits/conversations). Cost is layered and scales with both seats and usage.

---

## Industry stats cited by Salesforce (page 01)
- **Bain:** end-to-end AI across the sales lifecycle → **>30% increase in win rates**.
- **McKinsey:** leaders anticipate **8%+ revenue gains** from GenAI across commercial functions.
- **Gartner:** **49%** of CSOs say sales' definition of a qualified lead differs greatly from marketing's.

---

## SWARION positioning implications
Salesforce's AI is powerful but **layered, gated, and consumption-metered**: top editions + add-ons + per-agent paid users + admin permission-set configuration + per-action/per-conversation fees. Its prospecting agent still relies on data you feed it and a heavy setup.

SWARION delivers the same autonomous-selling outcomes — prospecting, enrichment, account research, buying signals, outreach — **built-in, self-serve, and open-web-native**, without editions/add-ons/per-agent licenses/consumption metering. The wedge: *AI selling that works on day one, priced simply, for teams that don't have a Salesforce admin.*
