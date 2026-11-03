"""Adapter to the existing MILP; synthetic early-response coordination."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from fastapi import HTTPException

from ..models.schemas import IncidentInput, OptimizationRequest, OptimizationParameters
from ..optimization.solver import solve_emergency_dispatch_optimization
from ..services.data_loader import (get_default_bases, discover_nearby_hospitals_for_incident,
                                    calculate_haversine_km, DEFAULT_AMBULANCE_TYPES)
from .aed_service import nearby_aeds, walking_minutes
from .responder_service import nearby_responders
from .tracking_service import TERMINAL, event, transition, update_analytics


def commitments(incidents, excluding=None):
    return [i for i in incidents if i.id != excluding and i.status.value not in TERMINAL]


def reserved_ids(incidents, group):
    return {r["id"] for i in incidents for r in i.assignments.get(group, [])}


def allocate_transport(incident, active):
    report = incident.report
    if not (8 <= report.latitude <= 14 and 76 <= report.longitude <= 81):
        raise HTTPException(422, "Report saved. Ambulance simulation currently covers Tamil Nadu (8–14°N, 76–81°E).")
    demand = IncidentInput(id=incident.id, name=report.location_name, type="CARDIAC_ARREST",
                           severity="CRITICAL", severity_weight=2,
                           total_casualties=report.victim_count, critical_casualties=report.victim_count,
                           lat=report.latitude, lng=report.longitude, description=report.description)
    bases = get_default_bases()
    used = reserved_ids(active, "ambulances") | set(incident.exclusions["ambulances"])
    slots = {}
    for base in bases:
        for kind, count in base.available_units.items():
            available = [f"SIM-{base.id}-{kind}-{n + 1}" for n in range(count)
                         if f"SIM-{base.id}-{kind}-{n + 1}" not in used]
            if calculate_haversine_km(report.latitude, report.longitude, base.lat, base.lng) > 80:
                available = []
            slots[(base.id, kind)] = available
            base.available_units[kind] = len(available)
    hospitals = discover_nearby_hospitals_for_incident(demand, max_radius_km=120, limit=80)
    hospitals = [h for h in hospitals if h.id not in incident.exclusions["hospitals"]
                 and all(h.capabilities.get(cap) is True for cap in ("emergencyDepartment", "icu", "emergencyEquipment"))]
    for hospital in hospitals:
        hospital.simulated_workload = sum(h["patients_allocated"] for i in active
                                         for h in i.assignments.get("hospitals", []) if h["id"] == hospital.id)
    result = solve_emergency_dispatch_optimization(OptimizationRequest(
        incidents=[demand], bases=bases, hospitals=hospitals, ambulance_types=DEFAULT_AMBULANCE_TYPES,
        parameters=OptimizationParameters(objective_mode="lexicographic")))
    if result.status != "SUCCESS" or (result.independent_verification and not result.independent_verification.is_valid):
        raise HTTPException(503, "Existing PuLP solver could not produce a verified plan. No substitute dispatch was created.")
    base_map, hospital_map = {b.id: b for b in bases}, {h.id: h for h in hospitals}
    ambulances, destinations = [], []
    for allocation in result.raw_ambulance_allocations:
        base = base_map[allocation.base_id]
        for slot in slots[(allocation.base_id, allocation.ambulance_type)][:allocation.quantity]:
            ambulances.append({**allocation.model_dump(), "id": slot, "quantity": 1, "latitude": base.lat,
                               "longitude": base.lng, "status": "assigned", "data_origin": "synthetic_simulation",
                               "route_source": "Existing solver estimate: 1.35× straight-line distance"})
    for allocation in result.raw_hospital_allocations:
        hospital = hospital_map[allocation.hospital_id]
        destinations.append({**allocation.model_dump(), "id": hospital.id, "latitude": hospital.lat,
                             "longitude": hospital.lng, "status": "reserved", "data_origin": "scenario_capability_profile"})
    resolution = result.incident_resolutions[0]
    return ambulances, destinations, {"solver_status": result.solver_status, "solver_computation_ms": result.execution_time_ms,
                                     "unserved_victims": resolution.unserved_casualties,
                                     "served_victims": resolution.casualties_served}


def scheduled(kind, resource_id, status, at, message):
    return {"kind": kind, "resource_id": resource_id, "status": status, "at_seconds": round(at, 2), "message": message}


def community_plan(incident, aeds, responders, mode, now):
    """AED runner in B; eligible responder walks via AED in C. No CPR/use inference."""
    devices, people, schedule = [], [], []
    if mode == "baseline":
        return devices, people, schedule
    report = incident.report
    departure = now + 15
    collector = None
    if aeds:
        if mode == "aed":
            device = aeds[0]
            arrival = departure + device["estimated_access_minutes"] * 60
            devices = [{**device, "status": "identified", "collector_id": "SIM-RETRIEVAL-RUNNER",
                        "retrieval_assumption": "Fictional runner starts at the incident, walks to AED and returns.",
                        "arrival_seconds": round(arrival, 2)}]
        else:
            pairs = [(r, a, walking_minutes(r["latitude"], r["longitude"], a["latitude"], a["longitude"]) +
                      a["access_delay_minutes"] + walking_minutes(a["latitude"], a["longitude"], report.latitude, report.longitude))
                     for r in responders if r["training_status"] == "CPR_AED" for a in aeds]
            if pairs:
                collector, device, duration = min(pairs, key=lambda p: (p[2], p[0]["id"], p[1]["id"]))
                arrival = departure + duration * 60
                devices = [{**device, "status": "identified", "collector_id": collector["id"], "arrival_seconds": round(arrival, 2)}]
                people.append({**collector, "status": "notified", "role": "AED collection", "arrival_seconds": round(arrival, 2),
                               "via_aed": {"latitude": device["latitude"], "longitude": device["longitude"]}})
            else:
                devices = [{**aeds[0], "status": "identified", "collector_id": None, "arrival_seconds": None}]
    if mode == "full":
        direct = next((r for r in responders if not collector or r["id"] != collector["id"]), None)
        if direct:
            people.append({**direct, "status": "notified", "role": "Direct response",
                           "arrival_seconds": round(departure + direct["estimated_travel_minutes"] * 60, 2)})
    for person in people:
        schedule.extend([
            scheduled("responder", person["id"], "accepted", now + 10, "Simulated responder accepted"),
            scheduled("responder", person["id"], "en_route", departure, f"Responder en route: {person['role']}"),
            scheduled("responder", person["id"], "arrived", person["arrival_seconds"], "Simulated responder arrived at scene"),
        ])
    for device in devices:
        if device["arrival_seconds"] is not None:
            # Retrieval precedes the return leg. Identification alone never implies access.
            return_seconds = walking_minutes(device["latitude"], device["longitude"], report.latitude, report.longitude) * 60
            schedule.extend([
                scheduled("aed", device["id"], "retrieved", max(departure, device["arrival_seconds"] - return_seconds), "Synthetic AED retrieved from facility"),
                scheduled("aed", device["id"], "delivered", device["arrival_seconds"], "Synthetic AED delivered to incident; use not inferred"),
            ])
    return devices, people, schedule


def transport_schedule(incident, ambulances, hospitals, now):
    schedule = []
    for ambulance in ambulances:
        ambulance["arrival_seconds"] = round(now + 15 + ambulance["response_time_mins"] * 60, 2)
        schedule.extend([
            scheduled("ambulance", ambulance["id"], "en_route", now + 15, "Synthetic ambulance en route"),
            scheduled("ambulance", ambulance["id"], "arrived", ambulance["arrival_seconds"], "Synthetic ambulance arrived at scene"),
        ])
    if not ambulances:
        return schedule
    on_scene = min(a["arrival_seconds"] for a in ambulances)
    transport = max(a["arrival_seconds"] for a in ambulances) + incident.options["scene_minutes"] * 60
    schedule.extend([
        scheduled("incident", None, "RESPONDERS_EN_ROUTE", now + 15, "Resources en route"),
        scheduled("incident", None, "ON_SCENE", on_scene, "Ambulance on scene"),
    ])
    if hospitals:
        schedule.append(scheduled("incident", None, "TRANSPORTING", transport, "Simulated transport started"))
        for hospital in hospitals:
            hospital["arrival_seconds"] = round(transport + hospital["transport_time_mins"] * 60, 2)
            schedule.append(scheduled("hospital", hospital["id"], "arrived", hospital["arrival_seconds"], "Simulated hospital arrival"))
        handover = max(h["arrival_seconds"] for h in hospitals)
        schedule.extend([
            scheduled("incident", None, "HOSPITAL_HANDOVER", handover, "Hospital handover"),
            scheduled("incident", None, "COMPLETED", handover + 60, "Simulation completed; reservations released"),
        ])
    return schedule


def projected_metrics(ambulances, hospitals, devices, people, now, scene_minutes):
    ambulance_time = min((now + 15 + a["response_time_mins"] * 60 for a in ambulances), default=None)
    transport = max((now + 15 + a["response_time_mins"] * 60 for a in ambulances), default=None)
    return {
        "ambulance_arrival_minutes": round(ambulance_time / 60, 2) if ambulance_time is not None else None,
        "responder_arrival_minutes": min((p["arrival_seconds"] / 60 for p in people), default=None),
        "aed_access_minutes": min((a["arrival_seconds"] / 60 for a in devices if a["arrival_seconds"] is not None), default=None),
        "hospital_arrival_minutes": round((transport + scene_minutes * 60 + max(h["transport_time_mins"] for h in hospitals) * 60) / 60, 2) if transport is not None and hospitals else None,
        "cpr_initiation_minutes": None, "aed_use_minutes": None,
    }


def dispatch(incident, all_incidents, options):
    if incident.status.value not in {"REPORTED", "ASSESSED"}:
        raise HTTPException(409, "Incident already dispatched or closed")
    active = commitments(all_incidents, incident.id)
    incident.options = options.model_dump()
    report = incident.report
    at = report.reported_at + timedelta(seconds=incident.elapsed_seconds)
    # Read-only candidates and MILP run concurrently; transaction reserves the result atomically.
    with ThreadPoolExecutor(max_workers=3) as executor:
        aed_future = executor.submit(nearby_aeds, report.latitude, report.longitude, at, options.search_radius_km, reserved_ids(active, "aeds"))
        responder_future = executor.submit(nearby_responders, report.latitude, report.longitude, options.search_radius_km, reserved_ids(active, "responders"))
        ambulance_future = executor.submit(allocate_transport, incident, active)
        secondary_warnings = []
        try:
            aeds = aed_future.result()
        except Exception:
            aeds = []
            secondary_warnings.append("AED discovery unavailable; ambulance allocation continues.")
        try:
            responders = responder_future.result()
        except Exception:
            responders = []
            secondary_warnings.append("Responder discovery unavailable; ambulance allocation continues.")
        ambulances, hospitals, audit = ambulance_future.result()
    incident.nearby_aeds, incident.nearby_responders = aeds, responders
    if incident.status.value == "REPORTED":
        transition(incident, "ASSESSED")
    incident.elapsed_seconds += 2
    now = incident.elapsed_seconds
    transition(incident, "DISPATCHED")
    devices, people, schedule = community_plan(incident, aeds, responders, options.mode, now)
    incident.assignments = {"ambulances": ambulances, "hospitals": hospitals, "aeds": devices, "responders": people,
                            "schedule": schedule + transport_schedule(incident, ambulances, hospitals, now)}
    for person in people:
        event(incident, "responder", "Simulated notification sent", person["id"], "notified")
    for device in devices:
        event(incident, "aed", "Eligible synthetic AED identified", device["id"], "identified")
    for ambulance in ambulances:
        event(incident, "ambulance", "Existing PuLP solver assigned synthetic fleet slot", ambulance["id"], "assigned")
    incident.analytics.update(audit)
    incident.comparison = []
    for mode, label in [("baseline", "A · Ambulance only"), ("aed", "B · Ambulance + AED runner"), ("full", "C · Full coordination")]:
        d, p, _ = community_plan(incident, aeds, responders, mode, now)
        incident.comparison.append({"mode": mode, "label": label,
                                    **projected_metrics(ambulances, hospitals, d, p, now, options.scene_minutes),
                                    "unserved_victims": audit["unserved_victims"], "sample_size": 1})
    baseline = incident.comparison[0]
    for row in incident.comparison:
        row["improvement_vs_baseline_pct"] = {
            key: round((baseline[key] - row[key]) / baseline[key] * 100, 2)
            if baseline[key] is not None and baseline[key] > 0 and row[key] is not None else None
            for key in ("ambulance_arrival_minutes", "responder_arrival_minutes", "aed_access_minutes", "hospital_arrival_minutes")
        }
    incident.warnings = secondary_warnings
    if options.mode != "baseline" and not aeds:
        incident.warnings.append("No eligible AED within the search radius; ambulance allocation continues.")
    if options.mode == "full" and not people:
        incident.warnings.append("No eligible community responder; ambulance allocation continues.")
    if devices and devices[0]["collector_id"] is None:
        incident.warnings.append("AED identified, but no eligible collector. No delivery time is predicted.")
    if audit["unserved_victims"]:
        incident.warnings.append(f"{audit['unserved_victims']} victim(s) unserved under current fleet and hospital constraints.")
    update_analytics(incident)


def reassign_responders(incident, all_incidents):
    now = incident.elapsed_seconds
    pending = [p for p in incident.assignments.get("responders", []) if p["status"] != "arrived"]
    if not pending:
        raise HTTPException(409, "No pending responder assignment can decline")
    declined = pending[0]
    incident.exclusions["responders"].append(declined["id"])
    event(incident, "responder", "Simulated responder declined; finding replacement", declined["id"], "declined")
    active = commitments(all_incidents, incident.id)
    retained = [p for p in incident.assignments["responders"] if p["id"] != declined["id"]]
    reserved = reserved_ids(active, "responders") | set(incident.exclusions["responders"]) | {p["id"] for p in retained}
    candidates = nearby_responders(incident.report.latitude, incident.report.longitude, incident.options["search_radius_km"], reserved)
    devices = incident.assignments["aeds"]
    collection = declined["role"] == "AED collection"
    affected_aeds = {a["id"] for a in devices if a.get("collector_id") == declined["id"]}
    if collection:
        # Re-offer this task while preserving unaffected responder journeys.
        devices, people, schedule = community_plan(incident, [a for a in devices if a["id"] in affected_aeds],
                                                   [r for r in candidates if r["training_status"] == "CPR_AED"], "full", now)
        people = [p for p in people if p["role"] == "AED collection"]
        schedule = [e for e in schedule if e["kind"] == "aed" or e["resource_id"] in {p["id"] for p in people}]
        incident.assignments["aeds"] = [a for a in incident.assignments["aeds"] if a["id"] not in affected_aeds] + devices
    else:
        _, people, schedule = community_plan(incident, [], candidates, "full", now)
    incident.assignments["responders"] = retained + people
    incident.assignments["schedule"] = [e for e in incident.assignments["schedule"]
                                         if e.get("resource_id") != declined["id"]
                                         and not (collection and e.get("resource_id") in affected_aeds)] + schedule
    for person in people:
        event(incident, "responder", "Simulated replacement notification sent", person["id"], "notified")
    if not people:
        incident.warnings.append("No replacement responder available; ambulance workflow continues.")


def replan_transport(incident, all_incidents, disruption):
    if incident.status.value in {"TRANSPORTING", "HOSPITAL_HANDOVER"}:
        raise HTTPException(409, "Committed patient journey is preserved once transport starts")
    group = "ambulances" if disruption == "ambulance_unavailable" else "hospitals"
    assigned = incident.assignments.get(group, [])
    if not assigned:
        raise HTTPException(409, f"No assigned {group} to change")
    incident.exclusions[group].append(assigned[0]["id"])
    ambulances, hospitals, audit = allocate_transport(incident, commitments(all_incidents, incident.id))
    now = incident.elapsed_seconds
    # Retain progress and timestamps of any vehicle whose assignment survives the replan.
    previous = {a["id"]: a for a in incident.assignments["ambulances"]}
    schedule = transport_schedule(incident, ambulances, hospitals, now)
    for index, ambulance in enumerate(ambulances):
        if ambulance["id"] in previous:
            ambulances[index] = previous[ambulance["id"]]
    schedule = [e for e in schedule if e["kind"] != "ambulance"]
    for ambulance in ambulances:
        if ambulance["id"] in previous:
            schedule.extend(e for e in incident.assignments["schedule"] if e["kind"] == "ambulance" and e["resource_id"] == ambulance["id"])
        else:
            schedule.extend([
                scheduled("ambulance", ambulance["id"], "en_route", now + 15, "Replacement ambulance en route"),
                scheduled("ambulance", ambulance["id"], "arrived", ambulance["arrival_seconds"], "Replacement ambulance arrived"),
            ])
    # Rebuild lifecycle times from retained/new arrivals, without moving the lifecycle backwards.
    schedule = [e for e in schedule if e["kind"] not in {"incident", "hospital"}]
    if ambulances:
        arrival = max(now, max(a["arrival_seconds"] for a in ambulances))
        if incident.status.value == "DISPATCHED":
            schedule.append(scheduled("incident", None, "RESPONDERS_EN_ROUTE", now + 1, "Resources en route"))
        if incident.status.value in {"DISPATCHED", "RESPONDERS_EN_ROUTE"}:
            schedule.append(scheduled("incident", None, "ON_SCENE", max(now + 2, min(a["arrival_seconds"] for a in ambulances)), "Ambulance on scene"))
        transport = max(now + 3, arrival + incident.options["scene_minutes"] * 60)
        if hospitals:
            schedule.append(scheduled("incident", None, "TRANSPORTING", transport, "Simulated transport started"))
            for hospital in hospitals:
                hospital["arrival_seconds"] = transport + hospital["transport_time_mins"] * 60
                schedule.append(scheduled("hospital", hospital["id"], "arrived", hospital["arrival_seconds"], "Simulated hospital arrival"))
            handover = max(h["arrival_seconds"] for h in hospitals)
            schedule.extend([scheduled("incident", None, "HOSPITAL_HANDOVER", handover, "Hospital handover"),
                             scheduled("incident", None, "COMPLETED", handover + 60, "Simulation completed; reservations released")])
    incident.assignments["ambulances"], incident.assignments["hospitals"] = ambulances, hospitals
    incident.assignments["schedule"] = [e for e in incident.assignments["schedule"] if e["kind"] in {"responder", "aed"}] + schedule
    incident.analytics.update(audit)
    incident.warnings.append("A/B/C projections retain the original dispatch snapshot; actual timeline includes disruptions.")
    event(incident, "disruption", f"{disruption.replace('_', ' ').title()}: existing PuLP solver replanned transport", assigned[0]["id"], "replanned")
