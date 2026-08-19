# NRW Wildfire Risk & Portfolio Impact Radar
## Prototype Plan and Technical Specification

**Purpose:** Build a credible, production-looking prototype for an insurance company that combines public wildfire intelligence with an insured-property portfolio to support risk monitoring, exposure assessment, reinsurance awareness, and claims preparedness.

**Primary demo question:**

> A wildfire is developing in NRW. What do we know, which of our insured properties could be affected, how bad could it get, and what should the insurer do now?

---

## 1. Product Scope

Build a web application with two connected modes.

### 1.1 Risk Radar

Shows wildfire conditions across North Rhine-Westphalia (NRW) using multiple public data sources.

It should answer:

- Where are active or developing wildfire risks?
- Is risk increasing or decreasing?
- What signals contribute to the assessment?
- How confident is the assessment?
- What changed recently?
- What official warnings or corroborating signals exist?

### 1.2 Portfolio Impact

Overlays a synthetic insurer portfolio and answers:

- Which policies are potentially exposed?
- What total insured value (TIV) is in the threat area?
- How does exposure change under alternative scenarios?
- Could the event approach or exceed reinsurance thresholds?
- What claim volumes could result?
- What operational actions should claims, customer service, finance, and reinsurance teams consider?

### 1.3 Main Demonstration Event

Use one historical NRW wildfire as the deterministic showcase event, ideally the recent Hürtgenwald/Gey wildfire.

The application may also support current/live feeds, but the primary demo must remain fully usable offline.

---

## 2. Explicit MVP Boundaries

Do **not** attempt to build:

- A scientific wildfire propagation model
- An actuarially validated catastrophe model
- ML-trained vulnerability curves
- Automated claims decisions
- Production insurer integrations
- Real policyholder PII
- A full Germany-wide multi-peril platform
- A production reinsurance pricing system

Instead, build a transparent **decision-support prototype**.

All scenario and financial outputs should be labelled clearly, for example:

> Indicative scenario estimate — not an actuarial catastrophe-model result.

---

## 3. Source Basis

The original wildfire risk-radar deck identifies the following source categories:

- EU EFFIS / Copernicus
- NASA FIRMS
- DLR fire monitoring
- DWD wildfire/weather data
- NINA / German official warning systems
- German geodata
- NRW regional geodata
- Local fire and police warnings
- Sensor data
- Press releases
- Local radio/news feeds

For the MVP, use only the highest-value sources first.

### 3.1 Tier 1 — Required

#### NASA FIRMS

Purpose:

- Active-fire detections
- Coordinates
- Acquisition time
- Satellite/source
- Confidence/intensity where available

Store observations individually.

#### DWD

Purpose:

- Wildfire danger level
- Wind direction
- Wind speed
- Temperature
- Humidity
- Precipitation where available

DWD supplies both environmental risk context and directional inputs for simple scenarios.

#### NINA / Official Warnings

Purpose:

- Official warnings
- Severity
- Affected geography
- Timestamps
- Warning text

Official warnings should be treated as a strong operational signal.

#### EFFIS / Copernicus

Purpose:

- Wildfire context
- Burned area or perimeter information where accessible
- Historical reference
- Fire-danger and active-fire context

### 3.2 Tier 2 — Optional After MVP

- NRW geodata
- DLR fire monitoring
- Local fire/police releases
- Presseportal
- Local radio
- Climate sensors

Do not allow Tier 2 integrations to delay the core demo.

---

## 4. Core Engineering Principle

### Build the complete demo using fixtures before integrating live APIs.

External APIs fail, change, rate-limit, or become unavailable.

For every source, store one or more known-good responses.

Example:

```text
data/fixtures/
    firms_sample.json
    dwd_sample.json
    nina_sample.json
    effis_sample.geojson
```

Support:

```text
DATA_MODE=demo
```

and:

```text
DATA_MODE=live
```

The entire five-minute executive demo must work offline in `demo` mode.

---

## 5. Recommended Technology Stack

Keep the architecture simple.

### 5.1 Frontend

- Next.js
- TypeScript
- React
- MapLibre GL JS
- Tailwind CSS
- Recharts or ECharts for small charts

### 5.2 Backend

- Python 3.12
- FastAPI
- SQLAlchemy
- GeoPandas
- Shapely
- PyProj
- httpx

### 5.3 Database

- PostgreSQL
- PostGIS

PostGIS should handle core geospatial calculations such as:

- Point-in-polygon
- Distance from event
- Scenario intersections
- Policy aggregation
- TIV aggregation

### 5.4 Jobs

For the prototype:

- APScheduler, cron, or simple scheduled Python jobs

Do not introduce Kafka, Airflow, or similar infrastructure.

### 5.5 Deployment

Possible simple deployment:

```text
Frontend  -> Vercel
Backend   -> Railway / Render / Fly.io
Database  -> Managed PostgreSQL with PostGIS
```

Also support Docker Compose for a self-contained laptop demo.

---

## 6. Repository Structure

Use a monorepo.

```text
risk-radar/
|
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── maps/
│   │   └── api/
│   │
│   └── api/
│       ├── main.py
│       ├── routers/
│       ├── models/
│       ├── schemas/
│       ├── services/
│       └── db/
│
├── pipelines/
│   ├── firms/
│   ├── dwd/
│   ├── effis/
│   ├── nina/
│   └── news/
│
├── analytics/
│   ├── risk_score.py
│   ├── scenarios.py
│   ├── portfolio_exposure.py
│   └── loss_estimation.py
│
├── synthetic/
│   ├── generate_portfolio.py
│   └── generate_reinsurance.py
│
├── data/
│   ├── fixtures/
│   └── demo/
│
├── scripts/
│
├── docker-compose.yml
└── README.md
```

---

## 7. Common Data Model

Normalize all source information into a small internal model.

### 7.1 `risk_events`

```text
id
event_type                wildfire
name
status                    active / contained / closed
severity                  0-100
confidence                0-1
trend                     rising / stable / falling

centroid
current_geometry

started_at
updated_at

primary_source
metadata JSONB
```

### 7.2 `risk_signals`

Every raw observation becomes a signal.

```text
id
event_id

source
signal_type

observed_at
received_at

geometry

value
normalized_score          0-100
confidence                0-1

raw_payload JSONB
source_url
```

Example normalized signals:

```text
FIRMS:
active_fire = 83

DWD:
wildfire_danger = 80

NINA:
official_warning = 100

Weather:
wind_risk = 62
```

### 7.3 `policies`

Synthetic insurer portfolio.

```text
policy_id

location

postal_code
municipality

building_tiv
contents_tiv
total_tiv

property_type
construction_type
year_built

deductible
policy_limit

risk_attributes JSONB
```

### 7.4 `scenarios`

```text
id
event_id

name
severity

wind_direction
wind_speed

duration_hours

geometry

created_at
```

Built-in scenarios:

```text
Current
Adverse
Severe
```

### 7.5 `exposure_snapshots`

```text
id
event_id
scenario_id

timestamp

policies_exposed
total_tiv

building_tiv
contents_tiv

estimated_claim_count_low
estimated_claim_count_high

estimated_loss_low
estimated_loss_high
```

### 7.6 `reinsurance_program`

```text
name

retention
limit

aggregate_limit
aggregate_remaining

currency
```

---

## 8. Synthetic Insurance Portfolio

Generate approximately **25,000 residential policies** across NRW.

Do not distribute them uniformly.

Create concentrations around real population centres, for example:

- Cologne
- Düsseldorf
- Aachen
- Bonn
- Düren
- Essen
- Dortmund
- Wuppertal
- Smaller municipalities
- Rural areas

Deliberately place enough synthetic policies around the chosen wildfire event to make the demonstration meaningful.

### 8.1 Suggested Portfolio Scale

```text
Policies:
~25,000

Total TIV:
€8-12 billion

Typical residential TIV:
€250k-€800k

Larger properties:
€1m-€2.5m
```

### 8.2 Example Property Distribution

```text
property_type:
    detached       45%
    semi_detached  20%
    row_house      20%
    apartment      15%

construction:
    masonry        75%
    mixed          15%
    timber         10%
```

Use a deterministic random seed so the portfolio remains identical between demo runs.

---

## 9. Portfolio Privacy Design

Even though the prototype uses synthetic data, design the map as if privacy matters.

At broad zoom levels, do not show individual properties.

Use aggregation such as hexagons or grid cells:

```text
87 policies
€32.4m TIV
```

Only reveal individual synthetic policy markers at high zoom.

This makes the prototype more credible as an enterprise insurance application.

---

## 10. Event Construction

Convert multiple active-fire detections into a logical wildfire event.

Do not over-engineer this.

A simple clustering rule is acceptable:

```text
distance < ~3 km
AND
time difference < 12 hours
```

DBSCAN is suitable.

For each event calculate:

- Event centroid
- Number of detections
- Latest detection
- Bounding geometry
- First seen timestamp
- Last updated timestamp

For the main historical demo, a manually curated event definition is also acceptable.

---

## 11. Risk Scoring Model

Make the scoring transparent rather than sophisticated.

Suggested model:

```text
Risk Score =
    25% Active Fire
  + 20% Fire Weather
  + 15% Wind
  + 15% Official Warnings
  + 10% Vegetation / Fuel
  + 10% Fire Growth
  +  5% Source Corroboration
```

Each component returns a score from 0 to 100.

### 11.1 Active Fire Example

```text
0       no observations
25      isolated observation
50      small cluster
75      sustained detections
100     rapidly expanding cluster
```

### 11.2 DWD Fire Danger Mapping

```text
DWD 1 -> 10
DWD 2 -> 30
DWD 3 -> 50
DWD 4 -> 75
DWD 5 -> 100
```

### 11.3 Official Warning Mapping

```text
none               0
informational      20
official warning   60
severe warning     80
evacuation        100
```

The UI must allow the user to inspect the component scores.

---

## 12. Confidence Score

Keep **risk** and **confidence** separate.

Example:

```text
Risk:       90
Confidence: 45%
```

may occur if the event appears dangerous but only one source confirms it.

A simple confidence model:

```text
FIRMS present             +25
EFFIS corroborates        +20
DWD data available        +10
NINA warning              +25
Local authority confirms  +15
Recent observations       +5
```

Cap at 100%.

---

## 13. Trend Calculation

Display:

```text
↑ Increasing
→ Stable
↓ Decreasing
```

Compare current risk score against previous snapshots:

- 1 hour ago
- 3 hours ago
- 6 hours ago

For replay mode, precompute the values.

---

## 14. Scenario Threat Model

This is one of the most important parts of the prototype.

Do **not** simulate wildfire physics.

Create simplified **directional threat envelopes** based on:

- Current event geometry
- Wind direction
- Wind speed
- Scenario severity
- Time horizon

Use elongated ellipses or directional buffered polygons.

### 14.1 Current Scenario

```text
spread distance:
2 km

crosswind:
1 km
```

### 14.2 Adverse Scenario

```text
spread distance:
5 km

crosswind:
2 km
```

### 14.3 Severe Scenario

```text
spread distance:
10 km

crosswind:
4 km
```

Orient the envelope based on wind direction.

The UI must call these:

> Scenario threat envelopes

Do **not** call them:

> Predicted fire perimeter

This distinction must be visually and verbally clear.

---

## 15. Exposure Engine

For each scenario geometry, calculate:

- Number of exposed policies
- Building TIV
- Contents TIV
- Total TIV
- Distance-band exposure

Example PostGIS query:

```sql
SELECT
    COUNT(*) AS policies,
    SUM(total_tiv) AS tiv
FROM policies
WHERE ST_Intersects(
    location,
    scenario.geometry
);
```

Also calculate:

```text
Inside event geometry
0-1 km
1-3 km
3-5 km
5-10 km
```

Example response:

```json
{
  "inside": {
    "policies": 18,
    "tiv": 8200000
  },
  "0_1km": {
    "policies": 72,
    "tiv": 31000000
  },
  "1_3km": {
    "policies": 267,
    "tiv": 105000000
  }
}
```

---

## 16. Simple Indicative Loss Model

The prototype needs financial impact estimates without pretending to be actuarially sophisticated.

Assign configurable synthetic damage ratios by zone.

Example:

| Exposure Zone | Low | High |
|---|---:|---:|
| Inside fire area | 25% | 80% |
| Current envelope | 5% | 25% |
| Adverse outer area | 1% | 10% |
| Severe outer area | 0.2% | 5% |

Calculate:

```text
LossLow =
Σ TIV × low_damage_ratio

LossHigh =
Σ TIV × high_damage_ratio
```

Apply deductible and policy limits only if straightforward.

The UI must label this:

> Indicative insured-loss range.

---

## 17. Claim-Volume Approximation

For operational planning, claim count may be more useful than loss dollars.

Example configurable assumptions:

```text
inside fire:
60-90% claim probability

current threat:
15-40%

adverse threat:
5-20%

severe outer zone:
1-8%
```

Example output:

```text
Expected claims:
190-410
```

Use configurable staffing assumptions, for example:

```text
1 field adjuster:
8 new catastrophe claims/day

1 phone agent:
25 catastrophe interactions/day
```

Then produce planning estimates such as:

```text
Expected claims:       190-410
Additional adjusters:  12-24
Extra call capacity:   400-750/day
```

Clearly label staffing outputs as planning assumptions.

---

## 18. Reinsurance Model

Start with one synthetic property-cat layer.

Example:

```text
Insurer retention:
€50m

Cat layer:
€100m xs €50m
```

Example Current scenario:

```text
Estimated loss:
€12-24m

Retention used:
24-48%

Reinsurance:
Not expected to attach
```

Example Adverse scenario:

```text
Estimated loss:
€35-60m

Potential treaty attachment:
YES
```

Example Severe scenario:

```text
Estimated loss:
€70-130m

Expected ceded loss:
€20-80m
```

This is intended as a simple executive-awareness feature, not a full reinsurance model.

---

## 19. Five Core Screens

Build only five primary screens.

---

### Screen 1 — NRW Risk Radar

Main NRW map.

Map layers:

- Active fires
- DWD wildfire danger
- Official warnings
- Risk events

Top cards:

```text
Active events
High-risk events
Policies near active events
TIV potentially exposed
```

Left panel example:

```text
Top Emerging Risks

1. Hürtgenwald Wildfire
   Risk 87
   ↑ increasing

2. ...
```

Filters:

- Risk level
- Time
- Source

---

### Screen 2 — Event Intelligence

Click an event.

Show a large map with:

- Satellite observations
- Event boundary
- Wind
- Official warning geometry
- DWD risk

Right-hand pane:

```text
Hürtgenwald Wildfire

RISK
87 / 100
SEVERE

CONFIDENCE
94%

TREND
↑ Increasing
```

Then show explainability:

```text
Why?

Active fire       92
Fire weather      78
Wind              81
Official warning 100
Growth             72
```

Source provenance example:

```text
NASA FIRMS       updated 14m ago
DWD              updated 31m ago
NINA             updated 8m ago
EFFIS            updated 52m ago
```

---

### Screen 3 — Portfolio Impact

This is the central business-value screen.

Switch:

```text
Risk View | Portfolio View
```

Show policy concentrations or individual policies based on zoom.

Top metrics:

```text
Policies within 10 km
2,184

Total insured value
€793m

Current threat envelope
412 policies
€148m

Indicative insured loss
€8m-€29m
```

Exposure table:

| Distance | Policies | TIV |
|---|---:|---:|
| Event area | 14 | €6m |
| <1 km | 62 | €24m |
| 1-3 km | 288 | €112m |
| 3-5 km | 615 | €228m |
| 5-10 km | 1,205 | €423m |

---

### Screen 4 — Scenario & Reinsurance

Provide three scenario buttons:

```text
CURRENT
ADVERSE
SEVERE
```

Changing scenario should immediately update:

- Threat geometry
- Policies exposed
- TIV
- Indicative loss
- Claim count
- Reinsurance status

Example:

| Metric | Current | Adverse | Severe |
|---|---:|---:|---:|
| Policies | 412 | 1,083 | 2,541 |
| TIV | €148m | €391m | €915m |
| Loss | €8-29m | €27-64m | €61-137m |
| Claims | 80-170 | 190-410 | 380-780 |

Reinsurance callout:

```text
Cat retention
€50m

Severe scenario may exceed retention.
```

---

### Screen 5 — Preparedness Action Center

Convert analytics into decisions.

#### Claims

```text
Projected claims:
190-410

Recommended:
Activate catastrophe claims workflow

Suggested capacity:
+18 adjusters
```

#### Customer Operations

```text
Policies in highest-risk zones:
312

Prepare geotargeted warning communication.
```

#### Reinsurance

```text
Adverse scenario may approach retention.

Action:
Notify catastrophe/reinsurance team.
```

#### Finance

```text
Indicative reserve scenario:
€27m-€64m
```

Allow action status:

```text
Not started
In progress
Completed
```

---

## 20. Historical Replay Mode

Replay materially improves the demo.

Add:

```text
LIVE | REPLAY
```

Replay should use deterministic stored snapshots.

Example timeline:

```text
Aug 13 12:00
     ↓
Aug 14 00:00
     ↓
Aug 14 06:00
     ↓
Aug 14 12:00
```

As the user moves through time:

- FIRMS detections appear
- Risk score changes
- Confidence changes
- Warnings appear
- Threat envelope expands
- Portfolio exposure changes
- Claim estimates change
- Recommended actions escalate

This enables a presenter to say:

> Let's go back six hours before the official evacuation warning.

---

## 21. Event Snapshot Model

Create:

```text
event_snapshots

event_id
timestamp

risk_score
confidence
severity
geometry
scenario_geometries
policy_counts
tiv
loss_estimates
source_state
```

For replay mode, precompute these values.

Do not rely on complex live recomputation during the presentation.

---

## 22. Backend API

Keep the API surface intentionally small.

### Events

```http
GET /events
GET /events/{id}
GET /events/{id}/signals
GET /events/{id}/timeline
```

### Risk

```http
GET /events/{id}/risk
```

Example response:

```json
{
  "score": 87,
  "confidence": 0.94,
  "trend": "increasing",
  "components": {
    "active_fire": 92,
    "weather": 78,
    "wind": 81,
    "warning": 100,
    "growth": 72
  }
}
```

### Portfolio

```http
GET /events/{id}/exposure
GET /events/{id}/exposure?scenario=adverse
```

### Scenarios

```http
GET /events/{id}/scenarios
```

### Actions

```http
GET /events/{id}/actions
PATCH /actions/{id}
```

---

## 23. GeoJSON Standard

All geometry endpoints should return standard GeoJSON.

Example:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": []
  },
  "properties": {
    "event_id": "..."
  }
}
```

This keeps MapLibre integration straightforward.

---

## 24. Source Health Panel

Show data freshness visibly.

Example:

```text
DATA SOURCES

NASA FIRMS     ● Online     12m old
DWD            ● Online     28m old
NINA           ● Online      6m old
EFFIS          ● Online     44m old
```

If stale:

```text
DWD            ● Stale       3h old
```

This helps demonstrate awareness of data provenance and reliability.

---

## 25. Explainability Requirement

Add a **Why?** or **How calculated?** control beside important outputs.

Example:

```text
Risk 87     [Why?]
```

Clicking should show component contributions.

Example:

```text
Indicative loss €27m-€64m     [How calculated?]
```

Explanation:

```text
1,083 properties intersect scenario
€391m TIV

Assumed damage ratio:
7-16%

=> €27m-€64m indicative loss
```

The system should never present opaque numbers as unquestionable facts.

---

## 26. Visual Design Requirements

### 26.1 Hazard Colours

Use familiar hazard semantics only:

```text
green
yellow
orange
red
dark red
```

Avoid rainbow-style maps.

### 26.2 Observed vs Scenario Geometry

Clearly distinguish:

```text
OBSERVED
```

from:

```text
SCENARIO
```

Suggested visual convention:

- Solid geometry = observed or known
- Dashed/translucent geometry = scenario

Do not allow scenario envelopes to look like measured fire perimeters.

### 26.3 Portfolio Markers

Portfolio exposure must visually differ from hazard observations.

---

## 27. Configuration

Do not hard-code assumptions throughout the codebase.

Use YAML or similar configuration.

Example:

```yaml
risk:
  active_fire_weight: 0.25
  weather_weight: 0.20
  wind_weight: 0.15
  warning_weight: 0.15
  vegetation_weight: 0.10
  growth_weight: 0.10
  corroboration_weight: 0.05

scenarios:
  current:
    spread_km: 2
    crosswind_km: 1

  adverse:
    spread_km: 5
    crosswind_km: 2

  severe:
    spread_km: 10
    crosswind_km: 4

reinsurance:
  retention: 50000000
  limit: 100000000
```

A key demo message is that assumptions are configurable rather than hidden.

---

## 28. AI Risk Analyst — Optional Stretch Goal

Only implement this after the core MVP works end-to-end.

Add a right-hand **Risk Analyst** drawer.

Example questions:

```text
What changed in the last 6 hours?

Why is this event rated severe?

How many policies are inside the adverse scenario?

Could our reinsurance attach?

Summarize the situation for the COO.

What actions should claims take?
```

Architecture:

```text
User
 ↓
LLM
 ↓
Tool calls
 ↓
Risk API / Exposure API / Event API
 ↓
Structured results
 ↓
LLM explanation
```

### Important Rule

The LLM must **not** calculate risk, TIV, claim counts, or reinsurance exposure itself.

It must query the deterministic application APIs and explain the results.

---

## 29. Suggested Demo Narrative

The application should be built around this five-minute flow.

### Scene 1 — NRW Overview

Open the NRW Risk Radar.

Presenter:

> The insurer currently has several wildfire events under observation.

Click the Hürtgenwald event.

### Scene 2 — Risk Escalation

Show:

```text
Risk 62
Confidence 71%
```

Advance replay.

Additional detections arrive.

```text
Risk 74
```

Wind strengthens or changes.

### Scene 3 — Official Warning

A NINA warning appears.

```text
Risk 89
Confidence 95%
```

Threat envelope expands.

### Scene 4 — Portfolio View

Toggle:

```text
Portfolio View
```

Show:

```text
1,083 policies
€391m TIV
```

### Scene 5 — Severe Scenario

Select:

```text
Severe
```

Show:

```text
2,541 policies
€915m TIV

Indicative loss:
€61m-€137m
```

### Scene 6 — Reinsurance

Show:

```text
Retention:
€50m

Potential attachment:
YES
```

### Scene 7 — Action Center

Show:

```text
+18 adjusters

Prepare high-risk policyholder communication

Alert reinsurance team

Prepare preliminary reserve
```

---

## 30. Implementation Milestones

### Milestone 0 — Project Skeleton

**Target:** 0.5 day

Create:

- Monorepo
- Docker Compose
- Postgres/PostGIS
- FastAPI
- Next.js
- Basic NRW map

**Acceptance criteria:**

> App launches with one command and displays NRW.

---

### Milestone 1 — Synthetic Portfolio

**Target:** 0.5-1 day

Implement:

- Portfolio generator
- PostGIS policy table
- ~25,000 policies
- Map aggregation

**Acceptance criteria:**

> User can zoom around NRW and see policy concentrations.

---

### Milestone 2 — Deterministic Demo Wildfire

**Target:** 1 day

Do **not** start with live APIs.

Create curated historical event fixtures for:

- Event definition
- Fire observations
- Weather
- Warning
- Timeline

**Acceptance criteria:**

> Historical wildfire and its signals render correctly.

---

### Milestone 3 — Risk Engine

**Target:** 1 day

Implement:

- Component scoring
- Overall risk
- Confidence
- Trend

**Acceptance criteria:**

> Every score can be explained component by component.

---

### Milestone 4 — Exposure Engine

**Target:** 1 day

Implement:

- Distance bands
- Policy intersections
- TIV aggregation

**Acceptance criteria:**

> Exposure changes when event geometry changes.

---

### Milestone 5 — Scenarios

**Target:** 1-1.5 days

Implement:

- Directional envelopes
- Current / Adverse / Severe
- Loss ranges
- Claim estimates

**Acceptance criteria:**

> Changing scenario updates map and financial exposure immediately.

---

### Milestone 6 — Five-Screen UI

**Target:** 2 days

Build:

1. Risk Radar
2. Event Intelligence
3. Portfolio Impact
4. Scenario & Reinsurance
5. Preparedness Action Center

**Acceptance criteria:**

> Complete five-minute executive demo can be performed.

---

### Milestone 7 — Historical Replay

**Target:** 1 day

Implement timeline snapshots.

**Acceptance criteria:**

> User can move chronologically through the event and see risk, exposure, and actions change.

---

### Milestone 8 — Live Connectors

**Target:** 1-2 days

Add, in order:

1. FIRMS
2. DWD
3. NINA
4. EFFIS where practical

Every integration must retain fixture fallback.

**Acceptance criteria:**

> Application remains completely usable when every external API is unavailable.

---

### Milestone 9 — Demo Polish

**Target:** 1 day

Add:

- Source freshness
- Legends
- Loading states
- Error states
- Disclaimer
- Demo reset
- Seeded database
- Deployment script

---

### Milestone 10 — AI Analyst

**Optional target:** 1-2 days

Only begin after all core functionality works.

---

## 31. Time-Constrained Priority

If development time becomes tight, remove features in this order:

```text
AI analyst
↓
Live EFFIS
↓
News / local feeds
↓
Live NINA
↓
Live DWD
↓
Live FIRMS
```

Do **not** remove:

```text
Historical event
Synthetic portfolio
Risk score
Scenario envelopes
Exposure calculations
Reinsurance example
Replay
Five core screens
```

These are the actual product demonstration.

---

## 32. Required Tests

Do not aim for huge test coverage.

Test the calculations that would damage credibility if wrong.

### 32.1 Risk Score

Verify:

- Components combine correctly
- Score remains between 0 and 100
- Missing sources are handled correctly

### 32.2 Geospatial Exposure

Use known points and polygon.

Verify:

- Expected policies are selected
- TIV aggregation is exact

### 32.3 Scenario Geometry

Verify:

- Higher severity creates equal or larger threat area
- Orientation corresponds correctly to wind direction

### 32.4 Loss Engine

Known case:

```text
TIV = €1m
Damage ratio = 10%

Expected loss = €100k
```

### 32.5 Replay

Snapshot at a known time must return predetermined:

- Risk score
- Confidence
- Exposure
- Loss range
- Claim estimate

---

## 33. Definition of Done

The prototype is complete when a presenter can reliably demonstrate all of the following:

1. A wildfire exists.
2. Multiple sources confirm or characterize it.
3. The system assigns an explainable risk score.
4. Risk changes over time.
5. The system knows where insured assets are.
6. It calculates policy and TIV exposure.
7. Wind and scenario assumptions alter exposure.
8. It estimates indicative losses and claim volumes.
9. It shows whether a reinsurance threshold could be approached.
10. It recommends operational preparedness actions.
11. Every important conclusion has visible provenance or calculation logic.
12. The entire demo works without Internet connectivity.

---

## 34. README Requirements

The final repository README should include:

```text
What the prototype demonstrates

Architecture

How to run locally

How to seed demo data

How to switch:
demo -> live mode

Data sources

Risk-score methodology

Scenario methodology

Loss assumptions

Limitations

How to run the five-minute demo
```

Ideal startup command:

```bash
make demo
```

or:

```bash
docker compose up
```

---

## 35. Coding-Agent Execution Instructions

Use the following as the top-level brief for the coding agent.

> Build a production-looking but explicitly non-production prototype called **NRW Wildfire Risk & Portfolio Impact Radar**.
>
> The purpose is to demonstrate to a property insurer how public wildfire intelligence can be combined with its insured-property portfolio to support risk monitoring, catastrophe exposure assessment, reinsurance awareness, and claims preparedness.
>
> Use Next.js/TypeScript/MapLibre for the frontend, Python/FastAPI for the backend, and PostgreSQL/PostGIS for geospatial storage and calculations.
>
> The application must have five primary screens:
>
> 1. NRW Risk Radar
> 2. Wildfire Event Intelligence
> 3. Portfolio Impact
> 4. Scenario & Reinsurance
> 5. Preparedness Action Center
>
> Use a historical NRW wildfire as the main deterministic demo event. Build the entire product using fixture data first.
>
> Generate approximately 25,000 synthetic residential insurance policies across NRW and store location, building TIV, contents TIV, total TIV, property type, and basic property characteristics.
>
> Implement an explainable 0-100 wildfire risk score using active-fire observations, wildfire weather, wind, warnings, fire growth, vegetation/fuel where available, and source corroboration. Maintain a separate confidence score.
>
> Implement three simple directional threat-envelope scenarios — Current, Adverse, and Severe — based primarily on wind direction and configurable propagation distances. These are scenario geometries, not scientific wildfire forecasts, and must be labelled accordingly.
>
> Use PostGIS to calculate policies and TIV intersecting each scenario and distance band.
>
> Implement configurable indicative damage ratios to produce loss ranges and claim-volume ranges. Clearly label these as planning estimates rather than actuarial catastrophe-model outputs.
>
> Add one synthetic catastrophe reinsurance structure and show whether scenario losses remain below retention, approach retention, or potentially attach to the treaty.
>
> Add an event replay timeline so that the demonstration can show risk and portfolio exposure increasing as observations and warnings arrive.
>
> Every risk and financial result should expose a **Why?** or **How calculated?** explanation.
>
> Every external data integration must have deterministic fixtures, and the application must support both `DATA_MODE=demo` and `DATA_MODE=live`.
>
> Prioritize a reliable complete demo over feature breadth. Do not build AI functionality until the five core screens, replay, scenario engine, and portfolio analytics work end to end.
>
> Build incrementally according to the milestones in this specification. At the end of every milestone, run tests and leave the application in a working state.
>
> The final deliverable should run locally using one command, seed its own synthetic portfolio/demo event, and support a reliable five-minute executive demonstration without requiring Internet connectivity.

---

## 36. Critical Instruction to the Coding Agent

> **Do not spend the first several days wrestling with external APIs. Build the complete application against deterministic fixtures first. Once the entire demo story works end to end, replace individual fixtures with live connectors one at a time.**

This constraint is important. The value of the prototype is the connection between:

```text
External hazard signals
        +
Insured-property exposure
        +
Scenario impact
        +
Reinsurance awareness
        +
Operational preparedness
```

—not the number of public APIs connected.

---

## 37. Possible Future Extensions

These are out of scope for the first prototype but should remain architecturally possible:

- Flood
- Storm / wind
- Hail
- Extreme heat
- Industrial or chemical incidents
- Earthquake
- Real insurer policy data
- Claims-history calibration
- Real catastrophe-model integration
- Real reinsurance programme ingestion
- Customer notification workflows
- Automated operational workflow integrations
- Post-event satellite damage assessment
- Portfolio accumulation analysis
- Multi-event aggregation
- AI Risk Analyst / Risk Coworker
- Executive brief generation

A future generic event model should therefore avoid being wildfire-specific where possible:

```text
RiskEvent
    peril
    geometry
    start_time
    severity
    confidence
    probability
    expected_duration
    sources[]
    scenarios[]
```

The initial wildfire prototype should be treated as the first peril-specific implementation of a broader insurance risk-intelligence platform.
