"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
Mathematical Objective Function Module

Supports:
1. Weighted Sum Multi-Criteria Objective:
   Minimise Z = alpha * sum_{b,k,g} (S[k] * T[b,k] * x[b,k,g])
              + beta  * sum_{k,h}   (S[k] * T[k,h] * (y_crit[k,h] + y_noncrit[k,h]))
              + sum_{k} S[k] * (M_crit * u_crit[k] + M_noncrit * u_noncrit[k])

2. Lexicographic Priority Objective:
   Phase 1: Minimise total unserved casualties (critical prioritized over non-critical)
   Phase 2: Minimise weighted response and transport travel times subject to minimum unserved casualties.

Units and Interpretation:
- Ambulance Response Term: sum (T[b,k] * x[b,k,g]) is in VEHICLE-MINUTES (fleet travel time to scene).
- Hospital Transport Term: sum (T[k,h] * (y_crit + y_noncrit)) is in PATIENT-MINUTES (cumulative evacuation transit experienced by patients).
- Unserved Casualties: Penalised with M_crit and M_noncrit (dimensionless large penalty, default 20,000 for critical and 10,000 for non-critical).
"""

from typing import Dict, List, Tuple
import pulp
from ..models.schemas import IncidentInput, OptimizationParameters


def build_weighted_sum_objective(
    prob: pulp.LpProblem,
    incidents: List[IncidentInput],
    x_vars: Dict[Tuple[str, str, str], pulp.LpVariable],
    y_crit_vars: Dict[Tuple[str, str], pulp.LpVariable],
    y_noncrit_vars: Dict[Tuple[str, str], pulp.LpVariable],
    u_crit_vars: Dict[str, pulp.LpVariable],
    u_noncrit_vars: Dict[str, pulp.LpVariable],
    travel_times_bk: Dict[Tuple[str, str], float],
    travel_times_kh: Dict[Tuple[str, str], float],
    params: OptimizationParameters
) -> pulp.LpAffineExpression:
    """
    Constructs and attaches the weighted-sum multi-criteria objective to the problem.
    """
    alpha = params.alpha
    beta = params.beta
    m_base = params.M
    m_crit = params.M_critical if params.M_critical is not None else (m_base * 2.0)
    m_noncrit = params.M_noncritical if params.M_noncritical is not None else m_base

    objective_terms = []

    # Term 1: Ambulance response time (vehicle-minutes) weighted by severity S[k]
    for (b_id, inc_id, g), var_x in x_vars.items():
        inc = next(i for i in incidents if i.id == inc_id)
        s_k = inc.severity_weight
        t_bk = travel_times_bk.get((b_id, inc_id), 15.0)
        coef = alpha * s_k * t_bk
        objective_terms.append(coef * var_x)

    # Term 2: Hospital transport time (patient-minutes) weighted by severity S[k]
    # Evaluated separately for critical and non-critical patient flows
    for (inc_id, h_id) in y_crit_vars.keys():
        inc = next(i for i in incidents if i.id == inc_id)
        s_k = inc.severity_weight
        t_kh = travel_times_kh.get((inc_id, h_id), 25.0)
        coef = beta * s_k * t_kh

        var_y_crit = y_crit_vars[(inc_id, h_id)]
        var_y_noncrit = y_noncrit_vars[(inc_id, h_id)]
        objective_terms.append(coef * var_y_crit)
        objective_terms.append(coef * var_y_noncrit)

    # Term 3: Critical and Non-Critical unserved patient penalties
    for inc_id, var_u_crit in u_crit_vars.items():
        inc = next(i for i in incidents if i.id == inc_id)
        s_k = inc.severity_weight
        coef_crit = m_crit * s_k
        objective_terms.append(coef_crit * var_u_crit)

    for inc_id, var_u_noncrit in u_noncrit_vars.items():
        inc = next(i for i in incidents if i.id == inc_id)
        s_k = inc.severity_weight
        coef_noncrit = m_noncrit * s_k
        objective_terms.append(coef_noncrit * var_u_noncrit)

    prob += pulp.lpSum(objective_terms), "Minimise_Weighted_Response_Transport_Unserved_Time"
    return prob.objective


# Backwards compatibility alias
build_objective_function = build_weighted_sum_objective


def build_unserved_priority_objective(
    incidents: List[IncidentInput],
    u_crit_vars: Dict[str, pulp.LpVariable],
    u_noncrit_vars: Dict[str, pulp.LpVariable]
) -> pulp.LpAffineExpression:
    """
    Constructs Phase 1 objective for Lexicographic optimization:
    Minimizes total unserved casualties with critical casualties prioritized.
    """
    terms = []
    for inc in incidents:
        s_k = inc.severity_weight
        # Critical casualties have 1000x weight over non-critical in unserved triage
        terms.append(1000.0 * s_k * u_crit_vars[inc.id])
        terms.append(1.0 * s_k * u_noncrit_vars[inc.id])
    return pulp.lpSum(terms)


def build_travel_time_objective(
    incidents: List[IncidentInput],
    x_vars: Dict[Tuple[str, str, str], pulp.LpVariable],
    y_crit_vars: Dict[Tuple[str, str], pulp.LpVariable],
    y_noncrit_vars: Dict[Tuple[str, str], pulp.LpVariable],
    travel_times_bk: Dict[Tuple[str, str], float],
    travel_times_kh: Dict[Tuple[str, str], float],
    params: OptimizationParameters
) -> pulp.LpAffineExpression:
    """
    Constructs Phase 2 objective for Lexicographic optimization:
    Minimizes weighted travel time (response + transport) given fixed unserved casualty minimum.
    """
    alpha = params.alpha
    beta = params.beta
    terms = []

    for (b_id, inc_id, g), var_x in x_vars.items():
        inc = next(i for i in incidents if i.id == inc_id)
        t_bk = travel_times_bk.get((b_id, inc_id), 15.0)
        terms.append(alpha * inc.severity_weight * t_bk * var_x)

    for (inc_id, h_id) in y_crit_vars.keys():
        inc = next(i for i in incidents if i.id == inc_id)
        t_kh = travel_times_kh.get((inc_id, h_id), 25.0)
        terms.append(beta * inc.severity_weight * t_kh * (y_crit_vars[(inc_id, h_id)] + y_noncrit_vars[(inc_id, h_id)]))

    return pulp.lpSum(terms)
