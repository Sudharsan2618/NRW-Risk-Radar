"""Small FastAPI-shaped HTTP service using only Python's standard library.
Run with: uv run python apps/api/main.py
"""
from __future__ import annotations
import json, os, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from analytics.core import SCENARIOS, calculate_risk, confidence_score, exposure, loss_and_claims, reinsurance, risk_components, scenario_envelope, trend
from synthetic.generate_portfolio import generate

FIXTURES = ROOT / "data" / "fixtures"; DEMO = ROOT / "data" / "demo"
MODE = os.getenv("DATA_MODE", "demo").lower()

def read_json(path: Path): return json.loads(path.read_text(encoding="utf-8"))
def source(name: str, fixture: str, env_name: str):
    fallback = read_json(FIXTURES / fixture); url = os.getenv(env_name)
    if MODE != "live": return fallback, {"mode": "demo", "status": "online", "freshness_minutes": 12 if name == "NASA FIRMS" else 28, "detail": "deterministic fixture"}
    if not url: return fallback, {"mode": "live", "status": "fallback", "freshness_minutes": 12 if name == "NASA FIRMS" else 28, "detail": f"{env_name} not configured; deterministic fixture"}
    try:
        request = Request(url, headers={"User-Agent": "NRW-Wildfire-Radar/1.0"})
        with urlopen(request, timeout=8) as response: payload = json.loads(response.read().decode("utf-8"))
        return payload, {"mode": "live", "status": "online", "freshness_minutes": 0, "detail": "live response"}
    except Exception as exc:
        return fallback, {"mode": "live", "status": "fallback", "freshness_minutes": 12, "detail": f"live unavailable: {type(exc).__name__}"}

def load_state():
    event = read_json(FIXTURES / "event.json"); firms, firms_health = source("NASA FIRMS", "firms_sample.json", "FIRMS_URL"); dwd, dwd_health = source("DWD", "dwd_sample.json", "DWD_URL"); nina, nina_health = source("NINA", "nina_sample.json", "NINA_URL"); effis, effis_health = source("EFFIS", "effis_sample.geojson", "EFFIS_URL")
    portfolio_path = DEMO / "portfolio.json"
    if not portfolio_path.exists(): portfolio = generate()
    else: portfolio = read_json(portfolio_path)
    warnings = nina.get("warnings", []); warning = warnings[0] if warnings else {}
    signals = {"active_fire_detections": firms.get("observations", []), "dwd_danger": dwd.get("danger_level"), "weather_score": dwd.get("score"), "wind_direction": dwd.get("wind_direction", event["wind_direction"]), "wind_speed_kmh": dwd.get("wind_speed_kmh", event["wind_speed_kmh"]), "wind_gust_kmh": dwd.get("wind_gust_kmh", 0), "warning_level": warning.get("level", "none"), "effis_context": bool(effis.get("features")), "local_confirmation": True, "recent_observation": True}
    health = {"NASA FIRMS": firms_health, "DWD": dwd_health, "NINA": nina_health, "EFFIS / Copernicus": effis_health}
    return {"event": event, "firms": firms, "dwd": dwd, "nina": nina, "effis": effis, "warning": warning, "signals": signals, "portfolio": portfolio, "health": health, "timeline": read_json(FIXTURES / "timeline.json")["snapshots"]}

STATE = load_state(); _exposure_cache = {}

def risk_payload(at: int | None = None):
    signals = dict(STATE["signals"])
    timeline = STATE["timeline"]
    if at is not None and 0 <= at < len(timeline):
        snap = timeline[at]; signals["active_fire_detections"] = STATE["firms"]["observations"][:snap["active_fire_count"]]; signals["warning_level"] = snap["warning_level"]
        if snap["warning_level"] == "none": signals["warning_score"] = 0
    components = risk_components(signals); score = calculate_risk(components); confidence = confidence_score(signals); previous = timeline[max(0, (at if at is not None else len(timeline) - 1) - 1)]["risk_score"] if timeline else score
    return {"score": score, "confidence": confidence / 100, "confidence_percent": confidence, "trend": trend(score, previous), "components": components, "weights": {key: value for key, value in {"active_fire": .25, "weather": .20, "wind": .15, "warning": .15, "vegetation": .10, "growth": .10, "corroboration": .05}.items()}, "method": "Weighted transparent components. Active fire, DWD weather, wind and warning values come from the selected source snapshot. Vegetation/fuel uses a neutral 50 proxy because no vegetation feed is loaded; growth uses 20 + 5 per active-fire detection. Those proxies are deterministic assumptions, not random observations. Risk is not a scientific fire-spread probability."}

def computed_exposure(scenario: str, at: int | None = None):
    scenario = scenario if scenario in SCENARIOS else "current"; cache_key = (scenario, at)
    if cache_key in _exposure_cache: return _exposure_cache[cache_key]
    event = STATE["event"]; centroid = (event["centroid"]["latitude"], event["centroid"]["longitude"]); wind = STATE["signals"]["wind_direction"]
    feature = scenario_envelope(centroid, wind, scenario)
    result = exposure(STATE["portfolio"], centroid, event["event_radius_km"], feature); result["scenario_geometry"] = feature; result["scenario"]["name"] = SCENARIOS[scenario]["name"]; result["scenario"]["key"] = scenario
    estimates = loss_and_claims(result, scenario); result["estimates"] = estimates; result["reinsurance"] = reinsurance(estimates["loss_low"], estimates["loss_high"])
    if at is not None and at < len(STATE["timeline"]):
        snap = STATE["timeline"][at]; result["replay"] = snap
    _exposure_cache[cache_key] = result; return result

def compact_event():
    event = dict(STATE["event"]); event["risk"] = risk_payload(); event["active_fire_count"] = len(STATE["firms"].get("observations", [])); return event

def response_payload(path: str, query: dict[str, list[str]]):
    parts = [p for p in path.split("/") if p]
    if parts == ["api", "health"]: return {"ok": True, "mode": MODE, "sources": STATE["health"]}
    if parts == ["api", "events"]: return {"events": [compact_event()]}
    if len(parts) >= 3 and parts[:2] == ["api", "events"]:
        event_id = parts[2]
        if event_id != STATE["event"]["id"]: raise KeyError(event_id)
        at = int(query.get("at", ["-1"])[0]); at = None if at < 0 else at
        if len(parts) == 3: return {"event": compact_event(), "sources": STATE["health"], "warning": STATE["warning"]}
        resource = parts[3]
        if resource == "signals": return {"firms": STATE["firms"], "dwd": STATE["dwd"], "warning": STATE["warning"], "effis": STATE["effis"]}
        if resource == "risk": return risk_payload(at)
        if resource == "timeline": return {"event_id": event_id, "snapshots": STATE["timeline"]}
        if resource == "scenarios": return {"scenarios": [{"key": key, **spec, "exposure": computed_exposure(key, at)} for key, spec in SCENARIOS.items()]}
        if resource == "exposure": return computed_exposure(query.get("scenario", ["current"])[0], at)
        if resource == "actions": return {"actions": actions()}
    if parts == ["api", "sources"]: return {"sources": STATE["health"]}
    raise KeyError(path)

def actions():
    path = DEMO / "actions.json"
    if path.exists(): return read_json(path)
    return [{"id": "claims", "team": "Claims", "title": "Activate catastrophe claims workflow", "detail": "Prepare field adjuster capacity against the selected planning range.", "status": "Not started"}, {"id": "customer", "team": "Customer operations", "title": "Prepare geotargeted warning communication", "detail": "Prioritise policyholders in the highest-risk zones.", "status": "Not started"}, {"id": "reinsurance", "team": "Reinsurance", "title": "Notify catastrophe / reinsurance team", "detail": "Review adverse and severe attachment awareness outputs.", "status": "Not started"}, {"id": "finance", "team": "Finance", "title": "Prepare preliminary reserve", "detail": "Use the indicative loss range as a planning input only.", "status": "Not started"}]

def save_actions(items):
    DEMO.mkdir(parents=True, exist_ok=True); (DEMO / "actions.json").write_text(json.dumps(items, indent=2), encoding="utf-8")

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): return
    def send_json(self, body, status=200):
        raw = json.dumps(body, separators=(",", ":")).encode(); self.send_response(status); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(raw))); self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers(); self.wfile.write(raw)
    def do_OPTIONS(self): self.send_response(204); self.send_header("Access-Control-Allow-Origin", "*"); self.send_header("Access-Control-Allow-Methods", "GET,PATCH,OPTIONS"); self.send_header("Access-Control-Allow-Headers", "Content-Type"); self.end_headers()
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            try: self.send_json(response_payload(parsed.path, parse_qs(parsed.query)))
            except KeyError: self.send_json({"error": "Not found"}, 404)
            except Exception as exc: self.send_json({"error": str(exc)}, 500)
            return
        file_path = ROOT / "apps" / "web" / ("index.html" if parsed.path in ("/", "") else parsed.path.lstrip("/"))
        if not file_path.is_file(): file_path = ROOT / "apps" / "web" / "index.html"
        content = file_path.read_bytes(); content_type = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml"}.get(file_path.suffix, "text/plain")
        self.send_response(200); self.send_header("Content-Type", content_type); self.send_header("Content-Length", str(len(content))); self.end_headers(); self.wfile.write(content)
    def do_PATCH(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/actions/"):
            try:
                action_id = parsed.path.rsplit("/", 1)[1]; body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}"); items = actions()
                for item in items:
                    if item["id"] == action_id: item["status"] = body.get("status", item["status"])
                save_actions(items); self.send_json({"actions": items}); return
            except Exception as exc: self.send_json({"error": str(exc)}, 400); return
        self.send_json({"error": "Not found"}, 404)

def main():
    port = int(os.getenv("PORT", "8025")); server = ThreadingHTTPServer(("0.0.0.0", port), Handler); print(f"NRW Wildfire Radar listening on http://0.0.0.0:{port} ({MODE} mode)", flush=True); server.serve_forever()
if __name__ == "__main__": main()
