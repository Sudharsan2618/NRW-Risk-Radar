import unittest

from apps.api.adapters import fetch_and_normalize
from apps.api.discovery import cluster_firms, discover_live_events


class DiscoveryTests(unittest.TestCase):
    def test_firms_points_are_clustered_into_one_candidate(self):
        observations = [
            {"id": "a", "latitude": 50.0, "longitude": 6.0, "observed_at": "2026-08-19T10:00:00Z", "frp": 30, "confidence": 0.9},
            {"id": "b", "latitude": 50.01, "longitude": 6.01, "observed_at": "2026-08-19T10:05:00Z", "frp": 20, "confidence": 0.9},
            {"id": "c", "latitude": 51.0, "longitude": 7.0, "observed_at": "2026-08-19T10:00:00Z", "frp": 5, "confidence": 0.5},
        ]
        clusters = cluster_firms(observations, radius_km=5)
        self.assertEqual(sorted(map(len, clusters)), [1, 2])

    def test_warning_and_firms_are_combined_into_live_event(self):
        firms = {"observations": [{"id": "a", "latitude": 50.0, "longitude": 6.0, "frp": 40, "confidence": 0.9}, {"id": "b", "latitude": 50.01, "longitude": 6.01, "frp": 20, "confidence": 0.9}]}
        nina = {"warnings": [{"id": "nina-1", "level": "evacuation", "title": "Forest fire", "issued_at": "2026-08-19T10:00:00Z", "geometry": {"type": "Feature", "geometry": {"type": "Point", "coordinates": [6.0, 50.0]}}}]}
        records = discover_live_events(firms, nina, {"danger_level": 4, "score": 75}, {"features": []})
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["event"]["primary_source"], "NINA")
        self.assertEqual(len(records[0]["firms"]["observations"]), 2)
        self.assertEqual(records[0]["signals"]["warning_level"], "evacuation")

    def test_nationwide_nina_map_fetches_only_fire_warnings(self):
        dashboard_url = "https://warnung.bund.de/api31/mowas/mapData.json"
        detail_url = "https://warnung.bund.de/api31/warnings/mow.fire.json"
        geometry_url = "https://warnung.bund.de/api31/warnings/mow.fire.geojson"
        responses = {
            dashboard_url: [
                {"id": "mow.fire", "i18nTitle": {"de": "Waldbrand im Landkreis"}, "transKeys": {"event": "BBK-EVC-077"}},
                {"id": "mow.water", "i18nTitle": {"de": "Trinkwasserwarnung"}, "transKeys": {"event": "BBK-EVC-069"}},
            ],
            detail_url: {"identifier": "mow.fire", "sent": "2026-08-19T10:00:00Z", "info": [{"headline": "Waldbrand", "severity": "Severe"}]},
            geometry_url: {"type": "Feature", "geometry": {"type": "Point", "coordinates": [6.0, 50.0]}},
        }
        result = fetch_and_normalize("nina", dashboard_url, None, responses.__getitem__, max_nina_warnings=10)
        self.assertEqual([warning["id"] for warning in result["warnings"]], ["mow.fire"])


if __name__ == "__main__":
    unittest.main()
