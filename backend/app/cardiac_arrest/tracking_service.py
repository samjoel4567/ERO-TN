from datetime import timedelta

from fastapi import HTTPException

TERMINAL = {"COMPLETED", "CANCELLED"}
TRANSITIONS = {
    "REPORTED": {"ASSESSED", "CANCELLED"},
    "ASSESSED": {"DISPATCHED", "CANCELLED"},
    "DISPATCHED": {"RESPONDERS_EN_ROUTE", "CANCELLED"},
    "RESPONDERS_EN_ROUTE": {"ON_SCENE", "CANCELLED"},
    "ON_SCENE": {"TRANSPORTING", "CANCELLED"},
    "TRANSPORTING": {"HOSPITAL_HANDOVER"},
    "HOSPITAL_HANDOVER": {"COMPLETED"},
}


def event(incident, kind, message, resource_id=None, status=None, at=None):
    seconds = incident.elapsed_seconds if at is None else at
    item = {"id": f"{incident.id}-E{len(incident.timeline) + 1}", "at_seconds": round(seconds, 2),
            "timestamp": (incident.report.reported_at + timedelta(seconds=seconds)).isoformat(),
            "kind": kind, "message": message, "resource_id": resource_id, "status": status,
            "simulated": True}
    incident.timeline.append(item)
    return item


def transition(incident, status, at=None):
    current = incident.status.value
    if current == status:
        return
    if status not in TRANSITIONS.get(current, set()):
        raise HTTPException(409, f"Cannot change {current} to {status}")
    from .schemas import IncidentStatus
    incident.status = IncidentStatus(status)
    event(incident, "incident", status.replace("_", " ").title(), status=status, at=at)


def advance(incident, seconds):
    if incident.status.value in TERMINAL:
        raise HTTPException(409, "This simulation is already closed")
    if not incident.assignments:
        raise HTTPException(409, "Dispatch resources before advancing the simulation")
    target = incident.elapsed_seconds + seconds
    pending = sorted(incident.assignments.get("schedule", []), key=lambda e: e["at_seconds"])
    remaining = []
    for item in pending:
        if incident.status.value in TERMINAL:
            break
        if item["at_seconds"] > target:
            remaining.append(item)
            continue
        if item["kind"] == "incident":
            transition(incident, item["status"], at=item["at_seconds"])
        else:
            for group in ("ambulances", "responders", "aeds", "hospitals"):
                for resource in incident.assignments.get(group, []):
                    if resource["id"] == item["resource_id"]:
                        resource["status"] = item["status"]
            event(incident, item["kind"], item["message"], item.get("resource_id"), item["status"], item["at_seconds"])
    incident.assignments["schedule"] = [] if incident.status.value in TERMINAL else remaining
    incident.elapsed_seconds = min(target, max((e["at_seconds"] for e in incident.timeline), default=target)) if incident.status.value in TERMINAL else target


def actual_metric(incident, kind, statuses):
    matches = [e["at_seconds"] / 60 for e in incident.timeline if e["kind"] == kind and e.get("status") in statuses]
    return round(min(matches), 2) if matches else None


def update_analytics(incident):
    incident.analytics.update({
        "dispatch_minutes": actual_metric(incident, "incident", {"DISPATCHED"}),
        "ambulance_arrival_minutes": actual_metric(incident, "ambulance", {"arrived"}),
        "responder_arrival_minutes": actual_metric(incident, "responder", {"arrived"}),
        "aed_access_minutes": actual_metric(incident, "aed", {"delivered"}),
        "cpr_initiation_minutes": actual_metric(incident, "intervention", {"cpr_started"}),
        "aed_use_minutes": actual_metric(incident, "intervention", {"aed_use"}),
        "hospital_arrival_minutes": actual_metric(incident, "hospital", {"arrived"}),
    })
