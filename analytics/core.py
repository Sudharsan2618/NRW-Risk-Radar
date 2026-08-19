"""Transparent, dependency-free analytics for the NRW wildfire prototype."""
from __future__ import annotations

import math
from typing import Any, Iterable

RISK_WEIGHTS = {"active_fire": 0.25, "weather": 0.20, "wind": 0.15, "warning": 0.15, "vegetation": 0.10, "growth": 0.10, "corroboration": 0.05}
DWD_SCORES = {1: 10, 2: 30, 3: 50, 4: 75, 5: 100}
WARNING_SCORES = {"none": 0, "informational": 20, "official warning": 60, "severe warning": 80, "evacuation": 100}
SCENARIOS = {"current": {"name": "Current", "spread_km": 2, "crosswind_km": 1, "severity": 45}, "adverse": {"name": "Adverse", "spread_km": 5, "crosswind_km": 2, "severity": 70}, "severe": {"name": "Severe", "spread_km": 10, "crosswind_km": 4, "severity": 95}}
LOSS_RATIOS = {"inside": (0.25, 0.80), "current": (0.05, 0.25), "adverse": (0.01, 0.10), "severe": (0.002, 0.05)}
CLAIM_RATIOS = {"inside": (0.60, 0.90), "current": (0.15, 0.40), "adverse": (0.05, 0.20), "severe": (0.01, 0.08)}


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a); lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(h))


def bearing_degrees(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lat2 = map(math.radians, (a[0], b[0])); dlon = math.radians(b[1] - a[1])
    return (math.degrees(math.atan2(math.sin(dlon) * math.cos(lat2), math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon))) + 360) % 360


def risk_components(signals: dict[str, Any]) -> dict[str, float]:
    fires = signals.get("active_fire_detections", [])
    active = float(signals.get("active_fire_score", min(100, 25 + len(fires) * 12))) if fires else 0
    weather = float(signals.get("weather_score", DWD_SCORES.get(int(signals["dwd_danger"]), 0))) if signals.get("dwd_danger") is not None else 0
    wind_speed = float(signals.get("wind_speed_kmh", 28))
    wind = float(signals.get("wind_score", clamp(wind_speed * 2.25 + (12 if signals.get("wind_gust_kmh", 0) > 45 else 0))))
    warning_level = str(signals.get("warning_level", "none")).lower()
    warning = float(signals.get("warning_score", WARNING_SCORES.get(warning_level, 0)))
    vegetation = float(signals["vegetation_score"]) if "vegetation_score" in signals else (50 if signals else 0)
    growth = float(signals["growth_score"]) if "growth_score" in signals else (min(100, 20 + len(fires) * 5) if signals else 0)
    sources = sum(bool(signals.get(k)) for k in ("active_fire_detections", "dwd_danger", "warning_level", "effis_context"))
    corroboration = float(signals.get("corroboration_score", clamp(sources / 4 * 100)))
    return {"active_fire": clamp(active), "weather": clamp(weather), "wind": clamp(wind), "warning": clamp(warning), "vegetation": clamp(vegetation), "growth": clamp(growth), "corroboration": clamp(corroboration)}


def calculate_risk(components: dict[str, float]) -> int:
    return round(clamp(sum(components.get(name, 0) * weight for name, weight in RISK_WEIGHTS.items())))


def confidence_score(signals: dict[str, Any]) -> int:
    score = 25 if signals.get("active_fire_detections") else 0
    score += 20 if signals.get("effis_context") else 0; score += 10 if signals.get("dwd_danger") else 0
    score += 25 if signals.get("warning_level") and signals.get("warning_level") != "none" else 0
    score += 15 if signals.get("local_confirmation") else 0; score += 5 if signals.get("recent_observation") else 0
    return min(100, score)


def trend(current: int, previous: int) -> str:
    return "increasing" if current - previous >= 3 else "decreasing" if current - previous <= -3 else "stable"


def scenario_envelope(centroid: tuple[float, float], wind_direction: float, scenario: str) -> dict[str, Any]:
    spec = SCENARIOS[scenario]; lat, lon = centroid; lat_km = 111.32; lon_km = lat_km * math.cos(math.radians(lat)); theta = math.radians(wind_direction)
    points: list[list[float]] = []
    for i in range(49):
        angle = 2 * math.pi * i / 48
        along = spec["spread_km"] * (0.5 + 0.5 * math.cos(angle))
        cross = spec["crosswind_km"] * math.sin(angle)
        x = math.sin(theta) * along + math.cos(theta) * cross
        y = math.cos(theta) * along - math.sin(theta) * cross
        points.append([lon + x / lon_km, lat + y / lat_km])
    return {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [points]}, "properties": {"scenario": scenario, "label": "Scenario threat envelope", "spread_km": spec["spread_km"], "crosswind_km": spec["crosswind_km"], "wind_direction": wind_direction}}


def point_in_polygon(point: tuple[float, float], polygon: list[list[float]]) -> bool:
    x, y = point[1], point[0]; inside = False
    for i in range(len(polygon)):
        x1, y1 = polygon[i][0], polygon[i][1]; x2, y2 = polygon[(i + 1) % len(polygon)][0], polygon[(i + 1) % len(polygon)][1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-12) + x1: inside = not inside
    return inside


def exposure(policies: Iterable[dict[str, Any]], centroid: tuple[float, float], event_radius_km: float, scenario_feature: dict[str, Any]) -> dict[str, Any]:
    polygon = scenario_feature["geometry"]["coordinates"][0]; bands = {"inside": [], "0_1km": [], "1_3km": [], "3_5km": [], "5_10km": []}; scenario_policies: list[dict[str, Any]] = []
    for policy in policies:
        point = (policy["latitude"], policy["longitude"]); distance = haversine_km(centroid, point)
        if point_in_polygon(point, polygon): scenario_policies.append(policy)
        if distance <= event_radius_km: bands["inside"].append(policy)
        elif distance <= 1: bands["0_1km"].append(policy)
        elif distance <= 3: bands["1_3km"].append(policy)
        elif distance <= 5: bands["3_5km"].append(policy)
        elif distance <= 10: bands["5_10km"].append(policy)
    def aggregate(items: list[dict[str, Any]]) -> dict[str, Any]:
        return {"policies": len(items), "building_tiv": sum(p["building_tiv"] for p in items), "contents_tiv": sum(p["contents_tiv"] for p in items), "tiv": sum(p["total_tiv"] for p in items)}
    return {"scenario": aggregate(scenario_policies), "bands": {key: aggregate(value) for key, value in bands.items()}, "scenario_policy_ids": [p["policy_id"] for p in scenario_policies]}


def loss_and_claims(exposure_data: dict[str, Any], scenario: str) -> dict[str, Any]:
    total = exposure_data["scenario"]["tiv"]; inside = exposure_data["bands"]["inside"]["tiv"]; outer = max(0, total - inside); inside_low, inside_high = LOSS_RATIOS["inside"]; outer_low, outer_high = LOSS_RATIOS[scenario]
    loss_low, loss_high = round(inside * inside_low + outer * outer_low), round(inside * inside_high + outer * outer_high)
    c_inside_low, c_inside_high = CLAIM_RATIOS["inside"]; c_outer_low, c_outer_high = CLAIM_RATIOS[scenario]; outer_policies = max(0, exposure_data["scenario"]["policies"] - exposure_data["bands"]["inside"]["policies"])
    claims_low = round(exposure_data["bands"]["inside"]["policies"] * c_inside_low + outer_policies * c_outer_low); claims_high = round(exposure_data["bands"]["inside"]["policies"] * c_inside_high + outer_policies * c_outer_high)
    return {"loss_low": loss_low, "loss_high": loss_high, "claims_low": claims_low, "claims_high": claims_high, "ratios": {"inside": [inside_low, inside_high], "outer": [outer_low, outer_high]}}


def reinsurance(loss_low: int, loss_high: int, retention: int = 50_000_000, limit: int = 100_000_000) -> dict[str, Any]:
    status = "below retention" if loss_high < retention else "potentially attaches" if loss_low < retention else "attaches"
    return {"retention": retention, "limit": limit, "status": status, "ceded_loss_low": max(0, min(limit, loss_low - retention)), "ceded_loss_high": max(0, min(limit, loss_high - retention))}
