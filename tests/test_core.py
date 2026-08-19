import unittest
from analytics.core import calculate_risk, exposure, loss_and_claims, point_in_polygon, risk_components, scenario_envelope

class CoreAnalyticsTests(unittest.TestCase):
    def test_risk_is_weighted_and_bounded(self):
        components = risk_components({"active_fire_detections": [{"id": 1}], "dwd_danger": 5, "warning_level": "evacuation", "effis_context": True, "wind_speed_kmh": 40})
        expected = round(sum(components[k] * {"active_fire": .25, "weather": .20, "wind": .15, "warning": .15, "vegetation": .10, "growth": .10, "corroboration": .05}[k] for k in components))
        self.assertEqual(calculate_risk(components), expected)
        self.assertGreaterEqual(calculate_risk({key: 999 for key in components}), 0)
        self.assertLessEqual(calculate_risk({key: 999 for key in components}), 100)

    def test_missing_sources_do_not_create_fire_score(self):
        components = risk_components({})
        self.assertEqual(components["active_fire"], 0)
        self.assertEqual(components["warning"], 0)
        self.assertEqual(calculate_risk(components), 9)

    def test_known_point_polygon_exposure_and_tiv(self):
        feature = {"geometry": {"coordinates": [[[6.35, 50.65], [6.40, 50.65], [6.40, 50.72], [6.35, 50.72], [6.35, 50.65]]]}}
        policies = [{"policy_id": "a", "latitude": 50.69, "longitude": 6.37, "building_tiv": 100, "contents_tiv": 20, "total_tiv": 120}, {"policy_id": "b", "latitude": 50.8, "longitude": 6.5, "building_tiv": 200, "contents_tiv": 30, "total_tiv": 230}]
        result = exposure(policies, (50.69, 6.37), .2, feature)
        self.assertEqual(result["scenario"]["policies"], 1)
        self.assertEqual(result["scenario"]["tiv"], 120)
        self.assertEqual(result["bands"]["inside"]["tiv"], 120)

    def test_scenario_area_grows_with_severity(self):
        centroid = (50.69, 6.37)
        current = scenario_envelope(centroid, 70, "current")["geometry"]["coordinates"][0]
        severe = scenario_envelope(centroid, 70, "severe")["geometry"]["coordinates"][0]
        def area(poly): return abs(sum(poly[i][0] * poly[(i+1)%len(poly)][1] - poly[(i+1)%len(poly)][0] * poly[i][1] for i in range(len(poly))) / 2)
        self.assertGreater(area(severe), area(current))
        self.assertTrue(point_in_polygon((50.69, 6.37), current))

    def test_loss_ratio_known_case(self):
        result = loss_and_claims({"scenario": {"tiv": 1_000_000, "policies": 1}, "bands": {"inside": {"tiv": 0, "policies": 0}}}, "current")
        self.assertEqual(result["loss_low"], 50_000)
        self.assertEqual(result["loss_high"], 250_000)

if __name__ == "__main__": unittest.main()
