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

The prototype uses a dependency-free Python HTTP API and static TypeScript-compatible browser JavaScript so the complete demo runs offline. Maps use vendored Leaflet with an OpenStreetMap tile layer when network access is available; the local SVG overlays remain visible when tiles are unavailable. Analytics live in `analytics/core.py`; source fixtures are under `data/fixtures`; the API is `apps/api/main.py`; UI is `apps/web`; the seeded portfolio generator is `synthetic/generate_portfolio.py`.

`DATA_MODE=demo` is the default and reads deterministic fixtures. `DATA_MODE=live` uses source-specific adapters for FIRMS, DWD, NINA, and EFFIS, then falls back to the corresponding fixture when a request fails. The UI visibly reports fixture fallback status. In live mode, nationwide NINA warnings and clustered Germany-wide FIRMS detections become event candidates.

The in-app **Help / demo guide** link opens `apps/web/help.html` and explains every screen, calculation, data boundary, and five-minute demo step.

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

## Deploy to Azure App Service

The app is a dependency-free standard-library HTTP server, so it runs on an
**Azure App Service (Linux, Python 3.12)** with no code changes — it binds
`0.0.0.0` on the port Azure provides (`PORT`, or `WEBSITES_PORT` for
containers).

**Option A — code deployment (recommended)**

1. Create a Linux App Service on the **Python 3.12** runtime.
2. Deploy this branch (GitHub Actions, `az webapp up`, or the Deployment Center).
   `requirements.txt` is present (no third-party packages) so Oryx detects Python.
3. Set the **Startup Command** (Configuration → General settings) to:

   ```
   python apps/api/main.py
   ```

   (or `startup.sh`, which runs the same thing).
4. Add **Application settings** (Configuration → Application settings) — these
   become environment variables and override anything in `.env`:

   - `DATA_MODE` = `live` (or `demo`)
   - `SCM_DO_BUILD_DURING_DEPLOYMENT` = `true`
   - In live mode also add: `FIRMS_URL`, `FIRMS_NATIONWIDE_URL`, `DWD_URL`,
     `NINA_URL`, `NINA_INDEX_URL`, `EFFIS_URL`, and optionally
     `NINA_MAX_WARNINGS`, `NINA_INDEX_MAX_WARNINGS`.

   Do **not** commit `.env` (it is git-ignored) — keep source URLs/keys in
   Application settings.

**Option B — custom container**

Build the included `Dockerfile` and deploy as an App Service for Containers
(set `WEBSITES_PORT=8025`), or push to any container host.

**Notes for App Service**

- Runtime config saved from the in-app **Settings / Configuration** screen is
  written to `data/demo/config.json` on the App Service filesystem (git-ignored,
  so it persists per instance and does not ship in the repo). If absent, the app
  falls back to built-in defaults.
- `data/demo/portfolio.json` is committed, so startup is fast; if removed it is
  regenerated deterministically at boot.
- The health probe hits `/` (returns the app shell with HTTP 200). A mock login
  page is served at `/login`.

## Seed demo data

`make seed` (or the generator command above) writes `data/demo/portfolio.json` with 25,000 deterministic policies using seed `20260818`. Action statuses are persisted in `data/demo/actions.json` after a user changes them.

## Switch demo → live

```bash
DATA_MODE=live \
FIRMS_URL="https://firms.modaps.eosdis.nasa.gov/api/area/csv/MAP_KEY/VIIRS_SNPP_NRT/5,50,7,52/1" \
FIRMS_NATIONWIDE_URL="https://firms.modaps.eosdis.nasa.gov/api/area/csv/MAP_KEY/VIIRS_SNPP_NRT/5.5,47.0,15.5,55.2/5" \
DWD_URL="https://services2.arcgis.com/7wuv6DH7DYhDuwvU/ArcGIS/rest/services/DWD/FeatureServer/3/query?where=1%3D1&outFields=*&f=json" \
NINA_URL="https://warnung.bund.de/api31/dashboard/053580000000.json" \
NINA_INDEX_URL="https://warnung.bund.de/api31/mowas/mapData.json" \
EFFIS_URL="https://maps.effis.emergency.copernicus.eu/effis?service=WFS&version=1.0.0&request=GetFeature&typename=ms%3Amodis.ba.poly.today&outputformat=geojson&bbox=5%2C50%2C7%2C52" \
uv run python apps/api/main.py
```

The live adapters normalize provider responses at the API boundary:

- FIRMS official area CSV or JSON observations → `observations`
- DWD ArcGIS FeatureServer JSON → the station nearest to the event
- NINA dashboard or nationwide MoWaS index → warning details plus GeoJSON geometry
- EFFIS GeoJSON or feature-list wrappers → `FeatureCollection`

`FIRMS_URL` must contain a valid NASA `MAP_KEY`. The DWD URL should return the wildfire layer (`FeatureServer/3`) as JSON. NINA dashboard URLs must be district-level endpoints; nationwide map URLs are filtered to fire-related warnings and followed to detail and geometry endpoints. `NINA_MAX_WARNINGS` defaults to `10`; `NINA_INDEX_MAX_WARNINGS` defaults to `50`. `LIVE_EVENT_LIMIT` defaults to `25`.

Responses are fetched once at API startup. Any unavailable or malformed source falls back to its fixture and is reported as `fallback` by `/api/health`.

## Live discovery and refresh

The API queries configured source feeds at startup. Live sources can be re-queried without restarting the process:

```bash
curl -X POST http://localhost:8025/api/refresh
```

The web UI's **Refresh live** button invokes the same endpoint. Refreshing reruns the configured connectors, rebuilds nationwide event candidates, clears exposure caches, and updates the source timestamp.

Each live startup and refresh appends a normalized snapshot to the ignored local file `data/live/snapshots.jsonl`. Read stored snapshots with:

```bash
curl http://localhost:8025/api/history
curl 'http://localhost:8025/api/history?event_id=<event-id>'
```

Provider APIs expose current data and some provider-specific archives, but they do not provide one stable normalized cross-source history. Local snapshots are therefore required for reliable replay, audit, and trend analysis. Demo mode uses the deterministic fixture timeline; live events use the current source snapshot and do not mix in the historical replay timeline.

## Data sources and methodology

- **NASA FIRMS:** individual active-fire observations, acquisition time, satellite, confidence, and FRP.
- **DWD:** fire-danger level, temperature, humidity, wind, gust, and precipitation fixture.
- **NINA:** official warning level, text, affected area, and timestamps.
- **EFFIS / Copernicus:** historical burned-area context and corroborating geometry.

Risk is the configured weighted sum: active fire 25%, weather 20%, wind 15%, warnings 15%, vegetation/fuel 10%, growth 10%, corroboration 5%. DWD levels map 1/2/3/4/5 to 10/30/50/75/100; warning levels map none/informational/official/severe/evacuation to 0/20/60/80/100. When no vegetation feed is loaded, vegetation uses a neutral deterministic 50 proxy and growth uses `20 + 5 × active-fire detections`; the UI labels these assumptions. Confidence uses explicit source-presence increments and is capped at 100%.

Scenario envelopes use an oriented ellipse-like polygon with 2/5/10 km directional spread and 1/2/4 km crosswind. They are explicitly not predicted fire perimeters. Exposure uses point-in-polygon intersection plus haversine distance bands. Loss and claims use configurable synthetic ratios in `analytics/core.py`; reinsurance is a synthetic €100m layer attaching above €50m retention.

## Five-minute demo

1. Start `make demo`; open Risk Radar and select Hürtgenwald.
2. Use **Help / demo guide** for the screen-by-screen explanation.
3. Open Event Intelligence; click **Why?** to inspect source-backed components and deterministic proxy assumptions.
4. Use Portfolio Impact to show distance-band policies and TIV.
5. Compare Current, Adverse, and Severe; observe geometry, exposure, losses, claims, and treaty status update.
6. Open Action Center; move operational statuses from Not started to In Progress/Completed.
7. Replay snapshots are represented by the deterministic timeline payload and reset to the final showcase snapshot with **Reset demo**.

## Verify

```bash
make test
```

Tests cover weighted risk bounds and missing sources, exact polygon/TIV selection, scenario area monotonicity/orientation anchor, known loss-ratio arithmetic, provider normalization, nationwide warning filtering, and live-event clustering.
