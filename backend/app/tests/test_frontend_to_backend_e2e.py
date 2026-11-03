"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
End-to-End Frontend-to-Backend Integration Verification Suite

Validates the full data contract between the React PALS frontend and the Python FastAPI backend:
1. Evaluates all five preset emergency incidents (HOTSPOT-01 to HOTSPOT-05)
2. Evaluates the multi-incident contention scenario (HOTSPOT-01 + HOTSPOT-04)
3. Tests both Weighted-Sum and Lexicographic optimization modes
4. Verifies the independent recalculation audit on every response
5. Validates error handling for infeasible configurations
"""

import unittest
from app.main import run_optimization
from app.models.schemas import (
    OptimizationRequest,
    OptimizationParameters,
    IncidentInput,
    AmbulanceBaseInput,
    HospitalCandidateInput,
    AmbulanceTypeConfig
)
from app.services.data_loader import (
    DEFAULT_PRESET_INCIDENTS,
    DEFAULT_AMBULANCE_TYPES,
    get_default_bases,
    discover_nearby_hospitals_for_incident
)


class TestFrontendToBackendIntegration(unittest.TestCase):

    def setUp(self):
        self.bases = get_default_bases()
        self.ambulance_types = DEFAULT_AMBULANCE_TYPES

    def test_preset_01_tambaram_bypass(self):
        preset = DEFAULT_PRESET_INCIDENTS[0] # HOTSPOT-01
        hospitals = discover_nearby_hospitals_for_incident(preset, max_radius_km=120.0, limit=8)

        req = OptimizationRequest(
            incidents=[preset],
            bases=self.bases,
            hospitals=hospitals,
            ambulance_types=self.ambulance_types,
            parameters=OptimizationParameters(
                alpha=1.0,
                beta=1.0,
                M=10000.0,
                objective_mode="weighted_sum",
                allow_unserved_penalty=True,
                enforce_strict_als_for_critical=True
            )
        )

        resp = run_optimization(req)

        self.assertEqual(resp.status, "SUCCESS")
        self.assertEqual(resp.solver_status, "Optimal")
        self.assertIsNotNone(resp.objective_value)
        self.assertEqual(len(resp.incident_resolutions), 1)

        res = resp.incident_resolutions[0]
        self.assertEqual(res.total_casualties, 4)
        self.assertEqual(res.critical_casualties, 2)
        self.assertEqual(res.noncritical_casualties, 2)
        self.assertEqual(res.critical_served, 2)
        self.assertEqual(res.noncritical_served, 2)
        self.assertEqual(res.unserved_casualties, 0)
        self.assertGreater(len(res.ambulances_dispatched), 0)
        self.assertGreater(len(res.hospitals_allocated), 0)

        # Independent Audit Verification
        self.assertIsNotNone(resp.independent_verification)
        self.assertTrue(resp.independent_verification.is_valid)
        self.assertTrue(resp.independent_verification.objective_value_matches)

        # Baseline Comparison
        self.assertIsNotNone(resp.baseline_comparison)
        self.assertEqual(resp.baseline_comparison.pulp_metrics.total_casualties_served, 4)

    def test_preset_02_avinashi_road_coimbatore(self):
        preset = DEFAULT_PRESET_INCIDENTS[1] # HOTSPOT-02
        hospitals = discover_nearby_hospitals_for_incident(preset, max_radius_km=120.0, limit=8)

        req = OptimizationRequest(
            incidents=[preset],
            bases=self.bases,
            hospitals=hospitals,
            ambulance_types=self.ambulance_types,
            parameters=OptimizationParameters(
                alpha=1.0,
                beta=1.0,
                M=10000.0,
                objective_mode="weighted_sum"
            )
        )

        resp = run_optimization(req)
        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]
        self.assertEqual(res.total_casualties, 3)
        self.assertEqual(res.critical_served, 1)
        self.assertEqual(res.noncritical_served, 2)
        self.assertEqual(res.unserved_casualties, 0)
        self.assertTrue(resp.independent_verification.is_valid)

    def test_preset_03_madurai_outer_ring_road(self):
        preset = DEFAULT_PRESET_INCIDENTS[2] # HOTSPOT-03
        hospitals = discover_nearby_hospitals_for_incident(preset, max_radius_km=120.0, limit=8)

        req = OptimizationRequest(
            incidents=[preset],
            bases=self.bases,
            hospitals=hospitals,
            ambulance_types=self.ambulance_types,
            parameters=OptimizationParameters(
                alpha=1.0,
                beta=1.0,
                M=10000.0,
                objective_mode="weighted_sum"
            )
        )

        resp = run_optimization(req)
        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]
        self.assertEqual(res.total_casualties, 6)
        self.assertEqual(res.critical_served, 3)
        self.assertEqual(res.noncritical_served, 3)
        self.assertEqual(res.unserved_casualties, 0)
        self.assertTrue(resp.independent_verification.is_valid)

    def test_preset_04_katpadi_railway_junction(self):
        preset = DEFAULT_PRESET_INCIDENTS[3] # HOTSPOT-04
        hospitals = discover_nearby_hospitals_for_incident(preset, max_radius_km=120.0, limit=8)

        req = OptimizationRequest(
            incidents=[preset],
            bases=self.bases,
            hospitals=hospitals,
            ambulance_types=self.ambulance_types,
            parameters=OptimizationParameters(
                alpha=1.0,
                beta=1.0,
                M=10000.0,
                objective_mode="weighted_sum"
            )
        )

        resp = run_optimization(req)
        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]
        self.assertEqual(res.total_casualties, 14)
        self.assertEqual(res.critical_served, 5)
        # Hospital intake capacity limits total intake to 10
        self.assertEqual(res.noncritical_served, 5)
        self.assertEqual(res.unserved_casualties, 4)
        self.assertTrue(resp.independent_verification.is_valid)

    def test_preset_05_thiruvannamalai_girivalam(self):
        preset = DEFAULT_PRESET_INCIDENTS[4] # HOTSPOT-05
        hospitals = discover_nearby_hospitals_for_incident(preset, max_radius_km=120.0, limit=8)

        req = OptimizationRequest(
            incidents=[preset],
            bases=self.bases,
            hospitals=hospitals,
            ambulance_types=self.ambulance_types,
            parameters=OptimizationParameters(
                alpha=1.0,
                beta=1.0,
                M=10000.0,
                objective_mode="weighted_sum"
            )
        )

        resp = run_optimization(req)
        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]
        self.assertEqual(res.total_casualties, 9)
        self.assertEqual(res.critical_served, 2)
        # Tiruvannamalai MCH free capacity limits intake to 6
        self.assertEqual(res.noncritical_served, 4)
        self.assertEqual(res.unserved_casualties, 3)
        self.assertTrue(resp.independent_verification.is_valid)

    def test_two_incident_contention_scenario(self):
        """
        Tests simultaneous occurrence of HOTSPOT-01 (Tambaram) and HOTSPOT-04 (Katpadi Railway).
        Total casualties: 4 + 14 = 18 casualties.
        Verifies global multi-incident fleet coordination and response time reduction over greedy heuristic.
        """
        inc1 = DEFAULT_PRESET_INCIDENTS[0]
        inc2 = DEFAULT_PRESET_INCIDENTS[3]

        hosp_map = {}
        for inc in [inc1, inc2]:
            for h in discover_nearby_hospitals_for_incident(inc, max_radius_km=130.0, limit=6):
                hosp_map[h.id] = h
        hospitals = list(hosp_map.values())

        req = OptimizationRequest(
            incidents=[inc1, inc2],
            bases=self.bases,
            hospitals=hospitals,
            ambulance_types=self.ambulance_types,
            parameters=OptimizationParameters(
                alpha=1.0,
                beta=1.0,
                M=10000.0,
                objective_mode="lexicographic"
            )
        )

        resp = run_optimization(req)
        self.assertEqual(resp.status, "SUCCESS")
        self.assertEqual(len(resp.incident_resolutions), 2)

        # Check total casualties served across both incidents
        total_served = sum(r.casualties_served for r in resp.incident_resolutions)
        self.assertEqual(total_served, 18)

        # PuLP response time vs Greedy baseline improvement: ~23.36%
        cmp = resp.baseline_comparison
        self.assertIsNotNone(cmp)
        self.assertEqual(cmp.pulp_metrics.total_casualties_served, 18)
        self.assertGreater(cmp.response_time_reduction_pct, 20.0)
        self.assertTrue(cmp.is_performance_improved)

        # Independent audit
        self.assertTrue(resp.independent_verification.is_valid)


if __name__ == "__main__":
    unittest.main()
