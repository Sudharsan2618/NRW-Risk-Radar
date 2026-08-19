"""Build live event candidates from nationwide source signals."""
from __future__ import annotations

import hashlib
import math
from datetime import datetime, timezone
from typing import Any


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(h))


def _points(value: Any) -> list[tuple[float, float]]:
    if isinstance(value, (list, tuple)):
        if len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
            return [(float(value[1]), float(value[0]))]
        points: list[tuple[float, float]] = []
        for child in value:
            points.extend(_points(child))
        return points
    return []


def geometry_centroid(geometry: dict[str, Any] | None) -> tuple[float, float] | None:
    if not isinstance(geometry, dict):
        return None
    if geometry.get("type") == "Feature":
        return geometry_centroid(geometry.get("geometry"))
    if geometry.get("type") == "FeatureCollection":
        points = [geometry_centroid(feature) for feature in geometry.get("features", [])]
        points = [point for point in points if point]
        if not points:
            return None
        return (sum(point[0] for point in points) / len(points), sum(point[1] for point in points) / len(points))
    points = _points(geometry.get("coordinates"))
    if not points:
        return None
    return (sum(point[0] for point in points) / len(points), sum(point[1] for point in points) / len(points))


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _warning_rank(level: str) -> int:
    return {"none": 0, "informational": 1, "official warning": 2, "evacuation": 3}.get(level, 0)


def _event_id(prefix: str, centroid: tuple[float, float], date: str) -> str:
    value = f"{prefix}:{centroid[0]:.3f}:{centroid[1]:.3f}:{date}".encode()
    return f"live-{prefix}-{hashlib.sha1(value).hexdigest()[:10]}"


def _observation_centroid(observations: list[dict[str, Any]]) -> tuple[float, float]:
    return (
        sum(_number(item.get("latitude")) for item in observations) / len(observations),
        sum(_number(item.get("longitude")) for item in observations) / len(observations),
    )


def cluster_firms(observations: list[dict[str, Any]], radius_km: float = 12) -> list[list[dict[str, Any]]]:
    """Cluster nearby satellite detections without treating each point as an event."""
    valid = [item for item in observations if item.get("latitude") is not None and item.get("longitude") is not None]
    if not valid:
        return []
    cell_size = radius_km / 111.0
    cells: dict[tuple[int, int], list[int]] = {}
    parents = list(range(len(valid)))

    def root(index: int) -> int:
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(left: int, right: int) -> None:
        left, right = root(left), root(right)
        if left != right:
            parents[right] = left

    for index, item in enumerate(valid):
        lat, lon = _number(item["latitude"]), _number(item["longitude"])
        cell = (int(lat / cell_size), int(lon / cell_size))
        for lat_cell in range(cell[0] - 1, cell[0] + 2):
            for lon_cell in range(cell[1] - 1, cell[1] + 2):
                for other in cells.get((lat_cell, lon_cell), []):
                    other_item = valid[other]
                    if haversine_km((lat, lon), (_number(other_item["latitude"]), _number(other_item["longitude"]))) <= radius_km:
                        union(index, other)
        cells.setdefault(cell, []).append(index)

    groups: dict[int, list[dict[str, Any]]] = {}
    for index, item in enumerate(valid):
        groups.setdefault(root(index), []).append(item)
    return list(groups.values())


def _warning_candidates(warnings: list[dict[str, Any]]) -> list[tuple[dict[str, Any], tuple[float, float]]]:
    candidates: list[tuple[dict[str, Any], tuple[float, float]]] = []
    for warning in warnings:
        title = str(warning.get("title", ""))
        if title.lower().startswith("entwarnung"):
            continue
        centroid = geometry_centroid(warning.get("geometry"))
        if centroid is None:
            continue
        replaced = False
        for index, (existing, existing_centroid) in enumerate(candidates):
            if haversine_km(centroid, existing_centroid) <= 12:
                existing_key = (_warning_rank(str(existing.get("level"))), str(existing.get("issued_at", "")))
                current_key = (_warning_rank(str(warning.get("level"))), str(warning.get("issued_at", "")))
                if current_key > existing_key:
                    candidates[index] = (warning, centroid)
                replaced = True
                break
        if not replaced:
            candidates.append((warning, centroid))
    return candidates


def _event_record(
    event: dict[str, Any],
    observations: list[dict[str, Any]],
    warning: dict[str, Any],
    dwd: dict[str, Any],
    effis: dict[str, Any],
) -> dict[str, Any]:
    warning_level = warning.get("level", "none") if warning else "none"
    signals = {
        "active_fire_detections": observations,
        "dwd_danger": dwd.get("danger_level"),
        "weather_score": dwd.get("score"),
        "wind_direction": dwd.get("wind_direction", 0),
        "wind_speed_kmh": dwd.get("wind_speed_kmh", 0),
        "wind_gust_kmh": dwd.get("wind_gust_kmh", 0),
        "warning_level": warning_level,
        "effis_context": bool(effis.get("features")),
        "local_confirmation": bool(observations or warning),
        "recent_observation": bool(observations),
    }
    return {"event": event, "firms": {"source": "NASA FIRMS", "observations": observations}, "dwd": dwd, "nina": {"source": "NINA", "warnings": [warning] if warning else []}, "effis": effis, "warning": warning, "signals": signals, "timeline": []}


def discover_live_events(
    firms: dict[str, Any],
    nina: dict[str, Any],
    dwd: dict[str, Any],
    effis: dict[str, Any],
    limit: int = 25,
) -> list[dict[str, Any]]:
    observations = firms.get("observations", [])
    warnings = nina.get("warnings", [])
    clusters = [cluster for cluster in cluster_firms(observations) if len(cluster) >= 2 or max((_number(item.get("frp")) for item in cluster), default=0) >= 20]
    warning_candidates = _warning_candidates(warnings)
    records: list[dict[str, Any]] = []
    used_clusters: set[int] = set()

    for warning, centroid in warning_candidates:
        nearest_index = None
        nearest_distance = float("inf")
        for index, cluster in enumerate(clusters):
            distance = haversine_km(centroid, _observation_centroid(cluster))
            if distance < nearest_distance and distance <= 30:
                nearest_index, nearest_distance = index, distance
        cluster = clusters[nearest_index] if nearest_index is not None else []
        if nearest_index is not None:
            used_clusters.add(nearest_index)
        event_date = str(warning.get("issued_at", "live"))[:10]
        severity = {"evacuation": 95, "official warning": 70, "informational": 40}.get(warning.get("level"), 30)
        event = {
            "id": f"live-nina-{warning.get('id', event_date).replace('.', '-').replace('/', '-')}",
            "event_type": "wildfire",
            "name": warning.get("title", "Live wildfire warning"),
            "status": "active",
            "severity": severity,
            "confidence": 0.85 if cluster else 0.7,
            "trend": "stable",
            "centroid": {"latitude": centroid[0], "longitude": centroid[1]},
            "event_radius_km": 1.5 if not cluster else min(8, max(1.5, math.sqrt(len(cluster)) / 2)),
            "started_at": warning.get("issued_at"),
            "updated_at": warning.get("issued_at"),
            "primary_source": "NINA",
            "wind_direction": dwd.get("wind_direction", 0),
            "wind_speed_kmh": dwd.get("wind_speed_kmh", 0),
            "metadata": {"warning_id": warning.get("id"), "cluster_distance_km": nearest_distance if cluster else None},
        }
        records.append(_event_record(event, cluster, warning, dwd, effis))

    for index, cluster in enumerate(clusters):
        if index in used_clusters:
            continue
        centroid = _observation_centroid(cluster)
        event_date = max((str(item.get("observed_at", "live"))[:10] for item in cluster), default="live")
        high_confidence = sum(_number(item.get("confidence"), 0) >= 0.8 for item in cluster)
        frp = sum(_number(item.get("frp")) for item in cluster)
        event = {
            "id": _event_id("firms", centroid, event_date),
            "event_type": "wildfire",
            "name": f"Satellite fire cluster · {centroid[0]:.2f}°N, {centroid[1]:.2f}°E",
            "status": "active",
            "severity": min(85, round(35 + min(25, len(cluster) * 2) + min(20, frp / 50))),
            "confidence": min(0.95, 0.45 + high_confidence * 0.05 + min(0.3, len(cluster) / 100)),
            "trend": "stable",
            "centroid": {"latitude": centroid[0], "longitude": centroid[1]},
            "event_radius_km": min(8, max(1, math.sqrt(len(cluster)) / 2)),
            "started_at": min((item.get("observed_at") for item in cluster if item.get("observed_at")), default=None),
            "updated_at": max((item.get("observed_at") for item in cluster if item.get("observed_at")), default=None),
            "primary_source": "NASA FIRMS",
            "wind_direction": dwd.get("wind_direction", 0),
            "wind_speed_kmh": dwd.get("wind_speed_kmh", 0),
            "metadata": {"detections": len(cluster), "summed_frp": round(frp, 2)},
        }
        records.append(_event_record(event, cluster, {}, dwd, effis))

    return sorted(records, key=lambda record: (record["event"]["severity"], record["event"].get("updated_at", "")), reverse=True)[:limit]
