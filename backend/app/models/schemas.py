"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
Pydantic Schemas for Operations Research Mixed-Integer Linear Programming Engine
Updated with critical and non-critical patient segregation, lexicographic objectives,
and independent solution verification.
"""

from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, model_validator


class GeoPoint(BaseModel):
    lat: float = Field(..., ge=8.0, le=14.0, description="Latitude in Tamil Nadu")
    lng: float = Field(..., ge=76.0, le=81.0, description="Longitude in Tamil Nadu")


class GeoCoordinate(BaseModel):
    lat: float = Field(..., ge=8.0, le=14.0, description="Latitude in Tamil Nadu")
    lng: float = Field(..., ge=76.0, le=81.0, description="Longitude in Tamil Nadu")


class RouteRequest(BaseModel):
    origin: GeoCoordinate
    destination: GeoCoordinate


class RouteResponse(BaseModel):
    coordinates: List[Any]
    distance_km: float
    duration_mins: float
    is_real_road_route: bool
    source: str
    message: str


class IncidentInput(BaseModel):
    id: str = Field(..., description="Unique incident identifier, e.g. 'INC-01'")
    name: str = Field(..., description="Incident location/title")
    type: str = Field(default="Highway Accident", description="Incident type")
    severity: str = Field(default="HIGH", description="Severity label: CRITICAL, HIGH, MEDIUM, LOW")
    severity_weight: float = Field(default=1.0, gt=0, description="Weight multiplier S[k] in objective function")
    total_casualties: int = Field(..., ge=0, description="Total patient count at incident")
    critical_casualties: int = Field(default=0, ge=0, description="Count of critical patients requiring ALS")
    lat: float = Field(..., ge=8.0, le=14.0)
    lng: float = Field(..., ge=76.0, le=81.0)
    description: Optional[str] = None

    @property
    def noncritical_casualties(self) -> int:
        return max(0, self.total_casualties - self.critical_casualties)

    @model_validator(mode="after")
    def check_critical_le_total(self):
        if self.critical_casualties > self.total_casualties:
            raise ValueError(
                f"critical_casualties ({self.critical_casualties}) cannot exceed total_casualties ({self.total_casualties})"
            )
        return self


class AmbulanceTypeConfig(BaseModel):
    type: str = Field(..., description="Ambulance classification, e.g. 'ALS', 'BLS', 'NLS'")
    patient_capacity: int = Field(default=2, ge=1, description="Casualty transport capacity per vehicle")
    speed_kmph: float = Field(default=55.0, gt=0, description="Average road transit speed in km/h")
    is_als_capable: bool = Field(default=False, description="Whether this unit can handle critical casualties")


class AmbulanceBaseInput(BaseModel):
    id: str = Field(..., description="Unique base depot ID, e.g. 'BASE-CHN-01'")
    name: str = Field(..., description="Base depot name")
    lat: float = Field(..., ge=8.0, le=14.0)
    lng: float = Field(..., ge=76.0, le=81.0)
    district: str = Field(default="Chennai")
    # Number of available vehicles per type at this base: {'ALS': 2, 'BLS': 1}
    available_units: Dict[str, int] = Field(default_factory=dict)
    is_scenario_assumption: bool = Field(default=True, description="Provenance flag: scenario depot, not official station GPS")


class HospitalCandidateInput(BaseModel):
    id: str = Field(..., description="Hospital identifier matching 339 hospital records, e.g. '19204'")
    name: str = Field(..., description="Hospital facility name")
    lat: float = Field(..., ge=8.0, le=14.0)
    lng: float = Field(..., ge=76.0, le=81.0)
    district: str = Field(default="Chennai")
    facility_type: Optional[str] = Field(default="Hospital")
    # Receiving capacity and simulated workload are explicitly labeled scenario assumptions
    receiving_capacity: int = Field(default=4, ge=0, description="Scenario receiving intake capacity")
    simulated_workload: int = Field(default=0, ge=0, description="Current simulated patient intake workload")
    # Clinical capabilities dictionary: keys: emergencyDepartment, traumaCare, icu, emergencyEquipment, specialistCare
    capabilities: Dict[str, Any] = Field(default_factory=dict)
    is_scenario_profile: bool = Field(default=True, description="Provenance: configured profile vs raw unverified dataset")


class OptimizationParameters(BaseModel):
    alpha: float = Field(default=1.0, ge=0, description="Weight on ambulance response time in objective (vehicle-minutes)")
    beta: float = Field(default=1.0, ge=0, description="Weight on hospital transport time in objective (patient-minutes)")
    M: float = Field(default=10000.0, gt=0, description="Base penalty parameter per unserved patient")
    M_critical: Optional[float] = Field(default=None, description="Penalty parameter per unserved critical patient (defaults to 2 * M)")
    M_noncritical: Optional[float] = Field(default=None, description="Penalty parameter per unserved non-critical patient (defaults to M)")
    objective_mode: str = Field(default="weighted_sum", description="'weighted_sum' or 'lexicographic' (minimize unserved casualties first, then travel times)")
    default_als_capacity: int = Field(default=2, ge=1)
    default_bls_capacity: int = Field(default=2, ge=1)
    allow_unserved_penalty: bool = Field(default=True, description="If True, model uses unserved penalty u[k]; if False, all casualties must be served")
    enforce_strict_als_for_critical: bool = Field(default=True, description="Enforce that critical casualties require ALS transport capacity")


class OptimizationRequest(BaseModel):
    incidents: List[IncidentInput]
    bases: List[AmbulanceBaseInput]
    hospitals: List[HospitalCandidateInput]
    ambulance_types: Optional[List[AmbulanceTypeConfig]] = None
    parameters: Optional[OptimizationParameters] = Field(default_factory=OptimizationParameters)
    # Optional precomputed travel times:
    travel_times_bk: Optional[Dict[str, Dict[str, float]]] = None
    travel_times_kh: Optional[Dict[str, Dict[str, float]]] = None
    road_distances_bk: Optional[Dict[str, Dict[str, float]]] = None
    road_distances_kh: Optional[Dict[str, Dict[str, float]]] = None


class AmbulanceAllocation(BaseModel):
    base_id: str
    base_name: str
    incident_id: str
    ambulance_type: str
    quantity: int
    response_time_mins: float
    travel_distance_km: float
    is_real_road_time: bool = False


class HospitalAllocation(BaseModel):
    incident_id: str
    hospital_id: str
    hospital_name: str
    patients_allocated: int
    critical_patients_allocated: int = 0
    noncritical_patients_allocated: int = 0
    transport_time_mins: float
    travel_distance_km: float
    is_real_road_time: bool = False


class IncidentResolution(BaseModel):
    incident_id: str
    incident_name: str
    severity: str
    total_casualties: int
    critical_casualties: int
    noncritical_casualties: int
    critical_served: int
    noncritical_served: int
    critical_unserved: int
    noncritical_unserved: int
    casualties_served: int
    unserved_casualties: int
    ambulances_dispatched: List[AmbulanceAllocation]
    hospitals_allocated: List[HospitalAllocation]
    total_response_time_mins: float  # Sum of vehicle-minutes for dispatched ambulances
    total_transport_time_mins: float  # Sum of patient-minutes for hospital transport
    patient_weighted_response_time_mins: float = 0.0  # Sum of (response time * patients served at this incident)


class ConstraintValidationItem(BaseModel):
    constraint_name: str
    category: str
    is_satisfied: bool
    details: str
    is_derived_check: bool = False


class IndependentVerification(BaseModel):
    is_valid: bool
    recalculated_ambulance_availability: bool
    recalculated_patient_accounting: bool
    recalculated_vehicle_capacity: bool
    recalculated_hospital_capacity: bool
    recalculated_als_critical_coverage: bool
    solver_objective_value: Optional[float]
    recalculated_objective_value: Optional[float]
    objective_value_matches: bool
    details: Dict[str, Any] = Field(default_factory=dict)


class BaselineComparisonMetrics(BaseModel):
    strategy: str
    total_ambulance_response_time_mins: float
    average_ambulance_response_time_mins: float
    patient_weighted_response_time_mins: float = 0.0
    total_hospital_transport_time_mins: float
    total_casualties_served: int
    critical_casualties_served: int = 0
    noncritical_casualties_served: int = 0
    total_unserved_casualties: int
    critical_unserved_casualties: int = 0
    noncritical_unserved_casualties: int = 0
    ambulance_allocations_count: int
    hospital_allocations_count: int


class OptimizationComparison(BaseModel):
    pulp_metrics: BaselineComparisonMetrics
    baseline_metrics: BaselineComparisonMetrics
    response_time_reduction_pct: float
    transport_time_reduction_pct: float
    unserved_reduction: int
    summary_verdict: str
    is_performance_improved: bool = False


class ProvenanceNotice(BaseModel):
    label: str
    statement: str
    is_verified: bool


class OptimizationResponse(BaseModel):
    status: str = Field(..., description="'SUCCESS', 'INFEASIBLE', 'UNBOUNDED', 'ERROR'")
    solver_status: str = Field(..., description="PuLP solver status, e.g. 'Optimal', 'Infeasible'")
    solver_name: str = Field(default="PULP_CBC_CMD")
    objective_mode: str = Field(default="weighted_sum", description="'weighted_sum' or 'lexicographic'")
    objective_value: Optional[float] = None
    alpha_used: float
    beta_used: float
    M_critical_used: float
    M_noncritical_used: float
    total_vehicle_response_time_mins: float = 0.0
    total_patient_transport_time_mins: float = 0.0
    total_patient_weighted_response_time_mins: float = 0.0
    incident_resolutions: List[IncidentResolution] = Field(default_factory=list)
    raw_ambulance_allocations: List[AmbulanceAllocation] = Field(default_factory=list)
    raw_hospital_allocations: List[HospitalAllocation] = Field(default_factory=list)
    unserved_casualties_summary: Dict[str, Dict[str, int]] = Field(default_factory=dict)
    constraint_validations: List[ConstraintValidationItem] = Field(default_factory=list)
    independent_verification: Optional[IndependentVerification] = None
    baseline_comparison: Optional[OptimizationComparison] = None
    data_provenance_notices: List[ProvenanceNotice] = Field(default_factory=list)
    execution_time_ms: float = 0.0
    error_message: Optional[str] = None
