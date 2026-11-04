"""Synthetic resources at every mapped hospital, scoped to the cardiac sandbox."""
from ..models.schemas import AmbulanceBaseInput, HospitalCandidateInput
from ..services.data_loader import get_default_bases, load_verified_hospitals


def hospital_aeds():
    return [{
        "id": f"SIM-AED-HOSP-{h['id']}", "hospital_id": str(h["id"]),
        "facility_name": f"{h['name']} · mock hospital AED", "district": h["district"],
        "latitude": h["lat"], "longitude": h["lng"], "access_type": "public",
        "opening_hours": None, "operational_status": "operational", "availability_status": "available",
        "access_delay_minutes": 0.25, "data_origin": "synthetic_simulation",
        "resource_source": "hospital_mock", "access_note": "Mock 24/7 access; assumed pickup during ambulance mobilization.",
    } for h in load_verified_hospitals()]


def cardiac_bases():
    return get_default_bases() + [AmbulanceBaseInput(
        id=f"BASE-HOSP-{h['id']}", name=f"{h['name']} · mock ambulance post",
        lat=h["lat"], lng=h["lng"], district=h["district"],
        available_units={"ALS": 1, "BLS": 1}, is_scenario_assumption=True,
    ) for h in load_verified_hospitals()]


def cardiac_hospitals():
    # The expanded cardiac demo explicitly assumes receiving support at every site.
    # These flags never modify the source directory or general simulator profiles.
    return [HospitalCandidateInput(
        id=str(h["id"]), name=h["name"], lat=h["lat"], lng=h["lng"], district=h["district"],
        facility_type=h["type"], receiving_capacity=6, simulated_workload=0,
        capabilities={"emergencyDepartment": True, "traumaCare": True, "icu": True,
                      "emergencyEquipment": True, "specialistCare": True,
                      "profileSource": "Synthetic expanded cardiac simulation"},
        is_scenario_profile=True,
    ) for h in load_verified_hospitals()]


def fleet_units(bases=None):
    units = []
    for base in bases if bases is not None else cardiac_bases():
        hospital_id = base.id.removeprefix("BASE-HOSP-") if base.id.startswith("BASE-HOSP-") else None
        for kind, count in base.available_units.items():
            for index in range(count):
                units.append({"id": f"SIM-{base.id}-{kind}-{index + 1}", "base_id": base.id,
                              "base_name": base.name, "ambulance_type": kind, "hospital_id": hospital_id,
                              "latitude": base.lat, "longitude": base.lng, "district": base.district,
                              "data_origin": "synthetic_simulation", "availability_status": "available",
                              "equipment": "Mock AED, oxygen and resuscitation kit"})
    return units


def catalog(active=(), at=None):
    from datetime import datetime, timezone
    from .aed_service import accessible_at, all_aeds
    used_aeds = {r["id"] for incident in active for r in incident.assignments.get("aeds", [])}
    used_vehicles = {r["id"] for incident in active for r in incident.assignments.get("ambulances", [])}
    aeds = all_aeds()
    units = fleet_units()
    for aed in aeds:
        if aed["id"] in used_aeds:
            aed["availability_status"] = "assigned"
        aed["accessible"] = accessible_at(aed, at or datetime.now(timezone.utc))
        aed["eligible"] = (aed["availability_status"] == "available" and aed["operational_status"] == "operational"
                           and aed["accessible"])
    for unit in units:
        if unit["id"] in used_vehicles:
            unit["availability_status"] = "assigned"
    return {
        "data_origin": "synthetic_simulation", "aeds": aeds, "ambulances": units,
        "summary": {"hospital_sites": len(hospital_aeds()), "hospital_aeds": len(hospital_aeds()),
                    "hospital_ambulances": sum(u["hospital_id"] is not None for u in units),
                    "total_aeds": len(aeds), "eligible_aeds": sum(a["eligible"] for a in aeds),
                    "total_ambulances": len(units),
                    "available_ambulances": sum(u["availability_status"] == "available" for u in units)},
        "assumptions": "Every mapped hospital has one mock 24/7 AED, one ALS and one BLS ambulance, and six mock receiving places. All equipment, fleet inventories and clinical capabilities are synthetic.",
    }
