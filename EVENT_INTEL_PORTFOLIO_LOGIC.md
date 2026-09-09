# How the Wildfire Risk Radar Works (Live Mode)

A plain-English guide to where the data comes from, how a "risk score" is
worked out, and how we estimate what it could cost the insurance book.
No technical background needed.

> This document describes **Live mode only** (`DATA_MODE=live`) — the mode the
> production site runs in, where real satellite, weather and warning feeds are
> pulled in every time the page loads or you press **Refresh live**.

---

## 1. The 30-second version

1. Every time the app starts (or you hit **Refresh live**), it calls **four
   public data services** — NASA satellites, the German weather service, the
   German official-warning system, and the EU burned-area service.
2. It groups the satellite "hot spots" into **clusters** — each cluster is one
   possible wildfire "event" (this is why you see ~25 events across Germany).
3. For each event it calculates a **Risk score from 0 to 100** by mixing seven
   ingredients (fire, weather, wind, warnings, vegetation, growth, and how many
   sources agree).
4. It then lays a **wind-shaped "threat zone"** over the map and counts how many
   of our **25,000 insurance policies** fall inside it — giving an indicative
   **money-at-risk** figure.

Everything is transparent and rule-based. **There is no AI black box and no
random guessing** — the same inputs always produce the same score.

---

## 2. Where the data comes from (the four live sources)

Think of these as four different "witnesses", each telling us something
different about a possible fire.

| Source | Who runs it | What it tells us| What we pull |
| ------ | ----------- | -------------------------------- | ------------ |
| **NASA FIRMS** | NASA satellites | "There is heat / a hot spot here." Satellites scan the ground and flag spots that are burning hot. | Location (lat/lon), time seen, which satellite, a confidence level, and **FRP** = how much heat the fire is giving off. |
| **DWD** | German Weather Service | "How dangerous is the weather for fires right now?" | A **wildfire danger level from 1 (low) to 5 (extreme)**, plus temperature, humidity, and **wind speed & direction**. |
| **NINA** | German Federal Office (official gov. alerts) | "Have the authorities issued an official warning to the public?" | Warning level (information / official warning / evacuation), a title, and the area it covers. |
| **EFFIS** | EU Copernicus service | "Has an area already burned recently?" Used only as supporting context. | Burned-area shapes on the map. |

**How each source is used:**

- **NASA FIRMS is the "where"** — it finds and locates the fires.
- **DWD is the "how bad is the weather"** — hot, dry, windy = more dangerous.
- **NINA is the "official confirmation"** — a real alert to the public raises
  both the score and our confidence.
- **EFFIS is the "supporting evidence"** — it doesn't drive the score much, but
  it helps confirm that fire activity is real in that area.

---

## 3. The `.env` file explained (every line)

The `.env` file is the app's **settings sheet**. It decides which mode we run in
and which web addresses (URLs) to call for live data. Here is what each line
means and **how "live" it is**.

| Setting | What it does | Live? |
| ------- | ------------ | ----- |
| `DATA_MODE=live` | Turns **live mode on**. (If set to `demo`, the app uses saved sample files instead of the internet.) | — |
| `PORT=8025` | The "door number" the website runs on locally (`localhost:8025`). | — |
| `FIRMS_URL` | NASA satellite fires **for NRW only** (a small box around North Rhine-Westphalia), covering the **last 1 day**. Used for the close-up showcase view. | ✅ Live |
| `FIRMS_NATIONWIDE_URL` | NASA satellite fires **for all of Germany** (a big box), covering the **last 5 days**. **This is the feed that creates the ~25 events** you see on the map. | ✅ Live |
| `NINA_INDEX_URL` | The **nationwide list** of official public warnings (MoWaS). We keep only **fire/smoke-related** warnings from this list. | ✅ Live |
| `NINA_INDEX_MAX_WARNINGS=50` | A safety cap: pull at most **50** nationwide warnings, so the app stays fast. | — |
| `DWD_URL` | The German Weather Service **fire-danger index** feed (danger level 1–5 + weather). | ✅ Live |
| `NINA_URL` | The **regional** official-warning dashboard for one area code (used for the detailed showcase event). | ✅ Live |
| `EFFIS_URL` | The EU **burned-area** feed (supporting context). ⚠️ **Currently broken** — the address in the file is corrupted, so EFFIS quietly falls back to sample data until the URL is cleaned. | ⚠️ Needs a clean URL |
| `NINA_MAX_WARNINGS=10` | A safety cap: pull at most **10** detailed warnings for the regional dashboard. | — |

**Key idea:** *the four data feeds are genuinely live* — they are fetched fresh
from the internet each startup/refresh. If any feed is unreachable, that one
source **quietly falls back to a saved sample file** and the app keeps working
(the little source lights in the sidebar turn amber to show "fallback").

---

## 4. How an "event" is found (live discovery)

Satellites don't report "wildfires" — they report thousands of individual **hot
spots**. We turn those dots into meaningful events like this:

1. **Group nearby dots together.** Any hot spots within about **12 km** of each
   other are treated as **one cluster** (one possible fire event).
2. **Ignore the noise.** A cluster only counts if it has **at least 2 hot
   spots**, *or* a single very hot one (high FRP). This filters out one-off
   false readings.
3. **Attach official warnings.** If an official NINA fire warning sits within
   **30 km** of a cluster, they are linked into the same event.
4. **Rank and keep the top 25.** Events are sorted by severity and the strongest
   **25** are shown (this limit is why the count lands on ~25).

Each event on the map is named either **"Satellite fire cluster · <location>"**
(found from satellite dots) or by the **official warning headline** (found from
NINA).

---

## 5. How the Risk score is calculated (0–100)

This is the heart of the system. The Risk score is a **weighted mix of seven
ingredients**. Each ingredient is first scored 0–100, then multiplied by its
"importance weight", and the pieces are added up.

Think of it like a **weighted school report**: some subjects count more toward
the final grade than others.

### The seven ingredients

| Ingredient | Plain-English meaning | How it's scored (0–100) | Weight (importance) |
| ---------- | --------------------- | ----------------------- | ------------------- |
| **Active fire** | How many hot spots the satellite sees | `25 + 12 × number of hot spots` (0 if none) | **25%** |
| **Weather** | How fire-prone the weather is (DWD) | Danger level 1–5 scaled up to 0–100 (level 5 = 100) | **20%** |
| **Wind** | How fast the wind is (spreads fire) | `wind speed × 2.25`, plus 12 if strong gusts (>45 km/h) | **15%** |
| **Warning** | Official public alert level (NINA) | none = 0 · information = 20 · official warning = 60 · evacuation = 100 | **15%** |
| **Vegetation** | How burnable the land is | **Fixed at 50** — we have no live vegetation feed, so this is a neutral placeholder | **10%** |
| **Growth** | How fast the fire seems to be spreading | `20 + 5 × number of hot spots` | **10%** |
| **Corroboration** | How many sources agree | `(sources present ÷ 4) × 100` | **5%** |

The weights add up to 100% (25 + 20 + 15 + 15 + 10 + 10 + 5).

### Worked example (a real "52" from the live map)

Take a typical satellite cluster with **2 hot spots**, in weather of **danger
level 4**, wind **31 km/h**, **no official warning**:

| Ingredient | Raw score | × weight | Contribution |
| ---------- | --------- | -------- | ------------ |
| Active fire | 25 + 12×2 = **49** | ×0.25 | 12.3 |
| Weather | level 4 → **80** | ×0.20 | 16.0 |
| Wind | 31 × 2.25 = **70** | ×0.15 | 10.5 |
| Warning | none → **0** | ×0.15 | 0.0 |
| Vegetation | **50** (placeholder) | ×0.10 | 5.0 |
| Growth | 20 + 5×2 = **30** | ×0.10 | 3.0 |
| Corroboration | **100** | ×0.05 | 5.0 |
| **Total Risk score** | | | **≈ 52 / 100** |

That is exactly the "52" shown for most clusters on the live map — and because
they share the same weather and wind reading, many of them land on the same
number.

---

## 6. Confidence and Trend (shown next to the score)

These are **separate** from the Risk score — they describe *how sure we are*,
not *how dangerous it is*.

**Confidence (0–100%)** — add up points for every source that backs the event:

- Satellite hot spots seen: **+25**
- Burned-area context (EFFIS): **+20**
- Weather data present (DWD): **+10**
- An official warning exists (not "none"): **+25**
- Local confirmation: **+15**
- A recent observation exists: **+5**

A satellite-only cluster (no official warning) typically lands at **75%
confidence**. An event that also has an official NINA warning climbs toward
**100%**.

**Trend** — compares the current score with the previous reading:
**increasing** (up 3+ points), **decreasing** (down 3+), or **stable**.
Live events start as **stable** until there's a history to compare against.

---

## 7. Portfolio Impact — turning risk into money

Once we know *where* an event is, we estimate *what it could cost us*.

### 7a. The insurance book (not live — synthetic)

We use a **synthetic portfolio of 25,000 residential policies** spread across
NRW (Cologne, Düsseldorf, Aachen, etc.). It is **made-up but realistic** —
there is **no real customer data and no personal information**. Each policy has
a location and an insured value (**TIV** = Total Insured Value = building +
contents). The total book is roughly **€8–12 billion**.

> This portfolio is **the same in live mode** — even with live fires, the
> exposure is always measured against this illustrative book.

### 7b. The "threat zone" (scenario envelope)

For a chosen event we draw a **wind-shaped zone** on the map — like a stretched
teardrop pointing downwind. You can switch between three what-if sizes:

| Scenario | Reaches downwind | Width | Meaning |
| -------- | ---------------- | ----- | ------- |
| **Current** | 2 km | 1 km | Roughly the situation now |
| **Adverse** | 5 km | 2 km | If conditions worsen |
| **Severe** | 10 km | 4 km | A serious escalation |

These are **planning shapes based on wind direction — not scientific fire
forecasts.**

### 7c. Counting the exposure

Every one of the 25,000 policies is checked two ways:

1. **Is it inside the threat zone?** → gives "policies exposed" and their total
   insured value.
2. **How far is it from the fire?** → sorted into distance rings: inside the
   fire, 0–1 km, 1–3 km, 3–5 km, 5–10 km.

### 7d. Estimated loss, claims and reinsurance

We split exposed policies into **inside the fire** (high damage) vs **outer
zone** (lower damage) and apply fixed damage-rate ranges:

| Group | Expected loss (share of insured value) |
| ----- | -------------------------------------- |
| Inside the fire area | 25% – 80% |
| Outer zone (Current) | 5% – 25% |
| Outer zone (Adverse) | 1% – 10% |
| Outer zone (Severe) | 0.2% – 5% |

This produces an **indicative loss range** (a low and a high figure) and an
estimated **number of claims**. Finally, a simple **reinsurance** check compares
the loss against a **€50m retention with a €100m cover layer**:

- Loss below €50m → **"below retention"** (we absorb it)
- Loss straddles €50m → **"potentially attaches"**
- Loss above €50m → **"attaches"** (reinsurance kicks in)

> All loss, claim and reinsurance figures are clearly labelled **"indicative,
> not actuarial"** — they are planning aids, not a pricing model.

---

## 8. What is genuinely LIVE vs what is ASSUMED

This is the most important table for trust. 🟢 = pulled live from the internet ·
🟡 = live-capable but a placeholder/assumption today · 🔴 = fixed / synthetic.

| Part of the system | Status | Notes |
| ------------------ | ------ | ----- |
| Satellite fire detections (FIRMS) | 🟢 Live | Fresh from NASA each startup/refresh |
| Weather / fire-danger (DWD) | 🟢 Live | Danger level + wind, fresh from DWD |
| Official public warnings (NINA) | 🟢 Live | Fresh from the federal warning system |
| Burned-area context (EFFIS) | 🟡 Live-capable | ⚠️ URL corrupted right now → falls back to sample data |
| Event discovery / clustering | 🟢 Live logic | Runs on the live satellite + warning data |
| Risk score math (7 ingredients) | 🟢 Live logic | Recalculated from the live signals |
| **Vegetation** ingredient | 🟡 Assumption | Fixed at 50 — no live vegetation feed exists |
| **Growth** ingredient | 🟡 Derived | Estimated from fire count, not a live feed |
| Insurance portfolio (25,000 policies) | 🔴 Synthetic | Illustrative, no real customer data — same in live mode |
| Loss / claim / reinsurance rates | 🔴 Fixed | Indicative planning ranges, not actuarial |

---

## 9. Plain-English glossary

- **FIRMS** — NASA's Fire Information system; satellites spotting heat.
- **FRP (Fire Radiative Power)** — how much heat a fire gives off; a bigger
  number means a more intense fire.
- **DWD** — Germany's national weather service.
- **NINA** — Germany's official public-warning app/system.
- **EFFIS** — the EU's wildfire information service (burned areas).
- **TIV (Total Insured Value)** — the insured value of a policy (building +
  contents).
- **Retention** — how much loss the insurer keeps before reinsurance helps.
- **Envelope / threat zone** — the wind-shaped area we draw to estimate reach.
- **Corroboration** — how many independent sources back up the same event.

---

*Technical reference (for developers): the live pipeline lives in
`apps/api/main.py` (fetch + assemble), `apps/api/adapters.py` (normalise each
provider's response), `apps/api/discovery.py` (cluster hot spots into events),
and `analytics/core.py` (all risk, exposure, loss and reinsurance math). Every
number above is defined there — nothing is hidden or random.*
