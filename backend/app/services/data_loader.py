"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
Data Loader Service for Operations Research Engine

Loads verified baseline dataset files (hospitals, district aggregates)
and scenario simulation resources (bases, vehicles, capability profiles)
from the project structure.
"""

import json
import math
import os
from typing import Dict, List, Optional, Tuple
from ..models.schemas import (
    IncidentInput,
    AmbulanceBaseInput,
    AmbulanceTypeConfig,
    HospitalCandidateInput
)

# Project root resolution
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "src", "data")


def calculate_haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two coordinates in kilometers."""
    R = 6371.0  # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def estimate_road_distance_km(lat1: float, lon1: float, lat2: float, lon2: float, circuity_factor: float = 1.35) -> float:
    """Estimate road travel distance using Haversine multiplied by road circuity factor."""
    direct_km = calculate_haversine_km(lat1, lon1, lat2, lon2)
    return round(direct_km * circuity_factor, 2)


def estimate_travel_time_mins(distance_km: float, speed_kmph: float = 50.0) -> float:
    """Convert distance into travel time in minutes based on average road speed."""
    if speed_kmph <= 0:
        speed_kmph = 50.0
    return round((distance_km / speed_kmph) * 60.0, 1)


# ------------------------------------------------------------------------------
# Default Scenario Ambulances & Depots (matching src/data/scenarioData.js)
# Explicitly labeled scenario assumptions
# ------------------------------------------------------------------------------
DEFAULT_SCENARIO_BASES: List[Dict[str, Any]] = [
    {
        "id": "BASE-CHN-01",
        "name": "Tambaram Emergency Response Sub-Depot",
        "lat": 12.9210,
        "lng": 80.1115,
        "district": "Chennai",
        "available_units": {"ALS": 1, "BLS": 1}
    },
    {
        "id": "BASE-CHN-02",
        "name": "Guindy Central Disaster Depot",
        "lat": 13.0080,
        "lng": 80.2030,
        "district": "Chennai",
        "available_units": {"ALS": 1, "NLS": 1}
    },
    {
        "id": "BASE-CBE-01",
        "name": "Gandhipuram Emergency Operations Post",
        "lat": 11.0180,
        "lng": 76.9620,
        "district": "Coimbatore",
        "available_units": {"ALS": 1}
    },
    {
        "id": "BASE-CBE-02",
        "name": "Sulur Highway Rapid Post",
        "lat": 11.0240,
        "lng": 77.1260,
        "district": "Coimbatore",
        "available_units": {"BLS": 1}
    },
    {
        "id": "BASE-MDU-01",
        "name": "Mattuthavani Bus Terminal Rescue Post",
        "lat": 9.9430,
        "lng": 78.1510,
        "district": "Madurai",
        "available_units": {"ALS": 1}
    },
    {
        "id": "BASE-TRZ-01",
        "name": "Thillai Nagar Emergency Transit Depot",
        "lat": 10.8250,
        "lng": 78.6880,
        "district": "Tiruchirappalli",
        "available_units": {"BLS": 1}
    },
    {
        "id": "BASE-SLM-01",
        "name": "Omalur Highway Response Post",
        "lat": 11.7410,
        "lng": 78.0430,
        "district": "Salem",
        "available_units": {"ALS": 1}
    },
    {
        "id": "BASE-VEL-01",
        "name": "Vellore Golden City Rapid Depot",
        "lat": 12.9200,
        "lng": 79.1350,
        "district": "Vellore",
        "available_units": {"ALS": 1}
    },
    {
        "id": "BASE-KGI-01",
        "name": "Hosur SIPCOT Industrial Rapid Unit",
        "lat": 12.7420,
        "lng": 77.8210,
        "district": "Krishnagiri",
        "available_units": {"BLS": 1}
    },
    {
        "id": "BASE-TVI-01",
        "name": "Thiruvannamalai Town Feeder Base",
        "lat": 12.2290,
        "lng": 79.0680,
        "district": "Tiruvannamalai",
        "available_units": {"BLS": 1}
    }
]

DEFAULT_AMBULANCE_TYPES = [
    AmbulanceTypeConfig(type="ALS", patient_capacity=2, speed_kmph=55.0, is_als_capable=True),
    AmbulanceTypeConfig(type="BLS", patient_capacity=2, speed_kmph=58.0, is_als_capable=False),
    AmbulanceTypeConfig(type="NLS", patient_capacity=1, speed_kmph=50.0, is_als_capable=False)
]

# ------------------------------------------------------------------------------
# Default Preset Incidents (matching src/data/scenarioData.js)
# ------------------------------------------------------------------------------
DEFAULT_PRESET_INCIDENTS = [
    IncidentInput(
        id="HOTSPOT-01",
        name="NH-45 Tambaram Bypass (Chennai Sector)",
        type="Highway Accident",
        severity="CRITICAL",
        severity_weight=2.0,
        total_casualties=4,
        critical_casualties=2,
        lat=12.9249,
        lng=80.1190,
        description="Multi-vehicle rear-end collision involving express bus and two passenger cars."
    ),
    IncidentInput(
        id="HOTSPOT-02",
        name="Avinashi Road Express Corridor (Coimbatore)",
        type="Highway Accident",
        severity="HIGH",
        severity_weight=1.5,
        total_casualties=3,
        critical_casualties=1,
        lat=11.0285,
        lng=77.0120,
        description="Commercial carrier collision at Hope College junction with fuel spill risk."
    ),
    IncidentInput(
        id="HOTSPOT-03",
        name="Madurai Outer Ring Road (Samayanallur)",
        type="Highway Accident",
        severity="CRITICAL",
        severity_weight=2.0,
        total_casualties=6,
        critical_casualties=3,
        lat=9.9860,
        lng=78.0640,
        description="Tourist van collision near Samayanallur interchange on NH-44."
    ),
    IncidentInput(
        id="HOTSPOT-04",
        name="Katpadi Railway Junction Perimeter (Vellore)",
        type="Railway Accident",
        severity="CRITICAL",
        severity_weight=2.5,
        total_casualties=14,
        critical_casualties=5,
        lat=12.9715,
        lng=79.1385,
        description="Level-crossing freight collision with passenger feeder near Katpadi yard."
    ),
    IncidentInput(
        id="HOTSPOT-05",
        name="Thiruvannamalai Girivalam Outer Ring Path",
        type="Stampede",
        severity="HIGH",
        severity_weight=1.5,
        total_casualties=9,
        critical_casualties=2,
        lat=12.2280,
        lng=79.0550,
        description="Crowd surge at temple west gate during gathering."
    )
]

# ------------------------------------------------------------------------------
# Configured Scenario Clinical Profiles for Key Hospitals
# (Matching src/data/hospitalCapabilityProfiles.js)
# ------------------------------------------------------------------------------
SCENARIO_CLINICAL_PROFILES = {
    # 19204: Rajiv Gandhi Government General Hospital (Tertiary Level I)
    "19204": {
        "emergencyDepartment": True,
        "traumaCare": True,
        "emergencyEquipment": True,
        "icu": True,
        "specialistCare": True,
        "traumaLevel": "Level I",
        "receiving_capacity": 10,
        "is_scenario_profile": True
    },
    # 47400: Govt Kilpauk Medical College Hospital (Tertiary Level II)
    "47400": {
        "emergencyDepartment": True,
        "traumaCare": True,
        "emergencyEquipment": True,
        "icu": True,
        "specialistCare": True,
        "traumaLevel": "Level II",
        "receiving_capacity": 6,
        "is_scenario_profile": True
    },
    # 19928: Tambaram Sub-District Hospital (Local primary clinic - lacks trauma/ICU)
    "19928": {
        "emergencyDepartment": True,
        "traumaCare": False,
        "emergencyEquipment": False,
        "icu": False,
        "specialistCare": False,
        "traumaLevel": "None",
        "receiving_capacity": 4,
        "is_scenario_profile": True
    },
    # 37790: Poonamallee Sub-District Hospital
    "37790": {
        "emergencyDepartment": True,
        "traumaCare": False,
        "emergencyEquipment": False,
        "icu": False,
        "specialistCare": False,
        "traumaLevel": "None",
        "receiving_capacity": 3,
        "is_scenario_profile": True
    },
    # 47436: Saidapet Sub-District Hospital
    "47436": {
        "emergencyDepartment": True,
        "traumaCare": False,
        "emergencyEquipment": False,
        "icu": False,
        "specialistCare": False,
        "traumaLevel": "None",
        "receiving_capacity": 3,
        "is_scenario_profile": True
    },
    # 47402: Govt Peripheral Hospital KK Nagar
    "47402": {
        "emergencyDepartment": True,
        "traumaCare": False,
        "emergencyEquipment": False,
        "icu": False,
        "specialistCare": False,
        "traumaLevel": "None",
        "receiving_capacity": 4,
        "is_scenario_profile": True
    },
    # 42253: Coimbatore Medical College Hospital
    "42253": {
        "emergencyDepartment": True,
        "traumaCare": True,
        "emergencyEquipment": True,
        "icu": True,
        "specialistCare": True,
        "traumaLevel": "Level I",
        "receiving_capacity": 8,
        "is_scenario_profile": True
    },
    # 46248: Sulur Sub-District Hospital
    "46248": {
        "emergencyDepartment": True,
        "traumaCare": False,
        "emergencyEquipment": False,
        "icu": False,
        "specialistCare": False,
        "traumaLevel": "None",
        "receiving_capacity": 3,
        "is_scenario_profile": True
    },
    # 66329: Govt Rajaji Hospital Madurai MCH
    "66329": {
        "emergencyDepartment": True,
        "traumaCare": True,
        "emergencyEquipment": True,
        "icu": True,
        "specialistCare": True,
        "traumaLevel": "Level I",
        "receiving_capacity": 8,
        "is_scenario_profile": True
    },
    # 19853: Vellore Medical College Hospital MCH
    "19853": {
        "emergencyDepartment": True,
        "traumaCare": True,
        "emergencyEquipment": True,
        "icu": True,
        "specialistCare": True,
        "traumaLevel": "Level II",
        "receiving_capacity": 6,
        "is_scenario_profile": True
    },
    # 37210: Vellore Sub-District Hospital
    "37210": {
        "emergencyDepartment": True,
        "traumaCare": False,
        "emergencyEquipment": False,
        "icu": False,
        "specialistCare": False,
        "traumaLevel": "None",
        "receiving_capacity": 4,
        "is_scenario_profile": True
    },
    # 20607: Tiruvannamalai MCH
    "20607": {
        "emergencyDepartment": True,
        "traumaCare": True,
        "emergencyEquipment": True,
        "icu": True,
        "specialistCare": True,
        "traumaLevel": "Level II",
        "receiving_capacity": 6,
        "is_scenario_profile": True
    }
}


def load_verified_hospitals() -> List[Dict[str, Any]]:
    """Loads the 339 verified hospital records from hospitalsData.json."""
    hospitals_file = os.path.join(DATA_DIR, "hospitalsData.json")
    if os.path.exists(hospitals_file):
        with open(hospitals_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def get_default_bases() -> List[AmbulanceBaseInput]:
    """Returns the default 10 scenario bases."""
    return [AmbulanceBaseInput(**b) for b in DEFAULT_SCENARIO_BASES]


def discover_nearby_hospitals_for_incident(
    incident: IncidentInput,
    hospitals_pool: Optional[List[Dict[str, Any]]] = None,
    max_radius_km: float = 80.0,
    limit: int = 8
) -> List[HospitalCandidateInput]:
    """Discovers hospitals near the incident and attaches clinical capability profiles."""
    if hospitals_pool is None:
        hospitals_pool = load_verified_hospitals()

    candidates = []
    for h in hospitals_pool:
        dist_km = calculate_haversine_km(incident.lat, incident.lng, h["lat"], h["lng"])
        if dist_km <= max_radius_km:
            h_id = str(h["id"])
            profile = SCENARIO_CLINICAL_PROFILES.get(h_id, {})
            caps = {
                "emergencyDepartment": profile.get("emergencyDepartment", "UNKNOWN"),
                "traumaCare": profile.get("traumaCare", "UNKNOWN"),
                "emergencyEquipment": profile.get("emergencyEquipment", "UNKNOWN"),
                "icu": profile.get("icu", "UNKNOWN"),
                "specialistCare": profile.get("specialistCare", "UNKNOWN")
            }
            candidates.append(
                HospitalCandidateInput(
                    id=h_id,
                    name=h.get("name", f"Hospital {h_id}"),
                    lat=h["lat"],
                    lng=h["lng"],
                    district=h.get("district", "Tamil Nadu"),
                    facility_type=h.get("type", "Hospital"),
                    receiving_capacity=profile.get("receiving_capacity", 4),
                    simulated_workload=0,
                    capabilities=caps,
                    is_scenario_profile=bool(profile)
                )
            )

    candidates.sort(key=lambda c: calculate_haversine_km(incident.lat, incident.lng, c.lat, c.lng))
    return candidates[:limit]

