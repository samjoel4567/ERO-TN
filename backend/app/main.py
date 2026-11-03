"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
FastAPI Backend Service with PuLP Operations Research Optimization Engine
"""

from typing import List, Optional
import pulp
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from .cardiac_arrest.router import router as cardiac_arrest_router

from .models.schemas import (
    OptimizationRequest,
    OptimizationResponse,
    IncidentInput,
    AmbulanceBaseInput,
    HospitalCandidateInput,
    RouteRequest,
    RouteResponse
)
from .optimization.solver import solve_emergency_dispatch_optimization
from .services.data_loader import (
    get_default_bases,
    DEFAULT_PRESET_INCIDENTS,
    DEFAULT_AMBULANCE_TYPES,
    discover_nearby_hospitals_for_incident,
    estimate_road_distance_km,
    estimate_travel_time_mins
)

app = FastAPI(
    title="PALS Tamil Nadu ERO Optimization & Simulation Backend",
    description="Mathematical Operations Research Optimization (PuLP MILP) and Emergency Response System",
    version="4.0.0-optimization-engine"
)

# Enable CORS for frontend Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cardiac_arrest_router)


@app.get("/health")
@app.get("/api/health")
def health_check():
    """Health check reporting solver availability and system status."""
    solvers = pulp.listSolvers(onlyAvailable=True)
    return {
        "status": "healthy",
        "service": "PALS Operations Research Backend",
        "engine": "PuLP Mixed-Integer Linear Programming",
        "pulp_version": pulp.__version__,
        "available_solvers": solvers,
        "default_solver": "PULP_CBC_CMD" if "PULP_CBC_CMD" in solvers else (solvers[0] if solvers else "None"),
        "version": "4.0.0"
    }


@app.post("/api/optimize", response_model=OptimizationResponse)
def run_optimization(request: OptimizationRequest):
    """
    Solves the multi-incident, multi-base, multi-hospital resource allocation problem.
    Minimises weighted response time, hospital transport time, and unserved patient penalties.
    """
    if not request.incidents:
        raise HTTPException(status_code=400, detail="At least one emergency incident is required")
    if not request.bases:
        raise HTTPException(status_code=400, detail="At least one ambulance base is required")
    if not request.hospitals:
        raise HTTPException(status_code=400, detail="At least one hospital candidate is required")

    response = solve_emergency_dispatch_optimization(request)
    return response


@app.post("/api/optimize/preset/{preset_id}", response_model=OptimizationResponse)
def run_preset_optimization(
    preset_id: str,
    alpha: float = 1.0,
    beta: float = 1.0,
    M: float = 10000.0
):
    """
    Convenience endpoint to run PuLP optimization on one of the 5 preset hotspots.
    Automatically wires default scenario bases and discovers nearby hospital candidates.
    """
    matched = next((p for p in DEFAULT_PRESET_INCIDENTS if p.id.upper() == preset_id.upper()), None)
    if not matched:
        raise HTTPException(
            status_code=404,
            detail=f"Preset '{preset_id}' not found. Available presets: {[p.id for p in DEFAULT_PRESET_INCIDENTS]}"
        )

    bases = get_default_bases()
    hospitals = discover_nearby_hospitals_for_incident(matched, max_radius_km=100.0, limit=8)

    req = OptimizationRequest(
        incidents=[matched],
        bases=bases,
        hospitals=hospitals,
        ambulance_types=DEFAULT_AMBULANCE_TYPES,
        parameters={"alpha": alpha, "beta": beta, "M": M}
    )

    return solve_emergency_dispatch_optimization(req)


@app.get("/api/resources/presets", response_model=List[IncidentInput])
def get_presets():
    """Returns the five configured emergency incident presets."""
    return DEFAULT_PRESET_INCIDENTS


@app.get("/api/resources/bases", response_model=List[AmbulanceBaseInput])
def get_bases():
    """Returns the 10 configured scenario ambulance depots."""
    return get_default_bases()


@app.post("/api/routes/calculate", response_model=RouteResponse)
def calculate_road_route(payload: RouteRequest):
    """
    Computes road distance, duration, and GeoJSON path between two points.
    Uses fallback geometric circuity estimation when sandbox restricts outbound network.
    """
    dist_km = estimate_road_distance_km(payload.origin.lat, payload.origin.lng, payload.destination.lat, payload.destination.lng)
    duration_mins = estimate_travel_time_mins(dist_km, 50.0)

    # Generate 16 curved waypoints simulating corridor geometry
    waypoints = []
    lat1, lon1 = payload.origin.lat, payload.origin.lng
    lat2, lon2 = payload.destination.lat, payload.destination.lng
    d_lat = lat2 - lat1
    d_lon = lon2 - lon1
    perp_lat = -d_lon * 0.08
    perp_lon = d_lat * 0.08

    for i in range(17):
        t = i / 16.0
        import math
        curve = math.sin(t * math.pi) * (1.0 if i % 2 == 0 else -0.6)
        pt_lat = round(lat1 + d_lat * t + perp_lat * curve, 5)
        pt_lon = round(lon1 + d_lon * t + perp_lon * curve, 5)
        waypoints.append((pt_lat, pt_lon))

    return RouteResponse(
        coordinates=waypoints,
        distance_km=dist_km,
        duration_mins=duration_mins,
        is_real_road_route=False,
        source="Fallback Geometric Model (1.35x circuity)",
        message="Route geometry generated via calibrated highway corridor model"
    )
