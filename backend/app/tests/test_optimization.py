"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
Comprehensive Unit & Integration Test Suite for PuLP Optimization Engine

Executes the 10 required operational scenarios:
1. One incident and one available ALS ambulance
2. Multiple incidents competing for limited ambulances
3. Critical casualties requiring ALS
4. Insufficient ambulance capacity
5. Hospital capacity restrictions
6. Hospital with unknown mandatory capabilities
7. No eligible hospital
8. Unserved casualties
9. Comparison against nearest-suitable baseline
10. Infeasible optimisation scenario
"""

import unittest
from app.models.schemas import (
    IncidentInput,
    AmbulanceBaseInput,
    HospitalCandidateInput,
    AmbulanceTypeConfig,
    OptimizationParameters,
    OptimizationRequest
)
from app.optimization.solver import solve_emergency_dispatch_optimization
from app.services.data_loader import DEFAULT_AMBULANCE_TYPES


class TestPalsOptimizationEngine(unittest.TestCase):

    def setUp(self):
        self.ambulance_types = [
            AmbulanceTypeConfig(type="ALS", patient_capacity=2, speed_kmph=55.0, is_als_capable=True),
            AmbulanceTypeConfig(type="BLS", patient_capacity=2, speed_kmph=58.0, is_als_capable=False),
            AmbulanceTypeConfig(type="NLS", patient_capacity=1, speed_kmph=50.0, is_als_capable=False)
        ]
        self.default_params = OptimizationParameters(
            alpha=1.0,
            beta=1.0,
            M=10000.0,
            allow_unserved_penalty=True,
            enforce_strict_als_for_critical=True
        )

    # --------------------------------------------------------------------------
    # SCENARIO 1: One incident and one available ALS ambulance
    # --------------------------------------------------------------------------
    def test_01_one_incident_one_available_als(self):
        incident = IncidentInput(
            id="INC-01",
            name="Tambaram Single Collision",
            type="Highway Accident",
            severity="CRITICAL",
            severity_weight=2.0,
            total_casualties=2,
            critical_casualties=1,
            lat=12.9249,
            lng=80.1190
        )
        base = AmbulanceBaseInput(
            id="BASE-01",
            name="Tambaram Sub-Depot",
            lat=12.9210,
            lng=80.1115,
            available_units={"ALS": 1, "BLS": 0}
        )
        hospital = HospitalCandidateInput(
            id="HOSP-01",
            name="Kilpauk MCH",
            lat=13.0786,
            lng=80.2415,
            receiving_capacity=6,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base],
            hospitals=[hospital],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)

        self.assertEqual(resp.status, "SUCCESS")
        self.assertEqual(resp.solver_status, "Optimal")
        self.assertIsNotNone(resp.objective_value)
        self.assertEqual(len(resp.incident_resolutions), 1)

        res = resp.incident_resolutions[0]
        self.assertEqual(res.casualties_served, 2)
        self.assertEqual(res.unserved_casualties, 0)
        self.assertEqual(len(res.ambulances_dispatched), 1)
        self.assertEqual(res.ambulances_dispatched[0].ambulance_type, "ALS")
        self.assertEqual(res.ambulances_dispatched[0].quantity, 1)
        self.assertEqual(len(res.hospitals_allocated), 1)
        self.assertEqual(res.hospitals_allocated[0].patients_allocated, 2)

    # --------------------------------------------------------------------------
    # SCENARIO 2: Multiple incidents competing for limited ambulances
    # --------------------------------------------------------------------------
    def test_02_multiple_incidents_competing_for_ambulances(self):
        # Two simultaneous incidents competing for 2 ALS units
        inc1 = IncidentInput(
            id="INC-01-CRIT",
            name="Major Highway Pileup",
            type="Highway Accident",
            severity="CRITICAL",
            severity_weight=3.0,
            total_casualties=2,
            critical_casualties=2,
            lat=12.9249,
            lng=80.1190
        )
        inc2 = IncidentInput(
            id="INC-02-MED",
            name="Secondary Feeder Crash",
            type="Highway Accident",
            severity="MEDIUM",
            severity_weight=1.0,
            total_casualties=2,
            critical_casualties=0,
            lat=12.9500,
            lng=80.1300
        )
        # Only 1 ALS ambulance available at the depot
        base = AmbulanceBaseInput(
            id="BASE-01",
            name="Single Ambulance Depot",
            lat=12.9210,
            lng=80.1115,
            available_units={"ALS": 1, "BLS": 0}
        )
        hospital = HospitalCandidateInput(
            id="HOSP-01",
            name="Regional General Hospital",
            lat=13.0000,
            lng=80.2000,
            receiving_capacity=10,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        req = OptimizationRequest(
            incidents=[inc1, inc2],
            bases=[base],
            hospitals=[hospital],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)

        self.assertEqual(resp.status, "SUCCESS")
        self.assertEqual(resp.solver_status, "Optimal")

        # Total ALS dispatched across both incidents cannot exceed 1
        total_als_dispatched = sum(
            a.quantity for r in resp.incident_resolutions for a in r.ambulances_dispatched if a.ambulance_type == "ALS"
        )
        self.assertEqual(total_als_dispatched, 1)

        # High-severity critical incident receives the ALS unit
        res_crit = next(r for r in resp.incident_resolutions if r.incident_id == "INC-01-CRIT")
        self.assertEqual(res_crit.casualties_served, 2)
        self.assertEqual(res_crit.unserved_casualties, 0)

        # Lower-severity incident has unserved casualties due to fleet limits
        res_med = next(r for r in resp.incident_resolutions if r.incident_id == "INC-02-MED")
        self.assertEqual(res_med.casualties_served, 0)
        self.assertEqual(res_med.unserved_casualties, 2)

    # --------------------------------------------------------------------------
    # SCENARIO 3: Critical casualties requiring ALS
    # --------------------------------------------------------------------------
    def test_03_critical_casualties_requiring_als(self):
        incident = IncidentInput(
            id="INC-TRAUMA",
            name="Severe Rail Incident",
            type="Railway Accident",
            severity="CRITICAL",
            severity_weight=2.0,
            total_casualties=2,
            critical_casualties=2,
            lat=12.9715,
            lng=79.1385
        )
        # Closer base has BLS only; further base has ALS
        base_bls = AmbulanceBaseInput(
            id="BASE-BLS",
            name="Local Depot (BLS)",
            lat=12.9700,
            lng=79.1350,  # very close
            available_units={"ALS": 0, "BLS": 2}
        )
        base_als = AmbulanceBaseInput(
            id="BASE-ALS",
            name="Corridor Depot (ALS)",
            lat=12.9200,
            lng=79.1350,  # further
            available_units={"ALS": 1, "BLS": 0}
        )
        hospital = HospitalCandidateInput(
            id="HOSP-MCH",
            name="Vellore MCH",
            lat=12.9000,
            lng=79.1300,
            receiving_capacity=8,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base_bls, base_als],
            hospitals=[hospital],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)

        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]
        # Must dispatch ALS despite BLS being geographically closer
        dispatched_types = [a.ambulance_type for a in res.ambulances_dispatched]
        self.assertIn("ALS", dispatched_types)
        als_alloc = next(a for a in res.ambulances_dispatched if a.ambulance_type == "ALS")
        self.assertEqual(als_alloc.base_id, "BASE-ALS")
        self.assertEqual(als_alloc.quantity, 1)

    # --------------------------------------------------------------------------
    # SCENARIO 4: Insufficient ambulance capacity
    # --------------------------------------------------------------------------
    def test_04_insufficient_ambulance_capacity(self):
        incident = IncidentInput(
            id="INC-MASS",
            name="Mass Casualty Bus Overturn",
            type="Highway Accident",
            severity="HIGH",
            severity_weight=1.5,
            total_casualties=6,
            critical_casualties=0,
            lat=11.0285,
            lng=77.0120
        )
        # Only 1 BLS ambulance available (capacity 2)
        base = AmbulanceBaseInput(
            id="BASE-01",
            name="Coimbatore Post",
            lat=11.0180,
            lng=76.9620,
            available_units={"BLS": 1, "ALS": 0}
        )
        hospital = HospitalCandidateInput(
            id="HOSP-01",
            name="Coimbatore MCH",
            lat=11.0000,
            lng=77.0000,
            receiving_capacity=10,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base],
            hospitals=[hospital],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)

        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]
        # Exactly 2 casualties served by 1 ambulance (capacity 2)
        self.assertEqual(res.casualties_served, 2)
        # 4 casualties remain unserved
        self.assertEqual(res.unserved_casualties, 4)
        self.assertEqual(res.total_casualties, 6)

    # --------------------------------------------------------------------------
    # SCENARIO 5: Hospital capacity restrictions
    # --------------------------------------------------------------------------
    def test_05_hospital_capacity_restrictions(self):
        incident = IncidentInput(
            id="INC-05",
            name="Multiple Vehicle Pileup",
            type="Highway Accident",
            severity="HIGH",
            severity_weight=1.5,
            total_casualties=4,
            critical_casualties=0,
            lat=12.9249,
            lng=80.1190
        )
        base = AmbulanceBaseInput(
            id="BASE-01",
            name="Tambaram Depot",
            lat=12.9210,
            lng=80.1115,
            available_units={"BLS": 2, "ALS": 0}  # capacity 4
        )
        # Hospital A is close (2 km) but free capacity is only 2
        hosp_near = HospitalCandidateInput(
            id="HOSP-NEAR",
            name="Near Clinic (Limited Intake)",
            lat=12.9300,
            lng=80.1200,
            receiving_capacity=2,
            simulated_workload=0,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )
        # Hospital B is further (15 km) with capacity 6
        hosp_far = HospitalCandidateInput(
            id="HOSP-FAR",
            name="Further Medical Center",
            lat=13.0500,
            lng=80.2000,
            receiving_capacity=6,
            simulated_workload=0,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base],
            hospitals=[hosp_near, hosp_far],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)

        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]
        self.assertEqual(res.casualties_served, 4)

        # Verify allocation split across hospitals due to capacity cap
        alloc_near = next((h.patients_allocated for h in res.hospitals_allocated if h.hospital_id == "HOSP-NEAR"), 0)
        alloc_far = next((h.patients_allocated for h in res.hospitals_allocated if h.hospital_id == "HOSP-FAR"), 0)

        self.assertEqual(alloc_near, 2)  # Capped at near hospital's capacity
        self.assertEqual(alloc_far, 2)   # Overflow routed to further hospital

    # --------------------------------------------------------------------------
    # SCENARIO 6: Hospital with unknown mandatory capabilities
    # --------------------------------------------------------------------------
    def test_06_hospital_with_unknown_mandatory_capabilities(self):
        incident = IncidentInput(
            id="INC-06",
            name="Critical Corridor Collision",
            type="Highway Accident",
            severity="CRITICAL",
            severity_weight=2.0,
            total_casualties=2,
            critical_casualties=1,
            lat=12.9249,
            lng=80.1190
        )
        base = AmbulanceBaseInput(
            id="BASE-01",
            name="Tambaram Depot",
            lat=12.9210,
            lng=80.1115,
            available_units={"ALS": 1}
        )
        # Closer hospital has UNKNOWN capabilities
        hosp_unknown = HospitalCandidateInput(
            id="HOSP-UNKNOWN",
            name="Unverified Nearby Clinic",
            lat=12.9250,
            lng=80.1195,  # 0.1 km away
            receiving_capacity=10,
            capabilities={
                "emergencyDepartment": "UNKNOWN",
                "traumaCare": "UNKNOWN",
                "icu": "UNKNOWN"
            }
        )
        # Further hospital has verified Level I Trauma and ICU
        hosp_verified = HospitalCandidateInput(
            id="HOSP-VERIFIED",
            name="Govt Kilpauk MCH",
            lat=13.0786,
            lng=80.2415,  # 25 km away
            receiving_capacity=10,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base],
            hospitals=[hosp_unknown, hosp_verified],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)

        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]

        # Zero patients allocated to unverified hospital
        alloc_unknown = next((h.patients_allocated for h in res.hospitals_allocated if h.hospital_id == "HOSP-UNKNOWN"), 0)
        alloc_verified = next((h.patients_allocated for h in res.hospitals_allocated if h.hospital_id == "HOSP-VERIFIED"), 0)

        self.assertEqual(alloc_unknown, 0)
        self.assertEqual(alloc_verified, 2)

    # --------------------------------------------------------------------------
    # SCENARIO 7: No eligible hospital
    # --------------------------------------------------------------------------
    def test_07_no_eligible_hospital(self):
        incident = IncidentInput(
            id="INC-07",
            name="Highway Trauma Incident",
            type="Highway Accident",
            severity="CRITICAL",
            severity_weight=2.0,
            total_casualties=2,
            critical_casualties=1,
            lat=12.9249,
            lng=80.1190
        )
        base = AmbulanceBaseInput(
            id="BASE-01",
            name="Tambaram Depot",
            lat=12.9210,
            lng=80.1115,
            available_units={"ALS": 1}
        )
        # Only hospital explicitly fails emergencyDepartment, traumaCare and ICU
        hosp_ineligible = HospitalCandidateInput(
            id="HOSP-FAIL",
            name="Tambaram Primary Dispensary",
            lat=12.9240,
            lng=80.1180,
            receiving_capacity=10,
            capabilities={
                "emergencyDepartment": False,  # FAIL
                "traumaCare": False,          # FAIL
                "icu": False                  # FAIL
            }
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base],
            hospitals=[hosp_ineligible],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)

        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]
        # Ineligible hospital receives 0 patients
        self.assertEqual(len(res.hospitals_allocated), 0)
        # All casualties remain unserved
        self.assertEqual(res.casualties_served, 0)
        self.assertEqual(res.unserved_casualties, 2)
        self.assertEqual(res.critical_unserved, 1)
        self.assertEqual(res.noncritical_unserved, 1)
        self.assertTrue(resp.independent_verification.is_valid)

    # --------------------------------------------------------------------------
    # SCENARIO 8: Unserved casualties
    # --------------------------------------------------------------------------
    def test_08_unserved_casualties(self):
        incident = IncidentInput(
            id="INC-08",
            name="Festival Stampede Surge",
            type="Stampede",
            severity="CRITICAL",
            severity_weight=2.0,
            total_casualties=10,
            critical_casualties=4,
            lat=12.2280,
            lng=79.0550
        )
        # Only 1 ALS ambulance (capacity 2)
        base = AmbulanceBaseInput(
            id="BASE-01",
            name="Tiruvannamalai Base",
            lat=12.2290,
            lng=79.0680,
            available_units={"ALS": 1}
        )
        hospital = HospitalCandidateInput(
            id="HOSP-01",
            name="Tiruvannamalai MCH",
            lat=12.2300,
            lng=79.0600,
            receiving_capacity=10,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base],
            hospitals=[hospital],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)

        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]
        self.assertEqual(res.casualties_served, 2)
        self.assertEqual(res.unserved_casualties, 8)
        self.assertEqual(resp.unserved_casualties_summary.get("INC-08")["total"], 8)
        self.assertEqual(resp.unserved_casualties_summary.get("INC-08")["critical"], 2)
        self.assertEqual(resp.unserved_casualties_summary.get("INC-08")["noncritical"], 6)
        # Objective value must reflect unserved penalty M_crit * 2 + M_noncrit * 6
        self.assertGreater(resp.objective_value, 150000.0)
        self.assertTrue(resp.independent_verification.is_valid)

    # --------------------------------------------------------------------------
    # SCENARIO 9: Comparison against nearest-suitable baseline
    # --------------------------------------------------------------------------
    def test_09_comparison_against_nearest_suitable_baseline(self):
        inc1 = IncidentInput(
            id="INC-A",
            name="Corridor Emergency Alpha",
            type="Highway Accident",
            severity="CRITICAL",
            severity_weight=2.5,
            total_casualties=2,
            critical_casualties=2,
            lat=12.9249,
            lng=80.1190
        )
        inc2 = IncidentInput(
            id="INC-B",
            name="Corridor Emergency Beta",
            type="Highway Accident",
            severity="HIGH",
            severity_weight=1.5,
            total_casualties=2,
            critical_casualties=1,
            lat=13.0080,
            lng=80.2030
        )
        base1 = AmbulanceBaseInput(
            id="BASE-1",
            name="Tambaram Depot",
            lat=12.9210,
            lng=80.1115,
            available_units={"ALS": 1, "BLS": 1}
        )
        base2 = AmbulanceBaseInput(
            id="BASE-2",
            name="Guindy Depot",
            lat=13.0080,
            lng=80.2030,
            available_units={"ALS": 1, "BLS": 1}
        )
        hosp = HospitalCandidateInput(
            id="HOSP-MCH",
            name="Central MCH",
            lat=13.0786,
            lng=80.2415,
            receiving_capacity=8,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        req = OptimizationRequest(
            incidents=[inc1, inc2],
            bases=[base1, base2],
            hospitals=[hosp],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)

        self.assertEqual(resp.status, "SUCCESS")
        self.assertIsNotNone(resp.baseline_comparison)
        cmp = resp.baseline_comparison
        self.assertEqual(cmp.pulp_metrics.total_casualties_served, 4)
        self.assertEqual(cmp.baseline_metrics.total_casualties_served, 4)
        self.assertIsNotNone(cmp.summary_verdict)

    # --------------------------------------------------------------------------
    # SCENARIO 10: Infeasible optimisation scenario
    # --------------------------------------------------------------------------
    def test_10_infeasible_optimisation_scenario(self):
        incident = IncidentInput(
            id="INC-10",
            name="Mass Derailment with Strict Zero-Unserved",
            type="Railway Accident",
            severity="CRITICAL",
            severity_weight=2.0,
            total_casualties=10,
            critical_casualties=4,
            lat=12.9715,
            lng=79.1385
        )
        # Available capacity: 1 ambulance (capacity 2)
        base = AmbulanceBaseInput(
            id="BASE-01",
            name="Vellore Depot",
            lat=12.9200,
            lng=79.1350,
            available_units={"ALS": 1}
        )
        hospital = HospitalCandidateInput(
            id="HOSP-01",
            name="Vellore MCH",
            lat=12.9000,
            lng=79.1300,
            receiving_capacity=10,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )
        # Disallow unserved casualties (forcing u[k] == 0)
        # Mathematical contradiction: 10 casualties must be served, but fleet capacity is 2
        strict_params = OptimizationParameters(
            alpha=1.0,
            beta=1.0,
            M=10000.0,
            allow_unserved_penalty=False,  # forces u[k] == 0
            enforce_strict_als_for_critical=True
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base],
            hospitals=[hospital],
            ambulance_types=self.ambulance_types,
            parameters=strict_params
        )

        resp = solve_emergency_dispatch_optimization(req)

        # Model must detect Infeasible status gracefully without fabricating false allocations
        self.assertEqual(resp.status, "INFEASIBLE")
        self.assertEqual(resp.solver_status, "Infeasible")
        self.assertIn("Infeasible", resp.error_message)
        self.assertEqual(len(resp.incident_resolutions), 0)
        self.assertEqual(len(resp.raw_ambulance_allocations), 0)

    # --------------------------------------------------------------------------
    # SCENARIO 11 (Regression): Critical casualties cannot be covered by unserved non-critical casualties
    # --------------------------------------------------------------------------
    def test_11_critical_casualties_cannot_be_covered_by_unserved_noncritical(self):
        """
        Verify that having unserved non-critical casualties (u_noncrit) does NOT reduce
        or satisfy the strict ALS cot requirement for critical casualties.
        Incident has 3 critical casualties and 2 non-critical casualties (5 total).
        Only 1 ALS ambulance (capacity 2) is available.
        Even if both non-critical patients are unserved, at most 2 critical casualties can be served.
        At least 1 critical casualty MUST be unserved (u_crit >= 1).
        """
        incident = IncidentInput(
            id="INC-REG-11",
            name="Highway High-Acuity Collision",
            type="Highway Accident",
            severity="CRITICAL",
            severity_weight=2.0,
            total_casualties=5,
            critical_casualties=3,
            lat=11.6643,
            lng=78.1460
        )
        base = AmbulanceBaseInput(
            id="BASE-REG-11",
            name="Salem North Base",
            lat=11.6600,
            lng=78.1400,
            available_units={"ALS": 1, "BLS": 0, "NLS": 0}  # Only 1 ALS = 2 cot capacity
        )
        hospital = HospitalCandidateInput(
            id="HOSP-REG-11",
            name="Salem GMCH",
            lat=11.6700,
            lng=78.1500,
            receiving_capacity=10,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base],
            hospitals=[hospital],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)
        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]

        # Critical served cannot exceed ALS capacity (2)
        self.assertEqual(res.critical_served, 2)
        # Exactly 1 critical casualty MUST be recorded as unserved
        self.assertEqual(res.critical_unserved, 1)
        # All 2 non-critical casualties must also be unserved because no further transport capacity exists
        self.assertEqual(res.noncritical_unserved, 2)
        self.assertEqual(res.unserved_casualties, 3)
        self.assertTrue(resp.independent_verification.is_valid)

    # --------------------------------------------------------------------------
    # SCENARIO 12 (Regression): Non-critical patients do not consume ALS-only capacity unnecessarily
    # --------------------------------------------------------------------------
    def test_12_noncritical_patients_do_not_consume_als_unnecessarily(self):
        """
        Verify that when both ALS and BLS units are available, ALS capacity is strictly
        dedicated to critical patients, while BLS units handle non-critical patients.
        Incident has 2 critical and 2 non-critical casualties.
        Base 1 has 1 ALS (capacity 2). Base 2 has 1 BLS (capacity 2).
        Optimal solution must allocate ALS to critical and BLS to non-critical.
        """
        incident = IncidentInput(
            id="INC-REG-12",
            name="Coimbatore Ring Road Accident",
            type="Highway Accident",
            severity="CRITICAL",
            severity_weight=2.0,
            total_casualties=4,
            critical_casualties=2,
            lat=11.0168,
            lng=76.9558
        )
        base_als = AmbulanceBaseInput(
            id="BASE-ALS",
            name="Coimbatore Central ALS Depot",
            lat=11.0100,
            lng=76.9500,
            available_units={"ALS": 1, "BLS": 0, "NLS": 0}
        )
        base_bls = AmbulanceBaseInput(
            id="BASE-BLS",
            name="Coimbatore East BLS Depot",
            lat=11.0200,
            lng=76.9600,
            available_units={"ALS": 0, "BLS": 1, "NLS": 0}
        )
        hospital = HospitalCandidateInput(
            id="HOSP-CMCH",
            name="Coimbatore MCH",
            lat=11.0000,
            lng=76.9700,
            receiving_capacity=10,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base_als, base_bls],
            hospitals=[hospital],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)
        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]

        self.assertEqual(res.critical_served, 2)
        self.assertEqual(res.noncritical_served, 2)
        self.assertEqual(res.unserved_casualties, 0)

        # Check vehicle dispatches
        als_dispatched = sum(a.quantity for a in res.ambulances_dispatched if a.ambulance_type == "ALS")
        bls_dispatched = sum(a.quantity for a in res.ambulances_dispatched if a.ambulance_type == "BLS")
        self.assertEqual(als_dispatched, 1)
        self.assertEqual(bls_dispatched, 1)
        self.assertTrue(resp.independent_verification.is_valid)

    # --------------------------------------------------------------------------
    # SCENARIO 13 (Regression): Insufficient ALS capacity correctly records critical patients unserved
    # --------------------------------------------------------------------------
    def test_13_insufficient_als_capacity_records_critical_unserved(self):
        """
        Verify that BLS units CANNOT be substituted for critical patients under Constraint E.
        Incident has 4 critical casualties and 0 non-critical casualties.
        Only 1 ALS unit is available (capacity 2), plus 5 BLS units (capacity 10).
        Even with surplus BLS units, at most 2 critical casualties can be evacuated.
        Exactly 2 critical casualties must be recorded as unserved (u_crit == 2).
        """
        incident = IncidentInput(
            id="INC-REG-13",
            name="Tiruchirappalli Bus Inversion",
            type="Highway Accident",
            severity="CRITICAL",
            severity_weight=2.0,
            total_casualties=4,
            critical_casualties=4,
            lat=10.7905,
            lng=78.7047
        )
        base = AmbulanceBaseInput(
            id="BASE-TRI",
            name="Trichy Mega Depot",
            lat=10.7950,
            lng=78.7000,
            available_units={"ALS": 1, "BLS": 5, "NLS": 0}
        )
        hospital = HospitalCandidateInput(
            id="HOSP-TMCH",
            name="Tiruchirappalli MCH",
            lat=10.8000,
            lng=78.6900,
            receiving_capacity=10,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base],
            hospitals=[hospital],
            ambulance_types=self.ambulance_types,
            parameters=self.default_params
        )

        resp = solve_emergency_dispatch_optimization(req)
        self.assertEqual(resp.status, "SUCCESS")
        res = resp.incident_resolutions[0]

        # Only 2 critical casualties served by the single ALS
        self.assertEqual(res.critical_served, 2)
        # Exactly 2 critical casualties remain unserved despite 5 available BLS
        self.assertEqual(res.critical_unserved, 2)
        self.assertEqual(res.unserved_casualties, 2)
        self.assertTrue(resp.independent_verification.is_valid)

    # --------------------------------------------------------------------------
    # SCENARIO 14 (Regression): Lexicographic objective prioritises fewer unserved casualties
    # --------------------------------------------------------------------------
    def test_14_lexicographic_prioritises_fewer_unserved(self):
        """
        Verify that lexicographic objective mode:
        Phase 1: strictly minimises unserved casualties (weighting critical casualties 1000x over non-critical).
        Phase 2: minimises weighted travel time given the minimum unserved casualty bound.
        """
        incident = IncidentInput(
            id="INC-REG-14",
            name="Madurai Train Collision",
            type="Railway Accident",
            severity="CRITICAL",
            severity_weight=2.5,
            total_casualties=6,
            critical_casualties=2,
            lat=9.9252,
            lng=78.1198
        )
        base = AmbulanceBaseInput(
            id="BASE-MDU",
            name="Madurai Depot",
            lat=9.9200,
            lng=78.1100,
            available_units={"ALS": 1, "BLS": 2, "NLS": 0}  # Total cot capacity = 2 + 4 = 6
        )
        hospital = HospitalCandidateInput(
            id="HOSP-GRH",
            name="Madurai GRH",
            lat=9.9300,
            lng=78.1300,
            receiving_capacity=8,
            capabilities={
                "emergencyDepartment": True,
                "traumaCare": True,
                "emergencyEquipment": True,
                "icu": True,
                "specialistCare": True
            }
        )

        lex_params = OptimizationParameters(
            alpha=1.0,
            beta=1.0,
            M=10000.0,
            objective_mode="lexicographic",
            allow_unserved_penalty=True,
            enforce_strict_als_for_critical=True
        )

        req = OptimizationRequest(
            incidents=[incident],
            bases=[base],
            hospitals=[hospital],
            ambulance_types=self.ambulance_types,
            parameters=lex_params
        )

        resp = solve_emergency_dispatch_optimization(req)
        self.assertEqual(resp.status, "SUCCESS")
        self.assertEqual(resp.objective_mode, "lexicographic")
        res = resp.incident_resolutions[0]

        # 100% of casualties served (2 critical via ALS, 4 noncritical via BLS)
        self.assertEqual(res.casualties_served, 6)
        self.assertEqual(res.critical_served, 2)
        self.assertEqual(res.noncritical_served, 4)
        self.assertEqual(res.unserved_casualties, 0)
        self.assertTrue(resp.independent_verification.is_valid)


if __name__ == "__main__":
    unittest.main()


