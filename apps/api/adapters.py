"""Adapters for live wildfire data providers.

The API keeps a small internal source model matching the checked-in fixtures.
Provider responses are intentionally normalized at the boundary so analytics do
not need to know whether a source returned CSV, CAP-like JSON, or GeoJSON.
"""
import csv
import io
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Callable
from urllib.parse import urlsplit, urlunsplit



class AdapterError(ValueError):
    """Raised when a provider response cannot be normalized safely."""


def _first(mapping: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        value = mapping.get(key)
        if value not in (None, ""):
            return value
    return default


def _float(value: Any, *, default: float | None = None) -> float | None:
    if value in (None, ""):
        return default
    try:
        return float(str(value).strip().replace(",", "."))
    except (TypeError, ValueError):
        return default


def _int(value: Any, *, default: int | None = None) -> int | None:
    number = _float(value)
    return default if number is None else int(number)


def _timestamp(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        # ArcGIS dates are milliseconds since Unix epoch.
        seconds = float(value) / (1000 if float(value) > 10_000_000_000 else 1)
        return datetime.fromtimestamp(seconds, timezone.utc).isoformat().replace("+00:00", "Z")
    text = str(value).strip()
    if text.isdigit():
        return _timestamp(int(text))
    return text


def _confidence(value: Any) -> float | str | None:
    if value in (None, ""):
        return None
    numeric = _float(value)
    if numeric is None:
        return {"h": 0.9, "n": 0.5, "l": 0.2}.get(str(value).strip().lower(), str(value).strip().lower())
    return numeric / 100 if numeric > 1 else numeric


def _parse_firms_csv(payload: str) -> list[dict[str, Any]]:
    rows = csv.DictReader(io.StringIO(payload))
    if not rows.fieldnames or not {field.lower() for field in rows.fieldnames} & {"latitude", "lat"}:
        raise AdapterError("NASA FIRMS CSV has no latitude column")
    observations: list[dict[str, Any]] = []
    for row in rows:
        latitude = _float(_first(row, "latitude", "lat"))
        longitude = _float(_first(row, "longitude", "lon", "lng"))
        if latitude is None or longitude is None:
            continue
        date = _first(row, "acq_date", "date", "observed_at")
        time = _first(row, "acq_time", "time")
        observed_at = f"{date}T{str(time).zfill(4)[:2]}:{str(time).zfill(4)[2:]}:00Z" if date and time else _timestamp(date)
        observations.append({
            "id": str(_first(row, "id", "id_number", default=f"firms-{len(observations) + 1}")),
            "latitude": latitude,
            "longitude": longitude,
            "observed_at": observed_at,
            "satellite": _first(row, "satellite", "instrument", default="unknown"),
            "confidence": _confidence(_first(row, "confidence", "conf")),
            "frp": _float(_first(row, "frp", "fire_radiative_power"), default=0),
        })
    return observations


def normalize_firms(payload: Any) -> dict[str, Any]:
    """Normalize FIRMS JSON or official area-API CSV into fixture shape."""
    if isinstance(payload, str):
        observations = _parse_firms_csv(payload)
    else:
        if isinstance(payload, dict):
            raw = payload.get("observations", payload.get("data", payload.get("features")))
        elif isinstance(payload, list):
            raw = payload
        else:
            raise AdapterError("NASA FIRMS response is not JSON or CSV")
        if raw is None or not isinstance(raw, list):
            raise AdapterError("NASA FIRMS response has no observations list")
        observations = []
        for index, item in enumerate(raw, 1):
            row = item.get("properties", item) if isinstance(item, dict) else {}
            latitude = _float(_first(row, "latitude", "lat"))
            longitude = _float(_first(row, "longitude", "lon", "lng"))
            if latitude is None or longitude is None:
                continue
            observations.append({
                "id": str(_first(row, "id", "id_number", default=f"firms-{index}")),
                "latitude": latitude,
                "longitude": longitude,
                "observed_at": _timestamp(_first(row, "observed_at", "acq_datetime", "timestamp")),
                "satellite": _first(row, "satellite", "instrument", default="unknown"),
                "confidence": _confidence(_first(row, "confidence", "confidence_percent")),
                "frp": _float(_first(row, "frp", "fire_radiative_power"), default=0),
            })
    return {"source": "NASA FIRMS", "observations": observations}


def _dwd_row(payload: Any, event: dict[str, Any] | None) -> dict[str, Any]:
    if isinstance(payload, dict) and "features" in payload:
        rows = payload["features"]
        if not isinstance(rows, list) or not rows:
            raise AdapterError("DWD FeatureServer response has no features")
        centroid = (event or {}).get("centroid", {})
        target = (_float(centroid.get("latitude")), _float(centroid.get("longitude")))
        candidates = []
        for feature in rows:
            attrs = feature.get("attributes", feature.get("properties", {}))
            lat = _float(_first(attrs, "geoBreite", "latitude", "lat"))
            lon = _float(_first(attrs, "geoLaenge", "longitude", "lon"))
            if target[0] is not None and target[1] is not None and lat is not None and lon is not None:
                distance = (lat - target[0]) ** 2 + (lon - target[1]) ** 2
            else:
                distance = len(candidates)
            candidates.append((distance, attrs))
        return min(candidates, key=lambda candidate: candidate[0])[1]
    if isinstance(payload, dict):
        if isinstance(payload.get("data"), list):
            return _dwd_row({"features": payload["data"]}, event)
        return payload
    if isinstance(payload, list) and payload:
        return _dwd_row({"features": payload}, event)
    raise AdapterError("DWD response has no usable record")


def normalize_dwd(payload: Any, event: dict[str, Any] | None = None) -> dict[str, Any]:
    """Normalize fixture JSON or the DWD ArcGIS FeatureServer response."""
    row = _dwd_row(payload, event)
    danger = _int(_first(row, "danger_level", "wbi_tag", "wbi", "WBI", "waldbrandgefahrenindex"))
    if danger is None:
        raise AdapterError("DWD response has no wildfire danger level")
    danger = max(1, min(5, danger))
    result = {
        "source": "DWD",
        "observed_at": _timestamp(_first(row, "observed_at", "tag", "date")),
        "danger_level": danger,
        "temperature_c": _float(_first(row, "temperature_c", "temperature", "temp_c")),
        "humidity_percent": _float(_first(row, "humidity_percent", "humidity", "relative_humidity")),
        "wind_direction": _float(_first(row, "wind_direction", "wind_dir", "wind_direction_deg")),
        "wind_speed_kmh": _float(_first(row, "wind_speed_kmh", "wind_speed", "wind_kmh")),
        "wind_gust_kmh": _float(_first(row, "wind_gust_kmh", "wind_gust", "gust_kmh")),
        "precipitation_24h_mm": _float(_first(row, "precipitation_24h_mm", "precipitation", "rain_mm")),
        "score": _float(_first(row, "score"), default=danger * 20),
    }
    return {key: value for key, value in result.items() if value is not None}


def _nina_level(value: Any) -> str:
    text = str(value or "").strip().lower()
    if text in {"extreme", "severe", "evacuation", "red"}:
        return "evacuation"
    if text in {"moderate", "minor", "official warning", "warning", "orange"}:
        return "official warning"
    if text in {"informational", "info", "green", "yellow"}:
        return "informational"
    return "none"


def _nina_warning(item: dict[str, Any], geometry: dict[str, Any] | None = None) -> dict[str, Any]:
    if isinstance(item.get("payload"), dict):
        item = item["payload"]
    data = item.get("data", item)
    info = data.get("info", [{}])[0] if isinstance(data.get("info"), list) else data.get("info", {})
    if not info or not isinstance(info, dict):
        info = data
    area = info.get("area", [{}]) if isinstance(info.get("area"), list) else info.get("area", {})
    if isinstance(area, list):
        area = area[0] if area else {}
    if not isinstance(area, dict):
        area = {}
    identifier = _first(item, "identifier", "id", default=_first(data, "identifier", "id", default="nina-warning"))
    warning = {
        "id": str(identifier),
        "level": _nina_level(_first(info, "severity", "level")),
        "title": _first(info, "headline", "event", default="Official warning"),
        "description": _first(info, "description", "instruction", default=""),
        "issued_at": _timestamp(_first(item, "sent", "issued_at", default=_first(info, "effective"))),
        "expires_at": _timestamp(_first(info, "expires", "expires_at")),
        "area": _first(area, "areaDesc", "area", default=""),
    }
    if geometry:
        warning["geometry"] = geometry
    return {key: value for key, value in warning.items() if value not in (None, "")}


def normalize_nina(payload: Any) -> dict[str, Any]:
    """Normalize fixture JSON, NINA dashboard arrays, or CAP-like warning JSON."""
    if isinstance(payload, dict) and isinstance(payload.get("warnings"), list):
        warnings = [_nina_warning(item, item.get("geometry")) for item in payload["warnings"] if isinstance(item, dict)]
    elif isinstance(payload, list):
        warnings = [_nina_warning(item, item.get("geometry")) for item in payload if isinstance(item, dict)]
    elif isinstance(payload, dict):
        warnings = [_nina_warning(payload, payload.get("geometry"))]
    else:
        raise AdapterError("NINA response is not JSON")
    return {"source": "NINA", "warnings": warnings}


def normalize_effis(payload: Any) -> dict[str, Any]:
    """Normalize GeoJSON or a feature-list wrapper into a FeatureCollection."""
    if isinstance(payload, dict) and payload.get("type") == "FeatureCollection":
        features = payload.get("features")
    elif isinstance(payload, dict) and isinstance(payload.get("features"), list):
        features = payload["features"]
    elif isinstance(payload, list):
        features = payload
    else:
        raise AdapterError("EFFIS response is not a GeoJSON feature collection")
    if not isinstance(features, list):
        raise AdapterError("EFFIS response has no features list")
    valid = [feature for feature in features if isinstance(feature, dict) and feature.get("geometry")]
    return {"type": "FeatureCollection", "source": "EFFIS / Copernicus", "features": valid}


def _dashboard_warning_ids(payload: Any, *, fire_only: bool = False) -> list[str]:
    if not isinstance(payload, list):
        return []
    ids = []
    fire_terms = ("waldbrand", "waldbrandgefahr", "vegetationsbrand", "brandrauch", "rauch", "feuer")
    fire_codes = {"BBK-EVC-011", "BBK-EVC-030", "BBK-EVC-077"}
    for item in payload:
        if not isinstance(item, dict):
            continue
        title = str(((item.get("i18nTitle") or {}).get("de", ""))).lower()
        event_code = str((item.get("transKeys") or {}).get("event", ""))
        if fire_only and event_code not in fire_codes and not any(term in title for term in fire_terms):
            continue
        warning_id = _first(item, "id", "identifier", default=_first(item.get("payload", {}), "id", "identifier"))
        if warning_id:
            ids.append(str(warning_id))
    return ids


def normalize_source(name: str, payload: Any, event: dict[str, Any] | None = None) -> dict[str, Any]:
    key = name.lower()
    if key == "firms":
        return normalize_firms(payload)
    if key == "dwd":
        return normalize_dwd(payload, event)
    if key == "nina":
        return normalize_nina(payload)
    if key == "effis":
        return normalize_effis(payload)
    raise AdapterError(f"unknown source adapter: {name}")


def fetch_and_normalize(
    name: str,
    url: str,
    event: dict[str, Any] | None,
    fetch: Callable[[str], Any],
    *,
    max_nina_warnings: int = 10,
) -> dict[str, Any]:
    """Fetch a configured endpoint and normalize it, including NINA details."""
    payload = fetch(url)
    if name.lower() != "nina":
        return normalize_source(name, payload, event)

    # NINA dashboard responses contain references. Fetch details and geometry
    # when the configured URL is a dashboard endpoint; direct warning/fixture
    # URLs remain supported.
    parts = urlsplit(url)
    is_nationwide_map = "/mowas/mapData" in parts.path
    ids = _dashboard_warning_ids(payload, fire_only=is_nationwide_map)
    if not ids:
        return normalize_nina(payload)
    if "/dashboard/" in parts.path:
        base_path = parts.path.split("/dashboard/", 1)[0]
    elif "/mowas/" in parts.path:
        base_path = parts.path.split("/mowas/", 1)[0]
    else:
        base_path = parts.path.rsplit("/", 1)[0]
    def fetch_warning(warning_id: str):
        detail_path = f"{base_path}/warnings/{warning_id}.json"
        detail_url = urlunsplit((parts.scheme, parts.netloc, detail_path, "", ""))
        detail = fetch(detail_url)
        geometry_payload = fetch(detail_url[:-5] + ".geojson")
        geometry = geometry_payload if isinstance(geometry_payload, dict) and geometry_payload.get("type") in {"Feature", "FeatureCollection"} else None
        return _nina_warning(detail, geometry)

    warnings = []
    with ThreadPoolExecutor(max_workers=min(8, len(ids[:max_nina_warnings]))) as executor:
        futures = [executor.submit(fetch_warning, warning_id) for warning_id in ids[:max_nina_warnings]]
        for future in as_completed(futures):
            try:
                warnings.append(future.result())
            except Exception:
                continue
    return {"source": "NINA", "warnings": warnings}
