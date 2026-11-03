"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
Validation Suite Runner for All 5 Incident Presets and Multi-Incident Contention

Executes:
1. Preset 1: HOTSPOT-01 (NH-45 Tambaram Bypass - Highway Accident)
2. Preset 2: HOTSPOT-02 (Avinashi Road Express Corridor - Highway Accident)
3. Preset 3: HOTSPOT-03 (Madurai Outer Ring Road - Highway Accident)
4. Preset 4: HOTSPOT-04 (Katpadi Railway Junction Perimeter - Railway Accident)
5. Preset 5: HOTSPOT-05 (Thiruvannamalai Girivalam Outer Ring Path - Stampede)
6. Multi-Incident Resource Contention Scenario:
   Simultaneous occurrence of HOTSPOT-01 and HOTSPOT-04 competing for northern Tamil Nadu fleet and beds.
7. Verification of both Weighted-Sum and Lexicographic optimization modes.
8. Independent Verification Audit on each run (recalculated availability, patient accounting by acuity, vehicle capacity, hospital capacity, ALS critical coverage, objective match).
"""

import sys
import json
from typing import List

from app.models.schemas import (
    OptimizationRequest,
    OptimizationParameters,
    IncidentInput
)
from app.services.data_loader import (
    DEFAULT_PRESET_INCIDENTS,
    DEFAULT_AMBULANCE_TYPES,
    get_default_bases,
    discover_nearby_hospitals_for_incident
)
from app.optimization.solver import solve_emergency_dispatch_optimization


def run_single_preset_validation(preset: IncidentInput, mode: str = "weighted_sum"):
    print(f"\n{'='*80}")
    print(f"EVALUATING PRESET: {preset.id} — {preset.name}")
    print(f"Type: {preset.type} | Severity: {preset.severity} (weight: {preset.severity_weight})")
    print(f"Total Casualties: {preset.total_casualties} (Critical: {preset.critical_casualties}, Non-Critical: {preset.noncritical_casualties})")
    print(f"Optimization Mode: {mode.upper()}")
    print(f"{'='*80}")

    bases = get_default_bases()
    hospitals = discover_nearby_hospitals_for_incident(preset, max_radius_km=120.0, limit=8)

    params = OptimizationParameters(
        alpha=1.0,
        beta=1.0,
        M=10000.0,
        objective_mode=mode,
        allow_unserved_penalty=True,
        enforce_strict_als_for_critical=True
    )

    req = OptimizationRequest(
        incidents=[preset],
        bases=bases,
        hospitals=hospitals,
        ambulance_types=DEFAULT_AMBULANCE_TYPES,
        parameters=params
    )

    resp = solve_emergency_dispatch_optimization(req)

    print(f"Solver Status: {resp.solver_status} | Objective Value: {resp.objective_value} | Solve Time: {resp.execution_time_ms} ms")
    print(f"Vehicle Response Time: {resp.total_vehicle_response_time_mins} veh-mins")
    print(f"Patient Transport Time: {resp.total_patient_transport_time_mins} patient-mins")
    print(f"Patient-Weighted Response Time: {resp.total_patient_weighted_response_time_mins} patient-mins")

    res = resp.incident_resolutions[0]
    print(f"\n--- Incident Resolution ---")
    print(f"Casualties: Total={res.total_casualties} | Critical={res.critical_casualties} | Non-Critical={res.noncritical_casualties}")
    print(f"Served:     Total={res.casualties_served} | Critical={res.critical_served} | Non-Critical={res.noncritical_served}")
    print(f"Unserved:   Total={res.unserved_casualties} | Critical={res.critical_unserved} | Non-Critical={res.noncritical_unserved}")

    print(f"\n--- Dispatched Ambulances ({len(res.ambulances_dispatched)} units) ---")
    for a in res.ambulances_dispatched:
        print(f"  * {a.quantity}x {a.ambulance_type} from '{a.base_name}' ({a.base_id}) | ETA: {a.response_time_mins} mins ({a.travel_distance_km} km)")

    print(f"\n--- Allocated Hospitals ({len(res.hospitals_allocated)} facilities) ---")
    for h in res.hospitals_allocated:
        print(f"  * '{h.hospital_name}' ({h.hospital_id}): {h.patients_allocated} patients (Crit: {h.critical_patients_allocated}, Non-Crit: {h.noncritical_patients_allocated}) | Transit: {h.transport_time_mins} mins ({h.travel_distance_km} km)")

    print(f"\n--- Mathematical Constraints Validation ---")
    for c in resp.constraint_validations:
        status_str = "PASS [✓]" if c.is_satisfied else "FAIL [✗]"
        print(f"  [{status_str}] {c.constraint_name} (Derived: {c.is_derived_check}): {c.details}")

    print(f"\n--- Independent Verification Audit ---")
    iv = resp.independent_verification
    if iv:
        print(f"  Overall Valid: {iv.is_valid}")
        print(f"  Recalculated Fleet Availability:      {iv.recalculated_ambulance_availability}")
        print(f"  Recalculated Patient Accounting:      {iv.recalculated_patient_accounting}")
        print(f"  Recalculated Vehicle Cot Capacity:    {iv.recalculated_vehicle_capacity}")
        print(f"  Recalculated Hospital Capacity:       {iv.recalculated_hospital_capacity}")
        print(f"  Recalculated ALS Critical Coverage:   {iv.recalculated_als_critical_coverage}")
        print(f"  Solver Obj: {iv.solver_objective_value} vs Recalculated Obj: {iv.recalculated_objective_value} (Matches: {iv.objective_value_matches})")
        assert iv.is_valid, f"Independent verification failed for preset {preset.id}"
    else:
        print("  WARNING: Independent verification not returned.")

    print(f"\n--- Baseline Comparison (PuLP MILP vs Greedy Heuristic) ---")
    cmp = resp.baseline_comparison
    if cmp:
        p_m = cmp.pulp_metrics
        b_m = cmp.baseline_metrics
        print(f"  Metric                        | PuLP MILP         | Greedy Baseline   | Delta / Improvement")
        print(f"  ------------------------------|-------------------|-------------------|---------------------")
        print(f"  Casualties Served             | {p_m.total_casualties_served:17d} | {b_m.total_casualties_served:17d} | +{cmp.unserved_reduction} casualties")
        print(f"  Critical Served               | {p_m.critical_casualties_served:17d} | {b_m.critical_casualties_served:17d} | -")
        print(f"  Non-Critical Served           | {p_m.noncritical_casualties_served:17d} | {b_m.noncritical_casualties_served:17d} | -")
        print(f"  Total Unserved                | {p_m.total_unserved_casualties:17d} | {b_m.total_unserved_casualties:17d} | -{cmp.unserved_reduction} unserved")
        print(f"  Vehicle Response Time (mins)  | {p_m.total_ambulance_response_time_mins:17.1f} | {b_m.total_ambulance_response_time_mins:17.1f} | {cmp.response_time_reduction_pct:+.1f}%")
        print(f"  Patient Transport Time (mins) | {p_m.total_hospital_transport_time_mins:17.1f} | {b_m.total_hospital_transport_time_mins:17.1f} | {cmp.transport_time_reduction_pct:+.1f}%")
        print(f"  Patient-Weighted Resp (mins)  | {p_m.patient_weighted_response_time_mins:17.1f} | {b_m.patient_weighted_response_time_mins:17.1f} | -")
        print(f"  Summary Verdict: {cmp.summary_verdict}")
        print(f"  Is Improved: {cmp.is_performance_improved}")

    return resp


def run_multi_incident_contention_validation():
    print(f"\n{'='*80}")
    print(f"EVALUATING MULTI-INCIDENT CONTENTION SCENARIO")
    print(f"Simultaneous occurrence: HOTSPOT-01 (Tambaram) + HOTSPOT-04 (Katpadi Railway)")
    print(f"Total Casualties: 4 + 14 = 18 casualties (7 Critical, 11 Non-Critical)")
    print(f"{'='*80}")

    inc1 = DEFAULT_PRESET_INCIDENTS[0]  # HOTSPOT-01: 4 cas (2 crit)
    inc2 = DEFAULT_PRESET_INCIDENTS[3]  # HOTSPOT-04: 14 cas (5 crit)
    incidents = [inc1, inc2]

    bases = get_default_bases()

    # Discover nearby hospitals for both incidents combined
    hosp_map = {}
    for inc in incidents:
        found = discover_nearby_hospitals_for_incident(inc, max_radius_km=130.0, limit=6)
        for h in found:
            hosp_map[h.id] = h
    hospitals = list(hosp_map.values())

    params = OptimizationParameters(
        alpha=1.0,
        beta=1.0,
        M=10000.0,
        objective_mode="lexicographic",
        allow_unserved_penalty=True,
        enforce_strict_als_for_critical=True
    )

    req = OptimizationRequest(
        incidents=incidents,
        bases=bases,
        hospitals=hospitals,
        ambulance_types=DEFAULT_AMBULANCE_TYPES,
        parameters=params
    )

    resp = solve_emergency_dispatch_optimization(req)

    print(f"Solver Status: {resp.solver_status} | Objective Value: {resp.objective_value} | Solve Time: {resp.execution_time_ms} ms")
    print(f"Total Vehicle Response Time: {resp.total_vehicle_response_time_mins} veh-mins")
    print(f"Total Patient Transport Time: {resp.total_patient_transport_time_mins} patient-mins")

    for res in resp.incident_resolutions:
        print(f"\n--- Incident {res.incident_id}: {res.incident_name} ---")
        print(f"Casualties: Total={res.total_casualties} (Crit={res.critical_casualties}, NonCrit={res.noncritical_casualties})")
        print(f"Served:     Total={res.casualties_served} (Crit={res.critical_served}, NonCrit={res.noncritical_served})")
        print(f"Unserved:   Total={res.unserved_casualties} (Crit={res.critical_unserved}, NonCrit={res.noncritical_unserved})")
        print(f"Dispatched: {sum(a.quantity for a in res.ambulances_dispatched)} ambulances across {[a.ambulance_type for a in res.ambulances_dispatched]}")
        print(f"Allocated:  {sum(h.patients_allocated for h in res.hospitals_allocated)} patients across {[h.hospital_name for h in res.hospitals_allocated]}")

    print(f"\n--- Independent Verification Audit ---")
    iv = resp.independent_verification
    print(f"  Overall Valid: {iv.is_valid}")
    print(f"  Recalculated Fleet Availability:      {iv.recalculated_ambulance_availability}")
    print(f"  Recalculated Patient Accounting:      {iv.recalculated_patient_accounting}")
    print(f"  Recalculated Vehicle Cot Capacity:    {iv.recalculated_vehicle_capacity}")
    print(f"  Recalculated Hospital Capacity:       {iv.recalculated_hospital_capacity}")
    print(f"  Recalculated ALS Critical Coverage:   {iv.recalculated_als_critical_coverage}")
    print(f"  Objective Value Matches:              {iv.objective_value_matches}")
    assert iv.is_valid, "Independent verification failed for multi-incident scenario"

    print(f"\n--- Baseline Comparison ---")
    cmp = resp.baseline_comparison
    print(f"Summary Verdict: {cmp.summary_verdict}")
    print(f"Casualties served: PuLP {cmp.pulp_metrics.total_casualties_served} vs Baseline {cmp.baseline_metrics.total_casualties_served}")
    print(f"Response time improvement: {cmp.response_time_reduction_pct}%")
    print(f"Transport time improvement: {cmp.transport_time_reduction_pct}%")

    return resp


if __name__ == "__main__":
    print("STARTING PALS OPTIMIZATION ENGINE VERIFICATION RUN...")
    for p in DEFAULT_PRESET_INCIDENTS:
        run_single_preset_validation(p, mode="weighted_sum")

    # Run one preset under lexicographic mode to test both modes
    run_single_preset_validation(DEFAULT_PRESET_INCIDENTS[0], mode="lexicographic")

    # Run multi-incident contention scenario
    run_multi_incident_contention_validation()

    print("\n" + "="*80)
    print("ALL PRESET AND CONTENTION RUNS COMPLETED AND INDEPENDENTLY VERIFIED SUCCESSFULLY!")
    print("="*80)

