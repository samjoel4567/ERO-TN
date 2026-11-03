"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
Mathematical Constraints Module

Implements Constraints A through F for the PuLP Mixed-Integer Linear Program,
with explicit separation of critical and non-critical casualty streams.
"""

from typing import Dict, List, Tuple
import pulp
from ..models.schemas import (
    IncidentInput,
    AmbulanceBaseInput,
    AmbulanceTypeConfig,
    HospitalCandidateInput,
    OptimizationParameters
)
from ..services.validation import evaluate_hospital_eligibility_by_acuity


def apply_optimization_constraints(
    prob: pulp.LpProblem,
    incidents: List[IncidentInput],
    bases: List[AmbulanceBaseInput],
    hospitals: List[HospitalCandidateInput],
    ambulance_types: List[AmbulanceTypeConfig],
    x_vars: Dict[Tuple[str, str, str], pulp.LpVariable],
    y_crit_vars: Dict[Tuple[str, str], pulp.LpVariable],
    y_noncrit_vars: Dict[Tuple[str, str], pulp.LpVariable],
    u_crit_vars: Dict[str, pulp.LpVariable],
    u_noncrit_vars: Dict[str, pulp.LpVariable],
    params: OptimizationParameters
) -> None:
    """
    Attaches constraints A through F to the PuLP LpProblem instance.
    """
    cap_map = {t.type: t.patient_capacity for t in ambulance_types}
    als_cap = cap_map.get("ALS", params.default_als_capacity)

    # --------------------------------------------------------------------------
    # CONSTRAINT A: Ambulance Availability
    # sum_{k} x[b,k,g] <= available[b,g]  for all base b, ambulance type g
    # --------------------------------------------------------------------------
    for b in bases:
        b_avail = b.available_units or {}
        for amb_type in ["ALS", "BLS", "NLS"]:
            avail = b_avail.get(amb_type, 0)
            dispatched_terms = [
                x_vars[(b.id, inc.id, amb_type)]
                for inc in incidents
                if (b.id, inc.id, amb_type) in x_vars
            ]
            if dispatched_terms:
                prob += (
                    pulp.lpSum(dispatched_terms) <= avail,
                    f"Constraint_A_Ambulance_Availability_{b.id}_{amb_type}"
                )

    # --------------------------------------------------------------------------
    # CONSTRAINT B.1: Patient Accounting — Critical Casualties
    # sum_{h} y_crit[k,h] + u_crit[k] == critical_casualties[k]  for all incident k
    # --------------------------------------------------------------------------
    for inc in incidents:
        crit_hosp_terms = [
            y_crit_vars[(inc.id, h.id)]
            for h in hospitals
            if (inc.id, h.id) in y_crit_vars
        ]
        u_crit_term = u_crit_vars[inc.id]
        prob += (
            pulp.lpSum(crit_hosp_terms) + u_crit_term == inc.critical_casualties,
            f"Constraint_B1_Critical_Patient_Accounting_{inc.id}"
        )

        if not params.allow_unserved_penalty:
            prob += (u_crit_term == 0, f"Enforce_Zero_Critical_Unserved_{inc.id}")

    # --------------------------------------------------------------------------
    # CONSTRAINT B.2: Patient Accounting — Non-Critical Casualties
    # sum_{h} y_noncrit[k,h] + u_noncrit[k] == noncritical_casualties[k]  for all incident k
    # --------------------------------------------------------------------------
    for inc in incidents:
        noncrit_hosp_terms = [
            y_noncrit_vars[(inc.id, h.id)]
            for h in hospitals
            if (inc.id, h.id) in y_noncrit_vars
        ]
        u_noncrit_term = u_noncrit_vars[inc.id]
        noncrit_count = inc.noncritical_casualties
        prob += (
            pulp.lpSum(noncrit_hosp_terms) + u_noncrit_term == noncrit_count,
            f"Constraint_B2_NonCritical_Patient_Accounting_{inc.id}"
        )

        if not params.allow_unserved_penalty:
            prob += (u_noncrit_term == 0, f"Enforce_Zero_NonCritical_Unserved_{inc.id}")

    # --------------------------------------------------------------------------
    # CONSTRAINT C: Total Ambulance Transport Capacity
    # sum_{h} (y_crit[k,h] + y_noncrit[k,h]) <= sum_{b,g} capacity[g] * x[b,k,g]
    # Total patients evacuated cannot exceed total cot capacity of dispatched fleet.
    # --------------------------------------------------------------------------
    for inc in incidents:
        total_evac_terms = [
            y_crit_vars[(inc.id, h.id)] + y_noncrit_vars[(inc.id, h.id)]
            for h in hospitals
            if (inc.id, h.id) in y_crit_vars
        ]
        amb_capacity_terms = [
            cap_map.get(g, 2) * x_vars[(b.id, inc.id, g)]
            for b in bases
            for g in ["ALS", "BLS", "NLS"]
            if (b.id, inc.id, g) in x_vars
        ]
        prob += (
            pulp.lpSum(total_evac_terms) <= pulp.lpSum(amb_capacity_terms),
            f"Constraint_C_Total_Ambulance_Transport_Capacity_{inc.id}"
        )

    # --------------------------------------------------------------------------
    # CONSTRAINT D: Hospital Receiving Capacity
    # sum_{k} (y_crit[k,h] + y_noncrit[k,h]) <= max(0, capacity[h] - workload[h])
    # --------------------------------------------------------------------------
    for h in hospitals:
        total_inflow_terms = [
            y_crit_vars[(inc.id, h.id)] + y_noncrit_vars[(inc.id, h.id)]
            for inc in incidents
            if (inc.id, h.id) in y_crit_vars
        ]
        free_capacity = max(0, h.receiving_capacity - h.simulated_workload)
        if total_inflow_terms:
            prob += (
                pulp.lpSum(total_inflow_terms) <= free_capacity,
                f"Constraint_D_Hospital_Receiving_Capacity_{h.id}"
            )

    # --------------------------------------------------------------------------
    # CONSTRAINT E: Clinical Suitability — ALS Requirement for Critical Casualties
    # Critical patients evacuated from incident k must be supported by sufficient
    # dispatched ALS capacity:
    #   sum_{h} y_crit[k,h] <= sum_{b} capacity[ALS] * x[b,k,ALS]
    #
    # KEY INTEGRITY GUARANTEE:
    # Unserved non-critical casualties (u_noncrit[k]) CANNOT satisfy or reduce this
    # requirement, because y_crit depends solely on critical casualties.
    # BLS units provide zero ALS capacity and cannot substitute for ALS.
    # --------------------------------------------------------------------------
    if params.enforce_strict_als_for_critical:
        for inc in incidents:
            if inc.critical_casualties > 0:
                crit_evac_terms = [
                    y_crit_vars[(inc.id, h.id)]
                    for h in hospitals
                    if (inc.id, h.id) in y_crit_vars
                ]
                als_capacity_terms = [
                    als_cap * x_vars[(b.id, inc.id, "ALS")]
                    for b in bases
                    if (b.id, inc.id, "ALS") in x_vars
                ]
                prob += (
                    pulp.lpSum(crit_evac_terms) <= pulp.lpSum(als_capacity_terms),
                    f"Constraint_E_Clinical_ALS_Coverage_For_Critical_{inc.id}"
                )

    # --------------------------------------------------------------------------
    # CONSTRAINT F: Hospital Clinical Eligibility by Acuity
    # Critical casualties can only go to facilities with verified trauma + ICU.
    # Non-critical casualties can only go to facilities with emergency department.
    # Unknown mandatory capabilities force allocation to zero.
    # --------------------------------------------------------------------------
    for inc in incidents:
        for h in hospitals:
            if (inc.id, h.id) in y_crit_vars:
                crit_eligible, noncrit_eligible, reason = evaluate_hospital_eligibility_by_acuity(h, inc)

                if not crit_eligible:
                    prob += (
                        y_crit_vars[(inc.id, h.id)] == 0,
                        f"Constraint_F_Ineligible_Hospital_Critical_Zero_{inc.id}_{h.id}"
                    )

                if not noncrit_eligible:
                    prob += (
                        y_noncrit_vars[(inc.id, h.id)] == 0,
                        f"Constraint_F_Ineligible_Hospital_NonCritical_Zero_{inc.id}_{h.id}"
                    )
