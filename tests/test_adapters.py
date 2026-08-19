import json
import unittest
from pathlib import Path

from apps.api.adapters import (
    AdapterError,
    fetch_and_normalize,
    normalize_dwd,
    normalize_effis,
    normalize_firms,
    normalize_nina,
)

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "data" / "fixtures"


class SourceAdapterTests(unittest.TestCase):
    def test_firms_official_csv_is_normalized(self):
        payload = """latitude,longitude,acq_date,acq_time,satellite,confidence,frp\n50.7,6.38,2026-08-19,0915,VIIRS_NOAA20,87,42.5\n"""
        result = normalize_firms(payload)
        self.assertEqual(result["source"], "NASA FIRMS")
        self.assertEqual(result["observations"][0]["observed_at"], "2026-08-19T09:15:00Z")
        self.assertEqual(result["observations"][0]["confidence"], 0.87)
        self.assertEqual(result["observations"][0]["frp"], 42.5)

    def test_dwd_feature_server_chooses_nearest_station(self):
        event = {"centroid": {"latitude": 50.69, "longitude": 6.37}}
        payload = {
            "features": [
                {"attributes": {"geoBreite": 51.1, "geoLaenge": 7.1, "wbi_tag": 2}},
                {"attributes": {"geoBreite": 50.69, "geoLaenge": 6.37, "wbi_tag": 5}},
            ]
        }
        result = normalize_dwd(payload, event)
        self.assertEqual(result["danger_level"], 5)
        self.assertEqual(result["score"], 100)

    def test_nina_dashboard_fetches_detail_and_geometry(self):
        dashboard_url = "https://warnung.bund.de/api31/dashboard/053580000000.json"
        detail_url = "https://warnung.bund.de/api31/warnings/mow.test.json"
        geometry_url = "https://warnung.bund.de/api31/warnings/mow.test.geojson"
        responses = {
            dashboard_url: [{"id": "mow.test", "payload": {"id": "mow.test"}}],
            detail_url: {
                "identifier": "mow.test",
                "sent": "2026-08-19T10:00:00Z",
                "info": [{
                    "headline": "Waldbrandwarnung",
                    "severity": "Severe",
                    "description": "Avoid the forest area.",
                    "area": [{"areaDesc": "Kreis Düren"}],
                }],
            },
            geometry_url: {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": []}},
        }
        result = fetch_and_normalize("nina", dashboard_url, None, responses.__getitem__)
        self.assertEqual(result["warnings"][0]["level"], "evacuation")
        self.assertEqual(result["warnings"][0]["area"], "Kreis Düren")
        self.assertEqual(result["warnings"][0]["geometry"]["type"], "Feature")

    def test_fixture_shapes_remain_normalizable(self):
        firms = json.loads((FIXTURES / "firms_sample.json").read_text())
        dwd = json.loads((FIXTURES / "dwd_sample.json").read_text())
        nina = json.loads((FIXTURES / "nina_sample.json").read_text())
        effis = json.loads((FIXTURES / "effis_sample.geojson").read_text())
        self.assertEqual(len(normalize_firms(firms)["observations"]), 6)
        self.assertEqual(normalize_dwd(dwd)["danger_level"], 5)
        self.assertEqual(normalize_nina(nina)["warnings"][0]["level"], "evacuation")
        self.assertEqual(len(normalize_effis(effis)["features"]), 1)

    def test_invalid_payload_is_rejected(self):
        with self.assertRaises(AdapterError):
            normalize_dwd({"status": "ok"})
        with self.assertRaises(AdapterError):
            normalize_effis({"status": "ok"})


if __name__ == "__main__":
    unittest.main()
