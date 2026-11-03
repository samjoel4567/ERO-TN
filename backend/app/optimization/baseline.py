"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
Baseline Heuristic Algorithm Module

Implements a standard greedy nearest-available, clinically suitable resource allocation
with separate tracking of critical and non-critical patient streams.
"""

from typing import Dict, List, Tuple
from ..models.schemas import (
    IncidentInput,
    AmbulanceBaseInput,
    AmbulanceTypeConfig,
    HospitalCandidateInput,
    BaselineComparisonMetrics,
    AmbulanceAllocation,
    HospitalAllocation
)
from ..services.validation import evaluate_hospital_eligibility_by_acuity


def run_nearest_suitable_baseline(
    incidents: List[IncidentInput],
    bases: List[AmbulanceBaseInput],
    hospitals: List[HospitalCandidateInput],
    ambulance_types: List[AmbulanceTypeConfig],
    travel_times_bk: Dict[Tuple[str, str], float],
    travel_times_kh: Dict[Tuple[str, str], float],
    road_distances_bk: Dict[Tuple[str, str], float],
    road_distances_kh: Dict[Tuple[str, str], float]
) -> Tuple[
    BaselineComparisonMetrics,
    List[AmbulanceAllocation],
    List[HospitalAllocation],
    Dict[str, int],
    Dict[str, int]
]:
    """
    Greedy heuristic:
    1. Iterate through incidents prioritized by severity weight, then critical casualties.
    2. Dispatch nearest available ALS units to cover critical casualties.
    3. Dispatch nearest available BLS (or leftover ALS) for non-critical casualties.
    4. Allocate critical casualties to nearest hospital eligible for critical trauma/ICU.
    5. Allocate non-critical casualties to nearest hospital with emergency department.
    6. Return metrics with segregated critical/non-critical tallies and patient-weighted response time.
    """
    cap_map = {t.type: t.patient_capacity for t in ambulance_types}
    als_cap = cap_map.get("ALS", 2)
    bls_cap = cap_map.get("BLS", 2)

    remaining_base_units: Dict[Tuple[str, str], int] = {}
    for b in bases:
        b_avail = b.available_units or {}
        for g in ["ALS", "BLS", "NLS"]:
            remaining_base_units[(b.id, g)] = b_avail.get(g, 0)

    remaining_hospital_capacity: Dict[str, int] = {}
    for h in hospitals:
        free_cap = max(0, h.receiving_capacity - h.simulated_workload)
        remaining_hospital_capacity[h.id] = free_cap

    sorted_incidents = sorted(
        incidents,
        key=lambda inc: (inc.severity_weight, inc.critical_casualties, inc.total_casualties),
        reverse=True
    )

    ambulance_allocations: List[AmbulanceAllocation] = []
    hospital_allocations: List[HospitalAllocation] = []
    u_crit_dict: Dict[str, int] = {}
    u_noncrit_dict: Dict[str, int] = {}

    total_vehicle_response_time = 0.0
    total_transport_time = 0.0
    total_patient_weighted_response_time = 0.0
    total_crit_served = 0
    total_noncrit_served = 0
    total_crit_unserved = 0
    total_noncrit_unserved = 0
    total_ambulance_units = 0

    for inc in sorted_incidents:
        critical_needed = inc.critical_casualties
        noncritical_needed = inc.noncritical_casualties

        als_units_for_inc = 0
        als_capacity_for_inc = 0
        bls_capacity_for_inc = 0
        inc_response_times = []

        # Step 1: Dispatch ALS units strictly for critical casualties first
        if critical_needed > 0:
            candidate_als_bases = [
                b for b in bases
                if remaining_base_units.get((b.id, "ALS"), 0) > 0
            ]
            candidate_als_bases.sort(key=lambda b: travel_times_bk.get((b.id, inc.id), 999.0))

            for b in candidate_als_bases:
                if als_capacity_for_inc >= critical_needed:
                    break
                avail = remaining_base_units.get((b.id, "ALS"), 0)
                needed_units = (critical_needed - als_capacity_for_inc + als_cap - 1) // als_cap
                to_dispatch = min(avail, needed_units)

                if to_dispatch > 0:
                    remaining_base_units[(b.id, "ALS")] -= to_dispatch
                    als_capacity_for_inc += to_dispatch * als_cap
                    als_units_for_inc += to_dispatch
                    total_ambulance_units += to_dispatch

                    resp_time = travel_times_bk.get((b.id, inc.id), 15.0)
                    dist_km = road_distances_bk.get((b.id, inc.id), 12.0)
                    total_vehicle_response_time += resp_time * to_dispatch
                    inc_response_times.extend([resp_time] * to_dispatch)

                    ambulance_allocations.append(
                        AmbulanceAllocation(
                            base_id=b.id,
                            base_name=b.name,
                            incident_id=inc.id,
                            ambulance_type="ALS",
                            quantity=to_dispatch,
                            response_time_mins=resp_time,
                            travel_distance_km=dist_km,
                            is_real_road_time=False
                        )
                    )

        # Step 2: Dispatch BLS (or surplus ALS) for non-critical casualties
        surplus_als_capacity = max(0, als_capacity_for_inc - critical_needed)
        noncrit_covered_by_surplus_als = min(noncritical_needed, surplus_als_capacity)
        noncrit_still_needed = max(0, noncritical_needed - noncrit_covered_by_surplus_als)

        if noncrit_still_needed > 0:
            candidate_general_bases = []
            # Prefer BLS first so ALS is preserved
            for b in bases:
                if remaining_base_units.get((b.id, "BLS"), 0) > 0:
                    candidate_general_bases.append((b, "BLS"))
            for b in bases:
                if remaining_base_units.get((b.id, "ALS"), 0) > 0:
                    candidate_general_bases.append((b, "ALS"))

            candidate_general_bases.sort(key=lambda item: travel_times_bk.get((item[0].id, inc.id), 999.0))

            for b, g in candidate_general_bases:
                if noncrit_still_needed <= 0:
                    break
                avail = remaining_base_units.get((b.id, g), 0)
                if avail <= 0:
                    continue
                unit_cap = cap_map.get(g, 2)
                needed_units = (noncrit_still_needed + unit_cap - 1) // unit_cap
                to_dispatch = min(avail, needed_units)

                if to_dispatch > 0:
                    remaining_base_units[(b.id, g)] -= to_dispatch
                    bls_capacity_for_inc += to_dispatch * unit_cap
                    noncrit_still_needed = max(0, noncrit_still_needed - to_dispatch * unit_cap)
                    total_ambulance_units += to_dispatch

                    resp_time = travel_times_bk.get((b.id, inc.id), 15.0)
                    dist_km = road_distances_bk.get((b.id, inc.id), 12.0)
                    total_vehicle_response_time += resp_time * to_dispatch
                    inc_response_times.extend([resp_time] * to_dispatch)

                    ambulance_allocations.append(
                        AmbulanceAllocation(
                            base_id=b.id,
                            base_name=b.name,
                            incident_id=inc.id,
                            ambulance_type=g,
                            quantity=to_dispatch,
                            response_time_mins=resp_time,
                            travel_distance_km=dist_km,
                            is_real_road_time=False
                        )
                    )

        # Step 3: Evacuation Limits by Acuity
        max_crit_evac = min(critical_needed, als_capacity_for_inc)
        total_fleet_cap = als_capacity_for_inc + bls_capacity_for_inc
        max_noncrit_evac = min(noncritical_needed, max(0, total_fleet_cap - max_crit_evac))

        # Step 4: Hospital Allocation for Critical Casualties
        crit_candidates = []
        for h in hospitals:
            crit_el, _, _ = evaluate_hospital_eligibility_by_acuity(h, inc)
            if crit_el and remaining_hospital_capacity.get(h.id, 0) > 0:
                crit_candidates.append(h)
        crit_candidates.sort(key=lambda h: travel_times_kh.get((inc.id, h.id), 999.0))

        crit_to_alloc = max_crit_evac
        crit_served = 0
        hosp_alloc_map: Dict[str, Dict[str, int]] = {}

        for h in crit_candidates:
            if crit_to_alloc <= 0:
                break
            free_cap = remaining_hospital_capacity.get(h.id, 0)
            alloc = min(free_cap, crit_to_alloc)
            if alloc > 0:
                remaining_hospital_capacity[h.id] -= alloc
                crit_to_alloc -= alloc
                crit_served += alloc
                trans_time = travel_times_kh.get((inc.id, h.id), 25.0)
                total_transport_time += trans_time * alloc

                hosp_alloc_map.setdefault(h.id, {"crit": 0, "noncrit": 0})
                hosp_alloc_map[h.id]["crit"] += alloc

        # Step 5: Hospital Allocation for Non-Critical Casualties
        noncrit_candidates = []
        for h in hospitals:
            _, noncrit_el, _ = evaluate_hospital_eligibility_by_acuity(h, inc)
            if noncrit_el and remaining_hospital_capacity.get(h.id, 0) > 0:
                noncrit_candidates.append(h)
        noncrit_candidates.sort(key=lambda h: travel_times_kh.get((inc.id, h.id), 999.0))

        noncrit_to_alloc = max_noncrit_evac
        noncrit_served = 0

        for h in noncrit_candidates:
            if noncrit_to_alloc <= 0:
                break
            free_cap = remaining_hospital_capacity.get(h.id, 0)
            alloc = min(free_cap, noncrit_to_alloc)
            if alloc > 0:
                remaining_hospital_capacity[h.id] -= alloc
                noncrit_to_alloc -= alloc
                noncrit_served += alloc
                trans_time = travel_times_kh.get((inc.id, h.id), 25.0)
                total_transport_time += trans_time * alloc

                hosp_alloc_map.setdefault(h.id, {"crit": 0, "noncrit": 0})
                hosp_alloc_map[h.id]["noncrit"] += alloc

        # Consolidate Hospital Allocations
        for h_id, counts in hosp_alloc_map.items():
            tot_p = counts["crit"] + counts["noncrit"]
            if tot_p > 0:
                h_obj = next(h for h in hospitals if h.id == h_id)
                hospital_allocations.append(
                    HospitalAllocation(
                        incident_id=inc.id,
                        hospital_id=h_id,
                        hospital_name=h_obj.name,
                        patients_allocated=tot_p,
                        critical_patients_allocated=counts["crit"],
                        noncritical_patients_allocated=counts["noncrit"],
                        transport_time_mins=travel_times_kh.get((inc.id, h_id), 25.0),
                        travel_distance_km=road_distances_kh.get((inc.id, h_id), 20.0),
                        is_real_road_time=False
                    )
                )

        u_crit = critical_needed - crit_served
        u_noncrit = noncritical_needed - noncrit_served
        u_crit_dict[inc.id] = u_crit
        u_noncrit_dict[inc.id] = u_noncrit

        total_crit_served += crit_served
        total_noncrit_served += noncrit_served
        total_crit_unserved += u_crit
        total_noncrit_unserved += u_noncrit

        # Patient-weighted response time for this incident
        if inc_response_times and (crit_served + noncrit_served) > 0:
            avg_inc_resp = sum(inc_response_times) / len(inc_response_times)
            total_patient_weighted_response_time += avg_inc_resp * (crit_served + noncrit_served)

    total_served = total_crit_served + total_noncrit_served
    total_unserved = total_crit_unserved + total_noncrit_unserved
    avg_vehicle_response = round(total_vehicle_response_time / max(1, total_ambulance_units), 2)

    metrics = BaselineComparisonMetrics(
        strategy="Nearest Available Clinically Suitable Greedy Heuristic",
        total_ambulance_response_time_mins=round(total_vehicle_response_time, 2),
        average_ambulance_response_time_mins=avg_vehicle_response,
        patient_weighted_response_time_mins=round(total_patient_weighted_response_time, 2),
        total_hospital_transport_time_mins=round(total_transport_time, 2),
        total_casualties_served=total_served,
        critical_casualties_served=total_crit_served,
        noncritical_casualties_served=total_noncrit_served,
        total_unserved_casualties=total_unserved,
        critical_unserved_casualties=total_crit_unserved,
        noncritical_unserved_casualties=total_noncrit_unserved,
        ambulance_allocations_count=len(ambulance_allocations),
        hospital_allocations_count=len(hospital_allocations)
    )

    return metrics, ambulance_allocations, hospital_allocations, u_crit_dict, u_noncrit_dict
