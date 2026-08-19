# NRW Wildfire Risk & Portfolio Impact Radar

Offline-first decision-support prototype for an insurer's wildfire monitoring, portfolio exposure, reinsurance awareness, and claims preparedness.

## What it demonstrates

- Curated Hürtgenwald wildfire with NASA FIRMS, DWD, NINA, and EFFIS/Copernicus fixtures.
- Explainable 0–100 risk score with independent confidence, trend, and source freshness.
- 25,000 deterministic synthetic residential policies distributed around NRW population centres and the showcase event.
- Privacy-aware aggregated portfolio map, distance-band exposure, TIV aggregation, and scenario intersection.
- Current, Adverse, and Severe directional **scenario threat envelopes** driven by wind assumptions.
- Indicative insured-loss and claim-volume ranges, synthetic catastrophe treaty awareness, and action status tracking.
- Historical replay snapshots for a five-minute executive demonstration.

All financial, claims, staffing, and spread outputs are labelled planning assumptions. This is not a scientific wildfire propagation model, actuarial catastrophe model, production reinsurance pricing system, automated claims decision system, or insurer integration.

## Architecture

The prototype uses a dependency-free Python HTTP API and static TypeScript-compatible browser JavaScript so the complete demo runs offline. Analytics live in `analytics/core.py`; source fixtures are under `data/fixtures`; the API is `apps/api/main.py`; UI is `apps/web`; the seeded portfolio generator is `synthetic/generate_portfolio.py`.

`DATA_MODE=demo` is the default and reads deterministic fixtures. `DATA_MODE=live` attempts URLs configured through `FIRMS_URL`, `DWD_URL`, `NINA_URL`, and `EFFIS_URL`, then falls back to the corresponding fixture when a request fails. The UI visibly reports fixture fallback status.

## Run locally

Requires [uv](https://docs.astral.sh/uv/). Do not use system Python.

```bash
make demo
# open http://localhost:8025 (or the VM's Tailscale IP on port 8025)
```

Equivalent commands:

```bash
uv run python synthetic/generate_portfolio.py
uv run python apps/api/main.py
```

Docker is also supported:

```bash
docker compose up
```

## Seed demo data

`make seed` (or the generator command above) writes `data/demo/portfolio.json` with 25,000 deterministic policies using seed `20260818`. Action statuses are persisted in `data/demo/actions.json` after a user changes them.

## Switch demo → live

```bash
DATA_MODE=live FIRMS_URL="https://..." DWD_URL="https://..." NINA_URL="https://..." EFFIS_URL="https://..." uv run python apps/api/main.py
```

The live URLs are intentionally environment-provided because FIRMS commonly requires a MAP_KEY and public feeds vary. Any unavailable source remains usable through its fixture.

## Data sources and methodology

- **NASA FIRMS:** individual active-fire observations, acquisition time, satellite, confidence, and FRP.
- **DWD:** fire-danger level, temperature, humidity, wind, gust, and precipitation fixture.
- **NINA:** official warning level, text, affected area, and timestamps.
- **EFFIS / Copernicus:** historical burned-area context and corroborating geometry.

Risk is the configured weighted sum: active fire 25%, weather 20%, wind 15%, warnings 15%, vegetation/fuel 10%, growth 10%, corroboration 5%. DWD levels map 1/2/3/4/5 to 10/30/50/75/100; warning levels map none/informational/official/severe/evacuation to 0/20/60/80/100. Confidence uses explicit source-presence increments and is capped at 100%.

Scenario envelopes use an oriented ellipse-like polygon with 2/5/10 km directional spread and 1/2/4 km crosswind. They are explicitly not predicted fire perimeters. Exposure uses point-in-polygon intersection plus haversine distance bands. Loss and claims use configurable synthetic ratios in `analytics/core.py`; reinsurance is a synthetic €100m layer attaching above €50m retention.

## Five-minute demo

1. Start `make demo`; open Risk Radar and select Hürtgenwald.
2. Open Event Intelligence; click **Why?** to inspect component scores and provenance.
3. Use Portfolio Impact to show distance-band policies and TIV.
4. Compare Current, Adverse, and Severe; observe geometry, exposure, losses, claims, and treaty status update.
5. Open Action Center; move operational statuses from Not started to In progress/Completed.
6. Replay snapshots are represented by the deterministic timeline payload and reset to the final showcase snapshot with **Reset demo**.

## Verify

```bash
make test
```

Tests cover weighted risk bounds and missing sources, exact polygon/TIV selection, scenario area monotonicity/orientation anchor, and known loss-ratio arithmetic.
