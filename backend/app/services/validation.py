"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
Validation Service for Clinical Gates, Constraints, and Independent Solution Verification
"""

import re
from typing import Dict, List, Tuple, Any, Optional
from ..models.schemas import (
    IncidentInput,
    HospitalCandidateInput,
    AmbulanceBaseInput,
    AmbulanceTypeConfig,
    OptimizationParameters,
    ConstraintValidationItem,
    IndependentVerification
)

UNKNOWN = "UNKNOWN"


def build_clinical_requirements_for_incident(incident: IncidentInput) -> Dict[str, bool]:
    """
    Determines mandatory clinical requirements for an incident.
    Returns a dict of requirement keys mapped to boolean (True if mandatory).
    """
    high_acuity = incident.severity.upper() in ["CRITICAL", "HIGH"]
    trauma_incident = bool(re.search(r"accident|stampede|trauma|derailment|collision", incident.type, re.IGNORECASE))
    has_critical = incident.critical_casualties > 0
    is_mass_casualty = incident.total_casualties >= 8 or incident.critical_casualties >= 3

    return {
        "emergencyDepartment": True,
        "traumaCare": high_acuity or trauma_incident,
        "emergencyEquipment": has_critical,
        "icu": has_critical,
        "specialistCare": is_mass_casualty or (incident.severity.upper() == "CRITICAL" and incident.critical_casualties >= 2)
    }


def evaluate_hospital_eligibility_by_acuity(
    hospital: HospitalCandidateInput,
    incident: IncidentInput
) -> Tuple[bool, bool, str]:
    """
    Evaluates whether a hospital is eligible to receive:
    1. Critical patients (requires emergency department, trauma care, ICU, equipment, and specialist care if mass casualty)
    2. Non-critical patients (requires emergency department)

    Returns:
        (crit_eligible: bool, noncrit_eligible: bool, reason: str)
    """
    caps = hospital.capabilities or {}
    free_cap = max(0, hospital.receiving_capacity - hospital.simulated_workload)

    if free_cap <= 0:
        return False, False, f"Ineligible: Free intake capacity is 0 (Capacity: {hospital.receiving_capacity}, Workload: {hospital.simulated_workload})"

    # Check emergency department
    ed_val = caps.get("emergencyDepartment", UNKNOWN)
    ed_pass = ed_val is True or str(ed_val).upper() in ["PASS", "VERIFIED", "YES", "TRUE", "AVAILABLE"]
    if not ed_pass:
        return False, False, f"Ineligible: Emergency Department is {ed_val}"

    # Non-critical patients only require verified Emergency Department + Free Capacity
    noncrit_eligible = True

    # Critical patients require Trauma Care, ICU, Emergency Equipment
    mandatory_reqs = build_clinical_requirements_for_incident(incident)
    failed_crit = []
    unknown_crit = []

    for req_key in ["traumaCare", "emergencyEquipment", "icu", "specialistCare"]:
        if not mandatory_reqs.get(req_key, False):
            continue
        val = caps.get(req_key, UNKNOWN)
        if val is True or str(val).upper() in ["PASS", "VERIFIED", "YES", "TRUE", "AVAILABLE"]:
            continue
        elif val is False or str(val).upper() in ["FAIL", "UNAVAILABLE", "NO", "FALSE"]:
            failed_crit.append(f"{req_key}: FAIL")
        else:
            unknown_crit.append(f"{req_key}: UNKNOWN")

    if failed_crit:
        return False, noncrit_eligible, f"Critical Ineligible: {', '.join(failed_crit)}"
    if unknown_crit:
        return False, noncrit_eligible, f"Critical Unverified: {', '.join(unknown_crit)} (UNKNOWN cannot pass automatically)"

    return True, noncrit_eligible, "Eligible for both critical and non-critical casualties"


def evaluate_hospital_eligibility(
    hospital: HospitalCandidateInput,
    incident: IncidentInput
) -> Tuple[bool, str]:
    """Backwards compatible evaluation returning overall eligibility."""
    crit_el, noncrit_el, reason = evaluate_hospital_eligibility_by_acuity(hospital, incident)
    if incident.critical_casualties > 0:
        return crit_el, reason
    return noncrit_el, reason


def validate_solution_constraints(
    incidents: List[IncidentInput],
    bases: List[AmbulanceBaseInput],
    hospitals: List[HospitalCandidateInput],
    ambulance_types: List[AmbulanceTypeConfig],
    x_sol: Dict[Tuple[str, str, str], int],
    y_crit_sol: Dict[Tuple[str, str], int],
    y_noncrit_sol: Dict[Tuple[str, str], int],
    u_crit_sol: Dict[str, int],
    u_noncrit_sol: Dict[str, int]
) -> List[ConstraintValidationItem]:
    """
    Explicitly checks implemented mathematical constraints A through F.
    Derived checks (such as single-period disjointness) are labeled as derived checks,
    not independent mathematical constraints.
    """
    results: List[ConstraintValidationItem] = []
    cap_map = {t.type: t.patient_capacity for t in ambulance_types}
    als_cap = cap_map.get("ALS", 2)

    # --------------------------------------------------------------------------
    # Constraint A: Ambulance Fleet Availability
    # --------------------------------------------------------------------------
    c_a_satisfied = True
    c_a_details = []
    for b in bases:
        avail_dict = b.available_units or {}
        for amb_type in ["ALS", "BLS", "NLS"]:
            avail = avail_dict.get(amb_type, 0)
            dispatched = sum(x_sol.get((b.id, inc.id, amb_type), 0) for inc in incidents)
            if dispatched > avail:
                c_a_satisfied = False
                c_a_details.append(f"Base {b.id} ({amb_type}): dispatched {dispatched} > available {avail}")
    results.append(ConstraintValidationItem(
        constraint_name="Constraint A: Ambulance Fleet Availability",
        category="Ambulance Fleet",
        is_satisfied=c_a_satisfied,
        details="Satisfied: No base dispatched more vehicles than available" if c_a_satisfied else "; ".join(c_a_details),
        is_derived_check=False
    ))

    # --------------------------------------------------------------------------
    # Constraint B.1: Critical Patient Accounting
    # --------------------------------------------------------------------------
    c_b1_satisfied = True
    c_b1_details = []
    for inc in incidents:
        crit_served = sum(y_crit_sol.get((inc.id, h.id), 0) for h in hospitals)
        crit_unserved = u_crit_sol.get(inc.id, 0)
        if crit_served + crit_unserved != inc.critical_casualties:
            c_b1_satisfied = False
            c_b1_details.append(f"Incident {inc.id}: critical served ({crit_served}) + unserved ({crit_unserved}) != total critical ({inc.critical_casualties})")
    results.append(ConstraintValidationItem(
        constraint_name="Constraint B.1: Critical Patient Accounting",
        category="Patient Accounting by Acuity",
        is_satisfied=c_b1_satisfied,
        details="Satisfied: 100% of critical casualties accounted for (served + unserved)" if c_b1_satisfied else "; ".join(c_b1_details),
        is_derived_check=False
    ))

    # --------------------------------------------------------------------------
    # Constraint B.2: Non-Critical Patient Accounting
    # --------------------------------------------------------------------------
    c_b2_satisfied = True
    c_b2_details = []
    for inc in incidents:
        noncrit_served = sum(y_noncrit_sol.get((inc.id, h.id), 0) for h in hospitals)
        noncrit_unserved = u_noncrit_sol.get(inc.id, 0)
        expected_noncrit = inc.noncritical_casualties
        if noncrit_served + noncrit_unserved != expected_noncrit:
            c_b2_satisfied = False
            c_b2_details.append(f"Incident {inc.id}: non-critical served ({noncrit_served}) + unserved ({noncrit_unserved}) != total non-critical ({expected_noncrit})")
    results.append(ConstraintValidationItem(
        constraint_name="Constraint B.2: Non-Critical Patient Accounting",
        category="Patient Accounting by Acuity",
        is_satisfied=c_b2_satisfied,
        details="Satisfied: 100% of non-critical casualties accounted for (served + unserved)" if c_b2_satisfied else "; ".join(c_b2_details),
        is_derived_check=False
    ))

    # --------------------------------------------------------------------------
    # Constraint C: Total Ambulance Transport Capacity
    # --------------------------------------------------------------------------
    c_c_satisfied = True
    c_c_details = []
    for inc in incidents:
        total_evacuated = sum(
            y_crit_sol.get((inc.id, h.id), 0) + y_noncrit_sol.get((inc.id, h.id), 0)
            for h in hospitals
        )
        total_fleet_cap = sum(
            cap_map.get(g, 2) * x_sol.get((b.id, inc.id, g), 0)
            for b in bases
            for g in ["ALS", "BLS", "NLS"]
        )
        if total_evacuated > total_fleet_cap:
            c_c_satisfied = False
            c_c_details.append(f"Incident {inc.id}: evacuated {total_evacuated} > ambulance fleet capacity {total_fleet_cap}")
    results.append(ConstraintValidationItem(
        constraint_name="Constraint C: Ambulance Transport Capacity",
        category="Transport Capacity",
        is_satisfied=c_c_satisfied,
        details="Satisfied: Evacuated patients do not exceed dispatched vehicle cot capacity" if c_c_satisfied else "; ".join(c_c_details),
        is_derived_check=False
    ))

    # --------------------------------------------------------------------------
    # Constraint D: Hospital Receiving Capacity
    # --------------------------------------------------------------------------
    c_d_satisfied = True
    c_d_details = []
    for h in hospitals:
        total_inflow = sum(
            y_crit_sol.get((inc.id, h.id), 0) + y_noncrit_sol.get((inc.id, h.id), 0)
            for inc in incidents
        )
        free_cap = max(0, h.receiving_capacity - h.simulated_workload)
        if total_inflow > free_cap:
            c_d_satisfied = False
            c_d_details.append(f"Hospital {h.name} ({h.id}): allocated {total_inflow} > free capacity {free_cap}")
    results.append(ConstraintValidationItem(
        constraint_name="Constraint D: Hospital Receiving Capacity",
        category="Hospital Capacity",
        is_satisfied=c_d_satisfied,
        details="Satisfied: Hospital intake does not exceed configured free capacity" if c_d_satisfied else "; ".join(c_d_details),
        is_derived_check=False
    ))

    # --------------------------------------------------------------------------
    # Constraint E: Clinical Suitability — ALS Coverage for Critical Patients
    # --------------------------------------------------------------------------
    c_e_satisfied = True
    c_e_details = []
    for inc in incidents:
        if inc.critical_casualties > 0:
            crit_served = sum(y_crit_sol.get((inc.id, h.id), 0) for h in hospitals)
            als_dispatched = sum(x_sol.get((b.id, inc.id, "ALS"), 0) for b in bases)
            total_als_cap = als_dispatched * als_cap
            if crit_served > total_als_cap:
                c_e_satisfied = False
                c_e_details.append(f"Incident {inc.id}: critical casualties served ({crit_served}) > ALS capacity ({total_als_cap})")
    results.append(ConstraintValidationItem(
        constraint_name="Constraint E: Clinical Suitability (ALS Coverage for Critical)",
        category="Clinical Suitability",
        is_satisfied=c_e_satisfied,
        details="Satisfied: All transported critical patients are covered by dispatched ALS units; unserved non-critical casualties cannot satisfy this requirement" if c_e_satisfied else "; ".join(c_e_details),
        is_derived_check=False
    ))

    # --------------------------------------------------------------------------
    # Constraint F: Hospital Clinical Eligibility by Acuity
    # --------------------------------------------------------------------------
    c_f_satisfied = True
    c_f_details = []
    for inc in incidents:
        for h in hospitals:
            crit_alloc = y_crit_sol.get((inc.id, h.id), 0)
            noncrit_alloc = y_noncrit_sol.get((inc.id, h.id), 0)
            if crit_alloc > 0 or noncrit_alloc > 0:
                crit_el, noncrit_el, reason = evaluate_hospital_eligibility_by_acuity(h, inc)
                if crit_alloc > 0 and not crit_el:
                    c_f_satisfied = False
                    c_f_details.append(f"Incident {inc.id} sent {crit_alloc} critical patients to ineligible facility {h.name}: {reason}")
                if noncrit_alloc > 0 and not noncrit_el:
                    c_f_satisfied = False
                    c_f_details.append(f"Incident {inc.id} sent {noncrit_alloc} non-critical patients to ineligible facility {h.name}: {reason}")
    results.append(ConstraintValidationItem(
        constraint_name="Constraint F: Hospital Clinical Eligibility by Acuity",
        category="Clinical Screening",
        is_satisfied=c_f_satisfied,
        details="Satisfied: Zero casualties allocated to facilities failing clinical capabilities or with UNKNOWN capabilities" if c_f_satisfied else "; ".join(c_f_details),
        is_derived_check=False
    ))

    # --------------------------------------------------------------------------
    # Derived Operational Check: Multi-Incident Single-Period Disjointness
    # (Documented as an operational check derived from Constraint A, not an independent constraint)
    # --------------------------------------------------------------------------
    results.append(ConstraintValidationItem(
        constraint_name="Derived Operational Check: Multi-Incident Resource Disjointness",
        category="Derived Operational Property",
        is_satisfied=c_a_satisfied,
        details="Verified: Multi-incident fleet conservation is mathematically enforced by Constraint A (no individual vehicle is double-booked)",
        is_derived_check=True
    ))

    return results


def perform_independent_verification(
    incidents: List[IncidentInput],
    bases: List[AmbulanceBaseInput],
    hospitals: List[HospitalCandidateInput],
    ambulance_types: List[AmbulanceTypeConfig],
    x_sol: Dict[Tuple[str, str, str], int],
    y_crit_sol: Dict[Tuple[str, str], int],
    y_noncrit_sol: Dict[Tuple[str, str], int],
    u_crit_sol: Dict[str, int],
    u_noncrit_sol: Dict[str, int],
    travel_times_bk: Dict[Tuple[str, str], float],
    travel_times_kh: Dict[Tuple[str, str], float],
    params: OptimizationParameters,
    solver_obj_val: Optional[float]
) -> IndependentVerification:
    """
    Independently recalculates:
    1. Ambulance availability
    2. Patient accounting by acuity
    3. Vehicle transport capacity
    4. Hospital intake capacity
    5. ALS coverage for critical casualties
    6. Objective value calculation match
    """
    cap_map = {t.type: t.patient_capacity for t in ambulance_types}
    als_cap = cap_map.get("ALS", 2)

    # 1. Recalculate ambulance availability
    avail_ok = True
    avail_details = {}
    for b in bases:
        avail_dict = b.available_units or {}
        for g in ["ALS", "BLS", "NLS"]:
            dispatched = sum(x_sol.get((b.id, inc.id, g), 0) for inc in incidents)
            allowed = avail_dict.get(g, 0)
            avail_details[f"{b.id}_{g}"] = {"dispatched": dispatched, "allowed": allowed}
            if dispatched > allowed:
                avail_ok = False

    # 2. Recalculate patient accounting by acuity
    patient_ok = True
    patient_details = {}
    for inc in incidents:
        crit_served = sum(y_crit_sol.get((inc.id, h.id), 0) for h in hospitals)
        crit_unserved = u_crit_sol.get(inc.id, 0)
        noncrit_served = sum(y_noncrit_sol.get((inc.id, h.id), 0) for h in hospitals)
        noncrit_unserved = u_noncrit_sol.get(inc.id, 0)

        c_ok = (crit_served + crit_unserved == inc.critical_casualties)
        nc_ok = (noncrit_served + noncrit_unserved == inc.noncritical_casualties)
        if not (c_ok and nc_ok):
            patient_ok = False

        patient_details[inc.id] = {
            "critical_served": crit_served,
            "critical_unserved": crit_unserved,
            "critical_expected": inc.critical_casualties,
            "noncritical_served": noncrit_served,
            "noncritical_unserved": noncrit_unserved,
            "noncritical_expected": inc.noncritical_casualties
        }

    # 3. Recalculate vehicle capacity
    vehicle_ok = True
    vehicle_details = {}
    for inc in incidents:
        evacuated = sum(
            y_crit_sol.get((inc.id, h.id), 0) + y_noncrit_sol.get((inc.id, h.id), 0)
            for h in hospitals
        )
        fleet_cap = sum(
            cap_map.get(g, 2) * x_sol.get((b.id, inc.id, g), 0)
            for b in bases
            for g in ["ALS", "BLS", "NLS"]
        )
        vehicle_details[inc.id] = {"evacuated": evacuated, "fleet_capacity": fleet_cap}
        if evacuated > fleet_cap:
            vehicle_ok = False

    # 4. Recalculate hospital capacity
    hospital_ok = True
    hospital_details = {}
    for h in hospitals:
        inflow = sum(
            y_crit_sol.get((inc.id, h.id), 0) + y_noncrit_sol.get((inc.id, h.id), 0)
            for inc in incidents
        )
        free_cap = max(0, h.receiving_capacity - h.simulated_workload)
        hospital_details[h.id] = {"inflow": inflow, "free_capacity": free_cap}
        if inflow > free_cap:
            hospital_ok = False

    # 5. Recalculate ALS coverage
    als_ok = True
    als_details = {}
    for inc in incidents:
        if inc.critical_casualties > 0:
            crit_served = sum(y_crit_sol.get((inc.id, h.id), 0) for h in hospitals)
            als_dispatched = sum(x_sol.get((b.id, inc.id, "ALS"), 0) for b in bases)
            total_als_cap = als_dispatched * als_cap
            als_details[inc.id] = {"critical_served": crit_served, "als_capacity": total_als_cap}
            if crit_served > total_als_cap:
                als_ok = False

    # 6. Recalculate objective value
    alpha = params.alpha
    beta = params.beta
    m_base = params.M
    m_crit = params.M_critical if params.M_critical is not None else (m_base * 2.0)
    m_noncrit = params.M_noncritical if params.M_noncritical is not None else m_base

    recalc_obj = 0.0

    # Response time term (vehicle-minutes)
    for (b_id, inc_id, g), qty in x_sol.items():
        if qty > 0:
            inc = next(i for i in incidents if i.id == inc_id)
            t_bk = travel_times_bk.get((b_id, inc_id), 15.0)
            recalc_obj += alpha * inc.severity_weight * t_bk * qty

    # Transport time term (patient-minutes)
    for (inc_id, h_id) in y_crit_sol.keys():
        pts = y_crit_sol.get((inc_id, h_id), 0) + y_noncrit_sol.get((inc_id, h_id), 0)
        if pts > 0:
            inc = next(i for i in incidents if i.id == inc_id)
            t_kh = travel_times_kh.get((inc_id, h_id), 25.0)
            recalc_obj += beta * inc.severity_weight * t_kh * pts

    if params.objective_mode == "weighted_sum":
        # Add unserved penalties
        for inc_id, u_c in u_crit_sol.items():
            if u_c > 0:
                inc = next(i for i in incidents if i.id == inc_id)
                recalc_obj += m_crit * inc.severity_weight * u_c

        for inc_id, u_nc in u_noncrit_sol.items():
            if u_nc > 0:
                inc = next(i for i in incidents if i.id == inc_id)
                recalc_obj += m_noncrit * inc.severity_weight * u_nc

    recalc_obj = round(recalc_obj, 2)
    obj_matches = (solver_obj_val is not None) and (abs(solver_obj_val - recalc_obj) < 0.05)

    all_valid = avail_ok and patient_ok and vehicle_ok and hospital_ok and als_ok and obj_matches

    return IndependentVerification(
        is_valid=all_valid,
        recalculated_ambulance_availability=avail_ok,
        recalculated_patient_accounting=patient_ok,
        recalculated_vehicle_capacity=vehicle_ok,
        recalculated_hospital_capacity=hospital_ok,
        recalculated_als_critical_coverage=als_ok,
        solver_objective_value=solver_obj_val,
        recalculated_objective_value=recalc_obj,
        objective_value_matches=obj_matches,
        details={
            "ambulance_availability": avail_details,
            "patient_accounting": patient_details,
            "vehicle_capacity": vehicle_details,
            "hospital_capacity": hospital_details,
            "als_critical_coverage": als_details
        }
    )
