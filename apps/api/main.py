"""Small standard-library HTTP service for the wildfire radar."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import RLock
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

from adapters import fetch_and_normalize

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from analytics.core import SCENARIOS, calculate_risk, confidence_score, exposure, loss_and_claims, reinsurance, risk_components, scenario_envelope, trend
from discovery import discover_live_events
from synthetic.generate_portfolio import generate

FIXTURES = ROOT / "data" / "fixtures"
DEMO = ROOT / "data" / "demo"
LIVE_HISTORY = ROOT / "data" / "live" / "snapshots.jsonl"
MODE = os.getenv("DATA_MODE", "demo").lower()
_state_lock = RLock()
_exposure_cache: dict[tuple[str, str, int | None], dict] = {}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def fetch_payload(url: str):
    request = Request(url, headers={"User-Agent": "NRW-Wildfire-Radar/1.0", "Accept": "application/json,text/csv,*/*"})
    with urlopen(request, timeout=8) as response:
        raw = response.read()
    text = raw.decode("utf-8-sig")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def source(name: str, fixture: str, env_name: str, event: dict, max_warnings_env: str = "NINA_MAX_WARNINGS"):
    fallback = read_json(FIXTURES / fixture)
    url = os.getenv(env_name)
    freshness = 12 if "FIRMS" in name else 28
    if MODE != "live":
        return fallback, {"mode": "demo", "status": "online", "freshness_minutes": freshness, "detail": "deterministic fixture"}
    if not url:
        return fallback, {"mode": "live", "status": "fallback", "freshness_minutes": freshness, "detail": f"{env_name} not configured; deterministic fixture"}
    try:
        adapter = {
            "NASA FIRMS": "firms",
            "NASA FIRMS / Germany": "firms",
            "DWD": "dwd",
            "NINA": "nina",
            "NINA / Germany": "nina",
            "EFFIS": "effis",
        }[name]
        payload = fetch_and_normalize(
            adapter,
            url,
            event,
            fetch_payload,
            max_nina_warnings=int(os.getenv(max_warnings_env, "10")),
        )
        return payload, {"mode": "live", "status": "online", "freshness_minutes": 0, "detail": "live response"}
    except Exception as exc:
        return fallback, {"mode": "live", "status": "fallback", "freshness_minutes": freshness, "detail": f"live unavailable: {type(exc).__name__}"}


def make_record(event: dict, firms: dict, dwd: dict, nina: dict, effis: dict, timeline: list[dict] | None = None):
    warnings = nina.get("warnings", [])
    warning = warnings[0] if warnings else {}
    signals = {
        "active_fire_detections": firms.get("observations", []),
        "dwd_danger": dwd.get("danger_level"),
        "weather_score": dwd.get("score"),
        "wind_direction": dwd.get("wind_direction", event.get("wind_direction", 0)),
        "wind_speed_kmh": dwd.get("wind_speed_kmh", event.get("wind_speed_kmh", 0)),
        "wind_gust_kmh": dwd.get("wind_gust_kmh", 0),
        "warning_level": warning.get("level", "none"),
        "effis_context": bool(effis.get("features")),
        "local_confirmation": True,
        "recent_observation": bool(firms.get("observations")),
    }
    return {
        "event": event,
        "firms": firms,
        "dwd": dwd,
        "nina": nina,
        "effis": effis,
        "warning": warning,
        "signals": signals,
        "timeline": timeline or [],
    }


def load_state(persist: bool = False):
    showcase = read_json(FIXTURES / "event.json")
    showcase_firms, firms_health = source("NASA FIRMS", "firms_sample.json", "FIRMS_URL", showcase)
    dwd, dwd_health = source("DWD", "dwd_sample.json", "DWD_URL", showcase)
    nina, nina_health = source("NINA", "nina_sample.json", "NINA_URL", showcase)
    effis, effis_health = source("EFFIS", "effis_sample.geojson", "EFFIS_URL", showcase)
    showcase_record = make_record(showcase, showcase_firms, dwd, nina, effis, read_json(FIXTURES / "timeline.json")["snapshots"])

    health = {
        "NASA FIRMS": firms_health,
        "DWD": dwd_health,
        "NINA": nina_health,
        "EFFIS / Copernicus": effis_health,
    }
    records = [showcase_record]
    if MODE == "live":
        nationwide_firms, nationwide_firms_health = source("NASA FIRMS / Germany", "firms_sample.json", "FIRMS_NATIONWIDE_URL", showcase)
        nationwide_nina, nationwide_nina_health = source("NINA / Germany", "nina_sample.json", "NINA_INDEX_URL", showcase, "NINA_INDEX_MAX_WARNINGS")
        health["NASA FIRMS / Germany"] = nationwide_firms_health
        health["NINA / Germany"] = nationwide_nina_health
        records = discover_live_events(nationwide_firms, nationwide_nina, dwd, effis, int(os.getenv("LIVE_EVENT_LIMIT", "25")))
        if not records:
            records = [showcase_record]
        else:
            for record in records:
                record["timeline"] = []

    selected = records[0]
    state = {
        "event": selected["event"],
        "events": records,
        "records": {record["event"]["id"]: record for record in records},
        "firms": selected["firms"],
        "dwd": selected["dwd"],
        "nina": selected["nina"],
        "effis": selected["effis"],
        "warning": selected["warning"],
        "signals": selected["signals"],
        "portfolio": read_json(DEMO / "portfolio.json") if (DEMO / "portfolio.json").exists() else generate(),
        "health": health,
        "timeline": selected["timeline"],
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    if persist and MODE == "live":
        save_snapshot(state)
    return state


def snapshot_risk(record: dict) -> dict:
    components = risk_components(record["signals"])
    confidence = confidence_score(record["signals"])
    return {"score": calculate_risk(components), "confidence_percent": confidence}


def save_snapshot(state: dict) -> None:
    LIVE_HISTORY.parent.mkdir(parents=True, exist_ok=True)
    snapshot = {
        "captured_at": state["updated_at"],
        "mode": MODE,
        "sources": state["health"],
        "events": [
            {
                "event": record["event"],
                "risk": snapshot_risk(record),
                "firms": record["firms"],
                "dwd": record["dwd"],
                "nina": record["nina"],
                "effis": record["effis"],
                "warning": record["warning"],
                "signals": record["signals"],
            }
            for record in state["records"].values()
        ],
    }
    with LIVE_HISTORY.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(snapshot, separators=(",", ":")) + "\n")


def history(event_id: str | None = None) -> list[dict]:
    if not LIVE_HISTORY.exists():
        return []
    snapshots = []
    for line in LIVE_HISTORY.read_text(encoding="utf-8").splitlines():
        try:
            snapshot = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event_id:
            snapshot["events"] = [event for event in snapshot.get("events", []) if event.get("event", {}).get("id") == event_id]
            if not snapshot["events"]:
                continue
        snapshots.append(snapshot)
    return snapshots[-100:]


STATE = load_state(persist=True)


def record_for(event_id: str | None = None) -> dict:
    selected_id = event_id or STATE["event"]["id"]
    try:
        return STATE["records"][selected_id]
    except KeyError as exc:
        raise KeyError(selected_id) from exc


def risk_payload(event_id: str | None = None, at: int | None = None):
    record = record_for(event_id)
    signals = dict(record["signals"])
    timeline = record.get("timeline", [])
    if at is not None and 0 <= at < len(timeline):
        snap = timeline[at]
        signals["active_fire_detections"] = record["firms"]["observations"][:snap["active_fire_count"]]
        signals["warning_level"] = snap["warning_level"]
        if snap["warning_level"] == "none":
            signals["warning_score"] = 0
    components = risk_components(signals)
    score = calculate_risk(components)
    confidence = confidence_score(signals)
    if timeline:
        previous = timeline[max(0, (at if at is not None else len(timeline) - 1) - 1)]["risk_score"]
        current_trend = trend(score, previous)
    else:
        previous = score
        current_trend = record["event"].get("trend", "stable")
    return {
        "score": score,
        "confidence": confidence / 100,
        "confidence_percent": confidence,
        "trend": current_trend,
        "components": components,
        "weights": {"active_fire": .25, "weather": .20, "wind": .15, "warning": .15, "vegetation": .10, "growth": .10, "corroboration": .05},
        "method": "Weighted transparent components. Active fire, DWD weather, wind and warning values come from the selected source snapshot. Vegetation/fuel uses a neutral 50 proxy because no vegetation feed is loaded; growth uses 20 + 5 per active-fire detection. Those proxies are deterministic assumptions, not random observations. Risk is not a scientific fire-spread probability.",
        "previous_score": previous,
    }


def computed_exposure(event_id: str | None, scenario: str, at: int | None = None):
    scenario = scenario if scenario in SCENARIOS else "current"
    cache_key = (event_id or STATE["event"]["id"], scenario, at)
    if cache_key in _exposure_cache:
        return _exposure_cache[cache_key]
    record = record_for(event_id)
    event = record["event"]
    centroid = (event["centroid"]["latitude"], event["centroid"]["longitude"])
    wind = record["signals"].get("wind_direction", event.get("wind_direction", 0))
    feature = scenario_envelope(centroid, wind, scenario)
    result = exposure(STATE["portfolio"], centroid, event.get("event_radius_km", 1), feature)
    result["scenario_geometry"] = feature
    result["scenario"]["name"] = SCENARIOS[scenario]["name"]
    result["scenario"]["key"] = scenario
    estimates = loss_and_claims(result, scenario)
    result["estimates"] = estimates
    result["reinsurance"] = reinsurance(estimates["loss_low"], estimates["loss_high"])
    if at is not None and at < len(record.get("timeline", [])):
        result["replay"] = record["timeline"][at]
    _exposure_cache[cache_key] = result
    return result


def compact_event(record: dict) -> dict:
    event = dict(record["event"])
    event["risk"] = risk_payload(event["id"])
    event["active_fire_count"] = len(record["firms"].get("observations", []))
    event["warning_level"] = record["warning"].get("level", "none")
    return event


def actions():
    path = DEMO / "actions.json"
    if path.exists():
        return read_json(path)
    return [
        {"id": "claims", "team": "Claims", "title": "Activate catastrophe claims workflow", "detail": "Prepare field adjuster capacity against the selected planning range.", "status": "Not started"},
        {"id": "customer", "team": "Customer operations", "title": "Prepare geotargeted warning communication", "detail": "Prioritise policyholders in the highest-risk zones.", "status": "Not started"},
        {"id": "reinsurance", "team": "Reinsurance", "title": "Notify catastrophe / reinsurance team", "detail": "Review adverse and severe attachment awareness outputs.", "status": "Not started"},
        {"id": "finance", "team": "Finance", "title": "Prepare preliminary reserve", "detail": "Use the indicative loss range as a planning input only.", "status": "Not started"},
    ]


def save_actions(items):
    DEMO.mkdir(parents=True, exist_ok=True)
    (DEMO / "actions.json").write_text(json.dumps(items, indent=2), encoding="utf-8")


def response_payload(path: str, query: dict[str, list[str]]):
    parts = [part for part in path.split("/") if part]
    if parts == ["api", "health"]:
        return {"ok": True, "mode": MODE, "updated_at": STATE["updated_at"], "sources": STATE["health"]}
    if parts == ["api", "events"]:
        return {"events": [compact_event(record) for record in STATE["records"].values()], "updated_at": STATE["updated_at"]}
    if parts == ["api", "history"]:
        return {"snapshots": history(query.get("event_id", [None])[0])}
    if len(parts) >= 3 and parts[:2] == ["api", "events"]:
        event_id = parts[2]
        record = record_for(event_id)
        at_value = int(query.get("at", ["-1"])[0])
        at = None if at_value < 0 else at_value
        if len(parts) == 3:
            return {"event": compact_event(record), "sources": STATE["health"], "warning": record["warning"]}
        resource = parts[3]
        if resource == "signals":
            return {"firms": record["firms"], "dwd": record["dwd"], "warning": record["warning"], "effis": record["effis"]}
        if resource == "risk":
            return risk_payload(event_id, at)
        if resource == "timeline":
            return {"event_id": event_id, "snapshots": record.get("timeline", [])}
        if resource == "scenarios":
            return {"scenarios": [{"key": key, **spec, "exposure": computed_exposure(event_id, key, at)} for key, spec in SCENARIOS.items()]}
        if resource == "exposure":
            return computed_exposure(event_id, query.get("scenario", ["current"])[0], at)
        if resource == "actions":
            return {"actions": actions()}
    if parts == ["api", "sources"]:
        return {"sources": STATE["health"]}
    raise KeyError(path)


def refresh_state():
    global STATE, _exposure_cache
    new_state = load_state(persist=True)
    with _state_lock:
        STATE = new_state
        _exposure_cache = {}
    return new_state


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def send_json(self, body, status=200):
        raw = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            try:
                self.send_json(response_payload(parsed.path, parse_qs(parsed.query)))
            except KeyError:
                self.send_json({"error": "Not found"}, 404)
            except Exception as exc:
                self.send_json({"error": str(exc)}, 500)
            return
        file_path = ROOT / "apps" / "web" / ("index.html" if parsed.path in ("/", "") else parsed.path.lstrip("/"))
        if not file_path.is_file():
            file_path = ROOT / "apps" / "web" / "index.html"
        content = file_path.read_bytes()
        content_type = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml"}.get(file_path.suffix, "text/plain")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/refresh":
            try:
                state = refresh_state()
                self.send_json({"ok": True, "mode": MODE, "updated_at": state["updated_at"], "events": [compact_event(record) for record in state["records"].values()], "sources": state["health"]})
            except Exception as exc:
                self.send_json({"error": str(exc)}, 502)
            return
        self.send_json({"error": "Not found"}, 404)

    def do_PATCH(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/actions/"):
            try:
                action_id = parsed.path.rsplit("/", 1)[1]
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
                items = actions()
                for item in items:
                    if item["id"] == action_id:
                        item["status"] = body.get("status", item["status"])
                save_actions(items)
                self.send_json({"actions": items})
                return
            except Exception as exc:
                self.send_json({"error": str(exc)}, 400)
                return
        self.send_json({"error": "Not found"}, 404)


def main():
    port = int(os.getenv("PORT", "8025"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"NRW Wildfire Radar listening on http://0.0.0.0:{port} ({MODE} mode)", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
