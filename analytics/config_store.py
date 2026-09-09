"""Runtime configuration store for the wildfire radar.

All tunable numbers used by the risk engine (`analytics/core.py`) and the live
event discovery (`apps/api/discovery.py`) live here. Values are seeded from
DEFAULTS, can be overridden at runtime via the admin config screen
(`POST /api/config`), and are persisted to `data/demo/config.json` so they
survive a restart. Nothing here is loaded automatically on import — call
`load()` once at process start (main.py does this) so unit tests stay
deterministic on the defaults.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "data" / "demo" / "config.json"

DEFAULTS: dict = {
    # Weights for the 7 risk components (should sum to 1.0).
    "risk_weights": {
        "active_fire": 0.25, "weather": 0.20, "wind": 0.15, "warning": 0.15,
        "vegetation": 0.10, "growth": 0.10, "corroboration": 0.05,
    },
    # DWD wildfire danger level (1-5) -> 0-100 score.
    "dwd_scores": {"1": 10, "2": 30, "3": 50, "4": 75, "5": 100},
    # NINA warning level -> 0-100 score.
    "warning_scores": {
        "none": 0, "informational": 20, "official warning": 60,
        "severe warning": 80, "evacuation": 100,
    },
    # Active-fire score = base + per_detection * (number of hot spots), capped 100.
    "active_fire": {"base": 25, "per_detection": 12},
    # Wind score = speed_kmh * multiplier, + gust_bonus if gust > gust_threshold.
    "wind": {"multiplier": 2.25, "gust_bonus": 12, "gust_threshold": 45},
    # Vegetation/fuel proxy (fixed, no live feed).
    "vegetation": 50,
    # Growth score = base + per_detection * (number of hot spots), capped 100.
    "growth": {"base": 20, "per_detection": 5},
    # Confidence bonuses (added, capped 100).
    "confidence": {"firms": 25, "effis": 20, "dwd": 10, "warning": 25, "local": 15, "recent": 5},
    # Points of change that count as increasing / decreasing.
    "trend_threshold": 3,
    # Scenario threat envelopes: downwind reach and crosswind half-width (km).
    "scenarios": {
        "current": {"spread_km": 2, "crosswind_km": 1},
        "adverse": {"spread_km": 5, "crosswind_km": 2},
        "severe": {"spread_km": 10, "crosswind_km": 4},
    },
    # Loss ratios [low, high] as a share of insured value.
    "loss_ratios": {
        "inside": [0.25, 0.80], "current": [0.05, 0.25],
        "adverse": [0.01, 0.10], "severe": [0.002, 0.05],
    },
    # Claim probabilities [low, high] as a share of policies.
    "claim_ratios": {
        "inside": [0.60, 0.90], "current": [0.15, 0.40],
        "adverse": [0.05, 0.20], "severe": [0.01, 0.08],
    },
    # Reinsurance layer (euros).
    "reinsurance": {"retention": 50_000_000, "limit": 100_000_000},
    # Live event discovery.
    "discovery": {
        "cluster_radius_km": 12, "min_cluster_size": 2, "min_frp": 20,
        "warning_match_km": 30, "max_events": 25,
    },
}

_config: dict = copy.deepcopy(DEFAULTS)


def _coerce(default, value):
    """Force `value` to match the type/shape of `default`; fall back to default."""
    if isinstance(default, dict):
        value = value if isinstance(value, dict) else {}
        return {key: _coerce(default[key], value.get(key, default[key])) for key in default}
    if isinstance(default, list):
        if isinstance(value, list) and len(value) == len(default):
            return [_coerce(default[i], value[i]) for i in range(len(default))]
        return list(default)
    if isinstance(default, bool):
        return bool(value)
    if isinstance(default, int):
        try:
            return int(round(float(value)))
        except (TypeError, ValueError):
            return default
    if isinstance(default, float):
        try:
            return float(value)
        except (TypeError, ValueError):
            return default
    return value


def _overlay(base: dict, patch: dict) -> dict:
    """Deep-merge patch onto base (both dicts), returning a new dict."""
    out = copy.deepcopy(base)
    for key, value in (patch or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _overlay(out[key], value)
        else:
            out[key] = value
    return out


def get() -> dict:
    return _config


def load() -> dict:
    """Load persisted overrides from disk, validated against DEFAULTS."""
    global _config
    if CONFIG_PATH.exists():
        try:
            stored = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            _config = _coerce(DEFAULTS, _overlay(DEFAULTS, stored))
        except (json.JSONDecodeError, OSError):
            _config = copy.deepcopy(DEFAULTS)
    else:
        _config = copy.deepcopy(DEFAULTS)
    return _config


def save() -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(_config, indent=2), encoding="utf-8")


def update(patch: dict) -> dict:
    """Deep-merge a (possibly partial) patch, validate, persist, return config."""
    global _config
    _config = _coerce(DEFAULTS, _overlay(_config, patch or {}))
    save()
    return _config


def reset() -> dict:
    global _config
    _config = copy.deepcopy(DEFAULTS)
    save()
    return _config
