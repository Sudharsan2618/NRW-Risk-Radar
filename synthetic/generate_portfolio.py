"""Generate the deterministic, privacy-safe NRW demo portfolio."""
from __future__ import annotations
import json, math, random
from pathlib import Path

CENTRES = [
    ("Cologne", 50.9375, 6.9603, 3200), ("Düsseldorf", 51.2277, 6.7735, 2500), ("Aachen", 50.7753, 6.0839, 1800),
    ("Bonn", 50.7374, 7.0982, 1800), ("Düren", 50.8043, 6.4820, 1800), ("Essen", 51.4556, 7.0116, 1800),
    ("Dortmund", 51.5136, 7.4653, 1600), ("Wuppertal", 51.2562, 7.1508, 1500),
    ("Hürtgenwald", 50.6900, 6.3700, 6000), ("Eifel rural", 50.58, 6.48, 1800), ("Rheinland rural", 51.02, 6.42, 1500), ("Westfalen rural", 51.28, 7.72, 1700),
]
PROPERTY_TYPES = [("detached", .45), ("semi_detached", .20), ("row_house", .20), ("apartment", .15)]
CONSTRUCTION = [("masonry", .75), ("mixed", .15), ("timber", .10)]
POSTAL = {"Cologne":"50667", "Düsseldorf":"40213", "Aachen":"52062", "Bonn":"53111", "Düren":"52349", "Essen":"45127", "Dortmund":"44135", "Wuppertal":"42103", "Hürtgenwald":"52393", "Eifel rural":"53902", "Rheinland rural":"41539", "Westfalen rural":"58636"}

def weighted(rng, values):
    roll = rng.random(); total = 0
    for value, weight in values:
        total += weight
        if roll <= total: return value

def generate(count=25000, seed=20260818):
    rng = random.Random(seed); policies = []; centre_cycle = []
    for name, lat, lon, amount in CENTRES: centre_cycle.extend([(name, lat, lon)] * amount)
    while len(centre_cycle) < count: centre_cycle.append(rng.choice(CENTRES)[:3])
    rng.shuffle(centre_cycle)
    for index, (municipality, lat, lon) in enumerate(centre_cycle[:count], 1):
        # City clusters are tighter; rural clusters broader. A deliberate Hürtgenwald concentration supports the demo.
        spread = .018 if "rural" not in municipality and municipality != "Hürtgenwald" else .035
        latitude = lat + rng.gauss(0, spread); longitude = lon + rng.gauss(0, spread / max(.2, math.cos(math.radians(lat))))
        property_type = weighted(rng, PROPERTY_TYPES); construction = weighted(rng, CONSTRUCTION)
        base = {"detached": 430000, "semi_detached": 360000, "row_house": 315000, "apartment": 285000}[property_type]
        building = int(max(150000, min(2200000, base * 0.96 * rng.lognormvariate(0, .32))) / 1000) * 1000
        contents = int(building * rng.uniform(.16, .32) / 1000) * 1000
        policies.append({"policy_id": f"NRW-{index:05d}", "latitude": round(latitude, 6), "longitude": round(longitude, 6), "postal_code": POSTAL[municipality], "municipality": municipality, "building_tiv": building, "contents_tiv": contents, "total_tiv": building + contents, "property_type": property_type, "construction_type": construction, "year_built": rng.randint(1920, 2022), "deductible": 1000 if property_type != "apartment" else 2500, "policy_limit": building + contents, "risk_attributes": {"wildland_interface": construction == "timber" or municipality in ("Hürtgenwald", "Eifel rural"), "occupancy": "residential"}})
    return policies

if __name__ == "__main__":
    target = Path(__file__).resolve().parents[1] / "data" / "demo" / "portfolio.json"; target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(generate(), separators=(",", ":")), encoding="utf-8")
    print(f"wrote {target}")
