"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
Mixed-Integer Linear Programming Solver Module (PuLP)

Orchestrates the optimization model, decision variables, solver invocation,
constraint validation, baseline comparison, independent verification, and provenance reporting.
"""

import time
from typing import Dict, List, Optional, Tuple
import pulp

from ..models.schemas import (
    OptimizationRequest,
    OptimizationResponse,
    OptimizationComparison,
    BaselineComparisonMetrics,
    IncidentResolution,
    AmbulanceAllocation,
    HospitalAllocation,
    ProvenanceNotice,
    ConstraintValidationItem,
    AmbulanceTypeConfig,
    IndependentVerification
)
from ..services.data_loader import (
    estimate_road_distance_km,
    estimate_travel_time_mins,
    DEFAULT_AMBULANCE_TYPES
)
from ..services.validation import (
    validate_solution_constraints,
    perform_independent_verification
)
from .objective import (
    build_weighted_sum_objective,
    build_unserved_priority_objective,
    build_travel_time_objective
)
from .constraints import apply_optimization_constraints
from .baseline import run_nearest_suitable_baseline


def solve_emergency_dispatch_optimization(
    request: OptimizationRequest
) -> OptimizationResponse:
    """
    Main entry point for the Operations Research Optimization Engine.
    Formulates and solves the multi-incident emergency resource optimization MILP
    with strict separation of critical and non-critical patient flows.
    """
    start_time = time.perf_counter()

    incidents = request.incidents
    bases = request.bases
    hospitals = request.hospitals
    ambulance_types = request.ambulance_types or DEFAULT_AMBULANCE_TYPES
    params = request.parameters

    m_base = params.M
    m_crit = params.M_critical if params.M_critical is not None else (m_base * 2.0)
    m_noncrit = params.M_noncritical if params.M_noncritical is not None else m_base

    # 1. Build Distance and Travel-Time Matrices T[b,k] and T[k,h]
    travel_times_bk: Dict[Tuple[str, str], float] = {}
    travel_times_kh: Dict[Tuple[str, str], float] = {}
    road_distances_bk: Dict[Tuple[str, str], float] = {}
    road_distances_kh: Dict[Tuple[str, str], float] = {}

    for b in bases:
        for inc in incidents:
            if request.travel_times_bk and b.id in request.travel_times_bk and inc.id in request.travel_times_bk[b.id]:
                t_bk = request.travel_times_bk[b.id][inc.id]
                d_bk = request.road_distances_bk.get(b.id, {}).get(inc.id, t_bk * 0.8) if request.road_distances_bk else t_bk * 0.8
            else:
                d_bk = estimate_road_distance_km(b.lat, b.lng, inc.lat, inc.lng)
                t_bk = estimate_travel_time_mins(d_bk, 55.0)

            travel_times_bk[(b.id, inc.id)] = max(1.0, round(t_bk, 1))
            road_distances_bk[(b.id, inc.id)] = max(0.5, round(d_bk, 1))

    for inc in incidents:
        for h in hospitals:
            if request.travel_times_kh and inc.id in request.travel_times_kh and h.id in request.travel_times_kh[inc.id]:
                t_kh = request.travel_times_kh[inc.id][h.id]
                d_kh = request.road_distances_kh.get(inc.id, {}).get(h.id, t_kh * 0.75) if request.road_distances_kh else t_kh * 0.75
            else:
                d_kh = estimate_road_distance_km(inc.lat, inc.lng, h.lat, h.lng)
                t_kh = estimate_travel_time_mins(d_kh, 45.0)

            travel_times_kh[(inc.id, h.id)] = max(1.0, round(t_kh, 1))
            road_distances_kh[(inc.id, h.id)] = max(0.5, round(d_kh, 1))

    # Helper function to create decision variables
    def create_variables(prob_prefix: str = ""):
        # x[b,k,g]: Integer count of ambulances of type g from base b to incident k
        x_v: Dict[Tuple[str, str, str], pulp.LpVariable] = {}
        for b in bases:
            for inc in incidents:
                for g in ["ALS", "BLS", "NLS"]:
                    var_name = f"{prob_prefix}x_{b.id}_{inc.id}_{g}".replace("-", "_")
                    x_v[(b.id, inc.id, g)] = pulp.LpVariable(
                        name=var_name,
                        lowBound=0,
                        cat=pulp.LpInteger
                    )

        # y_crit[k,h]: Integer count of critical patients from incident k allocated to hospital h
        y_c: Dict[Tuple[str, str], pulp.LpVariable] = {}
        for inc in incidents:
            for h in hospitals:
                var_name = f"{prob_prefix}ycrit_{inc.id}_{h.id}".replace("-", "_")
                y_c[(inc.id, h.id)] = pulp.LpVariable(
                    name=var_name,
                    lowBound=0,
                    upBound=inc.critical_casualties,
                    cat=pulp.LpInteger
                )

        # y_noncrit[k,h]: Integer count of non-critical patients from incident k allocated to hospital h
        y_nc: Dict[Tuple[str, str], pulp.LpVariable] = {}
        for inc in incidents:
            for h in hospitals:
                var_name = f"{prob_prefix}ynoncrit_{inc.id}_{h.id}".replace("-", "_")
                y_nc[(inc.id, h.id)] = pulp.LpVariable(
                    name=var_name,
                    lowBound=0,
                    upBound=inc.noncritical_casualties,
                    cat=pulp.LpInteger
                )

        # u_crit[k]: Integer count of unserved critical casualties at incident k
        u_c: Dict[str, pulp.LpVariable] = {}
        for inc in incidents:
            var_name = f"{prob_prefix}ucrit_{inc.id}".replace("-", "_")
            u_c[inc.id] = pulp.LpVariable(
                name=var_name,
                lowBound=0,
                upBound=inc.critical_casualties,
                cat=pulp.LpInteger
            )

        # u_noncrit[k]: Integer count of unserved non-critical casualties at incident k
        u_nc: Dict[str, pulp.LpVariable] = {}
        for inc in incidents:
            var_name = f"{prob_prefix}unoncrit_{inc.id}".replace("-", "_")
            u_nc[inc.id] = pulp.LpVariable(
                name=var_name,
                lowBound=0,
                upBound=inc.noncritical_casualties,
                cat=pulp.LpInteger
            )

        return x_v, y_c, y_nc, u_c, u_nc

    # 2. Formulate and Solve based on objective mode
    solver = pulp.PULP_CBC_CMD(msg=False)

    try:
        if params.objective_mode == "lexicographic":
            # ------------------------------------------------------------------
            # Phase 1: Minimize unserved casualties (critical prioritized)
            # ------------------------------------------------------------------
            prob_p1 = pulp.LpProblem("PALS_Lexicographic_Phase1", pulp.LpMinimize)
            x_v1, y_c1, y_nc1, u_c1, u_nc1 = create_variables("p1_")
            apply_optimization_constraints(
                prob_p1, incidents, bases, hospitals, ambulance_types,
                x_v1, y_c1, y_nc1, u_c1, u_nc1, params
            )
            prob_p1 += build_unserved_priority_objective(incidents, u_c1, u_nc1), "Minimise_Unserved_Priority"
            p1_status_code = prob_p1.solve(solver)
            p1_status = pulp.LpStatus[p1_status_code]

            if p1_status != "Optimal":
                elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
                return OptimizationResponse(
                    status="INFEASIBLE" if p1_status == "Infeasible" else "UNBOUNDED",
                    solver_status=p1_status,
                    objective_mode=params.objective_mode,
                    alpha_used=params.alpha,
                    beta_used=params.beta,
                    M_critical_used=m_crit,
                    M_noncritical_used=m_noncrit,
                    error_message=f"Lexicographic Phase 1 is {p1_status}.",
                    data_provenance_notices=build_data_provenance_notices(),
                    execution_time_ms=elapsed_ms
                )

            z1_optimal = float(pulp.value(prob_p1.objective))

            # ------------------------------------------------------------------
            # Phase 2: Minimize travel time subject to unserved penalty <= z1_optimal
            # ------------------------------------------------------------------
            prob = pulp.LpProblem("PALS_Lexicographic_Phase2", pulp.LpMinimize)
            x_vars, y_crit_vars, y_noncrit_vars, u_crit_vars, u_noncrit_vars = create_variables()
            apply_optimization_constraints(
                prob, incidents, bases, hospitals, ambulance_types,
                x_vars, y_crit_vars, y_noncrit_vars, u_crit_vars, u_noncrit_vars, params
            )

            # Fix or cap the unserved score at z1_optimal
            unserved_expr = build_unserved_priority_objective(incidents, u_crit_vars, u_noncrit_vars)
            prob += (unserved_expr <= z1_optimal + 1e-5, "Preserve_Phase1_Minimum_Unserved")

            prob += build_travel_time_objective(
                incidents, x_vars, y_crit_vars, y_noncrit_vars,
                travel_times_bk, travel_times_kh, params
            ), "Minimise_Weighted_Travel_Time"

            solve_status_code = prob.solve(solver)
            solver_status = pulp.LpStatus[solve_status_code]

        else:
            # ------------------------------------------------------------------
            # Standard Weighted Sum Multi-Criteria Optimization
            # ------------------------------------------------------------------
            prob = pulp.LpProblem("PALS_Weighted_Sum_Optimization", pulp.LpMinimize)
            x_vars, y_crit_vars, y_noncrit_vars, u_crit_vars, u_noncrit_vars = create_variables()

            build_weighted_sum_objective(
                prob, incidents, x_vars, y_crit_vars, y_noncrit_vars,
                u_crit_vars, u_noncrit_vars, travel_times_bk, travel_times_kh, params
            )
            apply_optimization_constraints(
                prob, incidents, bases, hospitals, ambulance_types,
                x_vars, y_crit_vars, y_noncrit_vars, u_crit_vars, u_noncrit_vars, params
            )

            solve_status_code = prob.solve(solver)
            solver_status = pulp.LpStatus[solve_status_code]

    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        return OptimizationResponse(
            status="ERROR",
            solver_status="SolverExecutionError",
            objective_mode=params.objective_mode,
            alpha_used=params.alpha,
            beta_used=params.beta,
            M_critical_used=m_crit,
            M_noncritical_used=m_noncrit,
            error_message=f"PuLP solver execution failed: {str(exc)}",
            execution_time_ms=elapsed_ms
        )

    elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

    # 3. Handle Infeasible or Unbounded Status
    if solver_status != "Optimal":
        return OptimizationResponse(
            status="INFEASIBLE" if solver_status == "Infeasible" else "UNBOUNDED",
            solver_status=solver_status,
            objective_mode=params.objective_mode,
            alpha_used=params.alpha,
            beta_used=params.beta,
            M_critical_used=m_crit,
            M_noncritical_used=m_noncrit,
            error_message=f"Mathematical program is {solver_status}. Resource constraints cannot satisfy demand under current configuration without unserved casualties.",
            data_provenance_notices=build_data_provenance_notices(),
            execution_time_ms=elapsed_ms
        )

    # 4. Extract Solution Values
    x_sol: Dict[Tuple[str, str, str], int] = {}
    for k_key, var_x in x_vars.items():
        val = var_x.varValue
        x_sol[k_key] = int(round(val)) if val is not None else 0

    y_crit_sol: Dict[Tuple[str, str], int] = {}
    for k_key, var_y in y_crit_vars.items():
        val = var_y.varValue
        y_crit_sol[k_key] = int(round(val)) if val is not None else 0

    y_noncrit_sol: Dict[Tuple[str, str], int] = {}
    for k_key, var_y in y_noncrit_vars.items():
        val = var_y.varValue
        y_noncrit_sol[k_key] = int(round(val)) if val is not None else 0

    u_crit_sol: Dict[str, int] = {}
    for inc_id, var_u in u_crit_vars.items():
        val = var_u.varValue
        u_crit_sol[inc_id] = int(round(val)) if val is not None else 0

    u_noncrit_sol: Dict[str, int] = {}
    for inc_id, var_u in u_noncrit_vars.items():
        val = var_u.varValue
        u_noncrit_sol[inc_id] = int(round(val)) if val is not None else 0

    obj_val = float(pulp.value(prob.objective)) if prob.objective is not None else 0.0

    # 5. Structure Allocations and Incident Resolutions
    base_map = {b.id: b for b in bases}
    hosp_map = {h.id: h for h in hospitals}

    raw_amb_allocations: List[AmbulanceAllocation] = []
    for (b_id, inc_id, g), qty in x_sol.items():
        if qty > 0:
            b_obj = base_map.get(b_id)
            raw_amb_allocations.append(
                AmbulanceAllocation(
                    base_id=b_id,
                    base_name=b_obj.name if b_obj else b_id,
                    incident_id=inc_id,
                    ambulance_type=g,
                    quantity=qty,
                    response_time_mins=travel_times_bk.get((b_id, inc_id), 15.0),
                    travel_distance_km=road_distances_bk.get((b_id, inc_id), 10.0),
                    is_real_road_time=False
                )
            )

    raw_hosp_allocations: List[HospitalAllocation] = []
    for (inc_id, h_id) in y_crit_sol.keys():
        pts_crit = y_crit_sol.get((inc_id, h_id), 0)
        pts_noncrit = y_noncrit_sol.get((inc_id, h_id), 0)
        total_pts = pts_crit + pts_noncrit
        if total_pts > 0:
            h_obj = hosp_map.get(h_id)
            raw_hosp_allocations.append(
                HospitalAllocation(
                    incident_id=inc_id,
                    hospital_id=h_id,
                    hospital_name=h_obj.name if h_obj else h_id,
                    patients_allocated=total_pts,
                    critical_patients_allocated=pts_crit,
                    noncritical_patients_allocated=pts_noncrit,
                    transport_time_mins=travel_times_kh.get((inc_id, h_id), 25.0),
                    travel_distance_km=road_distances_kh.get((inc_id, h_id), 20.0),
                    is_real_road_time=False
                )
            )

    incident_resolutions: List[IncidentResolution] = []
    tot_global_resp = 0.0
    tot_global_trans = 0.0
    tot_global_patient_weighted_resp = 0.0

    for inc in incidents:
        amb_for_inc = [a for a in raw_amb_allocations if a.incident_id == inc.id]
        hosp_for_inc = [h for h in raw_hosp_allocations if h.incident_id == inc.id]

        c_served = sum(h.critical_patients_allocated for h in hosp_for_inc)
        nc_served = sum(h.noncritical_patients_allocated for h in hosp_for_inc)
        tot_served = c_served + nc_served

        c_unserved = u_crit_sol.get(inc.id, 0)
        nc_unserved = u_noncrit_sol.get(inc.id, 0)
        tot_unserved = c_unserved + nc_unserved

        tot_resp = sum(a.response_time_mins * a.quantity for a in amb_for_inc)
        tot_trans = sum(h.transport_time_mins * h.patients_allocated for h in hosp_for_inc)

        amb_count = sum(a.quantity for a in amb_for_inc)
        avg_resp = (tot_resp / amb_count) if amb_count > 0 else 0.0
        pat_weighted_resp = round(avg_resp * tot_served, 2)

        tot_global_resp += tot_resp
        tot_global_trans += tot_trans
        tot_global_patient_weighted_resp += pat_weighted_resp

        incident_resolutions.append(
            IncidentResolution(
                incident_id=inc.id,
                incident_name=inc.name,
                severity=inc.severity,
                total_casualties=inc.total_casualties,
                critical_casualties=inc.critical_casualties,
                noncritical_casualties=inc.noncritical_casualties,
                critical_served=c_served,
                noncritical_served=nc_served,
                critical_unserved=c_unserved,
                noncritical_unserved=nc_unserved,
                casualties_served=tot_served,
                unserved_casualties=tot_unserved,
                ambulances_dispatched=amb_for_inc,
                hospitals_allocated=hosp_for_inc,
                total_response_time_mins=round(tot_resp, 2),
                total_transport_time_mins=round(tot_trans, 2),
                patient_weighted_response_time_mins=pat_weighted_resp
            )
        )

    # 6. Constraint Validations (A through F + Derived check)
    constraint_validations = validate_solution_constraints(
        incidents, bases, hospitals, ambulance_types,
        x_sol, y_crit_sol, y_noncrit_sol, u_crit_sol, u_noncrit_sol
    )

    # 7. Independent Verification Audit
    independent_verification = perform_independent_verification(
        incidents, bases, hospitals, ambulance_types,
        x_sol, y_crit_sol, y_noncrit_sol, u_crit_sol, u_noncrit_sol,
        travel_times_bk, travel_times_kh, params, obj_val
    )

    # 8. Baseline Comparison
    baseline_metrics, _, _, _, _ = run_nearest_suitable_baseline(
        incidents, bases, hospitals, ambulance_types,
        travel_times_bk, travel_times_kh, road_distances_bk, road_distances_kh
    )

    pulp_tot_resp = sum(r.total_response_time_mins for r in incident_resolutions)
    pulp_tot_units = sum(a.quantity for a in raw_amb_allocations)
    pulp_avg_resp = round(pulp_tot_resp / max(1, pulp_tot_units), 2)
    pulp_tot_trans = sum(r.total_transport_time_mins for r in incident_resolutions)
    pulp_tot_served = sum(r.casualties_served for r in incident_resolutions)
    pulp_tot_unserved = sum(r.unserved_casualties for r in incident_resolutions)
    pulp_crit_served = sum(r.critical_served for r in incident_resolutions)
    pulp_noncrit_served = sum(r.noncritical_served for r in incident_resolutions)
    pulp_crit_unserved = sum(r.critical_unserved for r in incident_resolutions)
    pulp_noncrit_unserved = sum(r.noncritical_unserved for r in incident_resolutions)

    pulp_metrics = BaselineComparisonMetrics(
        strategy=f"PuLP Mixed-Integer Linear Program ({params.objective_mode})",
        total_ambulance_response_time_mins=round(pulp_tot_resp, 2),
        average_ambulance_response_time_mins=pulp_avg_resp,
        patient_weighted_response_time_mins=round(tot_global_patient_weighted_resp, 2),
        total_hospital_transport_time_mins=round(pulp_tot_trans, 2),
        total_casualties_served=pulp_tot_served,
        critical_casualties_served=pulp_crit_served,
        noncritical_casualties_served=pulp_noncrit_served,
        total_unserved_casualties=pulp_tot_unserved,
        critical_unserved_casualties=pulp_crit_unserved,
        noncritical_unserved_casualties=pulp_noncrit_unserved,
        ambulance_allocations_count=len(raw_amb_allocations),
        hospital_allocations_count=len(raw_hosp_allocations)
    )

    resp_reduct_pct = 0.0
    if baseline_metrics.total_ambulance_response_time_mins > 0:
        resp_reduct_pct = round(
            ((baseline_metrics.total_ambulance_response_time_mins - pulp_tot_resp) /
             baseline_metrics.total_ambulance_response_time_mins) * 100.0, 2
        )

    trans_reduct_pct = 0.0
    if baseline_metrics.total_hospital_transport_time_mins > 0:
        trans_reduct_pct = round(
            ((baseline_metrics.total_hospital_transport_time_mins - pulp_tot_trans) /
             baseline_metrics.total_hospital_transport_time_mins) * 100.0, 2
        )

    unserved_delta = baseline_metrics.total_unserved_casualties - pulp_tot_unserved

    is_improved = (unserved_delta > 0) or (
        unserved_delta == 0 and (resp_reduct_pct > 0.05 or trans_reduct_pct > 0.05)
    )

    tot_casualties_all = sum(i.total_casualties for i in incidents)
    if is_improved:
        verdict = (
            f"PuLP MILP improved resource efficiency over greedy heuristic: "
            f"served {pulp_tot_served}/{tot_casualties_all} casualties. "
            f"Response time reduction: {resp_reduct_pct}%, Transport time reduction: {trans_reduct_pct}%, "
            f"Unserved casualties reduction: {unserved_delta}."
        )
    else:
        verdict = (
            f"PuLP MILP matched or performed comparably with greedy baseline: "
            f"served {pulp_tot_served}/{tot_casualties_all} casualties. "
            f"Delta response time: {-resp_reduct_pct}%, Delta transport time: {-trans_reduct_pct}%."
        )

    baseline_comparison = OptimizationComparison(
        pulp_metrics=pulp_metrics,
        baseline_metrics=baseline_metrics,
        response_time_reduction_pct=resp_reduct_pct,
        transport_time_reduction_pct=trans_reduct_pct,
        unserved_reduction=unserved_delta,
        summary_verdict=verdict,
        is_performance_improved=is_improved
    )

    unserved_summary: Dict[str, Dict[str, int]] = {}
    for inc in incidents:
        unserved_summary[inc.id] = {
            "critical": u_crit_sol.get(inc.id, 0),
            "noncritical": u_noncrit_sol.get(inc.id, 0),
            "total": u_crit_sol.get(inc.id, 0) + u_noncrit_sol.get(inc.id, 0)
        }

    return OptimizationResponse(
        status="SUCCESS",
        solver_status=solver_status,
        solver_name="PULP_CBC_CMD",
        objective_mode=params.objective_mode,
        objective_value=round(obj_val, 2),
        alpha_used=params.alpha,
        beta_used=params.beta,
        M_critical_used=m_crit,
        M_noncritical_used=m_noncrit,
        total_vehicle_response_time_mins=round(tot_global_resp, 2),
        total_patient_transport_time_mins=round(tot_global_trans, 2),
        total_patient_weighted_response_time_mins=round(tot_global_patient_weighted_resp, 2),
        incident_resolutions=incident_resolutions,
        raw_ambulance_allocations=raw_amb_allocations,
        raw_hospital_allocations=raw_hosp_allocations,
        unserved_casualties_summary=unserved_summary,
        constraint_validations=constraint_validations,
        independent_verification=independent_verification,
        baseline_comparison=baseline_comparison,
        data_provenance_notices=build_data_provenance_notices(),
        execution_time_ms=elapsed_ms
    )


def build_data_provenance_notices() -> List[ProvenanceNotice]:
    """Generates mandatory data provenance and assumption warnings."""
    return [
        ProvenanceNotice(
            label="Verified Baseline Geographic Facilities",
            statement="339 hospital facility records and coordinates are verified against National Health Mission / TNHSP datasets.",
            is_verified=True
        ),
        ProvenanceNotice(
            label="Ambulance Fleet Aggregate vs Station Assumptions",
            statement="Official 108 records provide district-level aggregate counts (1,353 units across 38 districts). Base depot coordinates and vehicles used in this optimisation are scenario assumptions.",
            is_verified=False
        ),
        ProvenanceNotice(
            label="Hospital Clinical Capability Profiles",
            statement="Hospital capability tiers and receiving capacities are configured scenario assumptions. Facilities without verified profiles evaluate to UNKNOWN and cannot receive patients automatically.",
            is_verified=False
        ),
        ProvenanceNotice(
            label="Travel Time & Distance Assumptions",
            statement="Travel times utilize road routing or geodesic estimates with a 1.35x circuity factor. Speeds assume 55 km/h for ambulances and 45 km/h for transport.",
            is_verified=False
        )
    ]
