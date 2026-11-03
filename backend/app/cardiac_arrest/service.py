from uuid import uuid4

from fastapi import HTTPException

from .assessment import assess_report
from .dispatch_service import dispatch, reassign_responders, replan_transport
from .models import IncidentStore
from .schemas import CardiacIncident, IncidentStatus
from .tracking_service import TERMINAL, advance, event, transition, update_analytics

store = IncidentStore()


def require_incident(repo, incident_id):
    incident = repo.get(incident_id)
    if incident is None:
        raise HTTPException(404, "Cardiac simulation incident not found")
    return incident


def create_incident(report):
    incident = CardiacIncident(id=f"CA-{uuid4().hex[:12].upper()}", status=IncidentStatus.REPORTED,
                               report=report, assessment=assess_report(report))
    event(incident, "incident", "Suspected cardiac arrest simulation reported", status="REPORTED")
    with store.transaction() as repo:
        repo.save(incident)
    return incident


def assess_incident(incident, update):
    if incident.status.value not in {"REPORTED", "ASSESSED"}:
        raise HTTPException(409, "Assessment can be edited before dispatch")
    incident.report.responsive = update.responsive
    incident.report.breathing_status = update.breathing_status
    incident.report.victim_count = update.victim_count
    incident.assessment["reported"] = update.model_dump()
    incident.assessment["reviewed"] = True
    if incident.status.value == "REPORTED":
        transition(incident, "ASSESSED")
    event(incident, "assessment", "Dispatcher reviewed reported information", status="reviewed")


def apply_action(incident, action, all_incidents):
    if incident.status.value in TERMINAL:
        raise HTTPException(409, "This simulation is already closed")
    if not incident.assignments:
        raise HTTPException(409, "Dispatch resources before running simulation actions")
    if action.action == "advance":
        advance(incident, action.seconds)
    elif action.action == "responder_decline":
        reassign_responders(incident, all_incidents)
    elif action.action in {"ambulance_unavailable", "hospital_full"}:
        replan_transport(incident, all_incidents, action.action)
    elif action.action == "road_closure":
        affected = False
        now = incident.elapsed_seconds
        for item in incident.assignments.get("schedule", []):
            if item["at_seconds"] > now and (item["kind"] in {"hospital", "incident"} or
                                             item["status"] in {"arrived", "delivered", "retrieved"}):
                item["at_seconds"] = round(now + (item["at_seconds"] - now) * 1.5, 2)
                affected = True
        if not affected:
            raise HTTPException(409, "No remaining journey to delay")
        for group in ("ambulances", "responders", "aeds", "hospitals"):
            for resource in incident.assignments.get(group, []):
                at = resource.get("arrival_seconds")
                if at is not None and at > now:
                    resource["arrival_seconds"] = round(now + (at - now) * 1.5, 2)
        incident.warnings.append("Road closure: 50% delay applied to remaining simulated travel and dependent milestones. Original comparison is unchanged.")
        event(incident, "disruption", "Road closure injected: remaining route estimates delayed by 50%", status="delayed")
    else:
        if incident.status.value in {"TRANSPORTING", "HOSPITAL_HANDOVER"}:
            raise HTTPException(409, "Scene intervention controls are available before transport")
        if any(e.get("status") == action.action for e in incident.timeline):
            raise HTTPException(409, "This intervention is already recorded")
        if action.action == "cpr_started":
            arrived = any(r["status"] == "arrived" for group in ("responders", "ambulances")
                          for r in incident.assignments.get(group, []))
            if not arrived:
                raise HTTPException(409, "A trained simulated responder or ambulance must arrive first")
            event(incident, "intervention", "CPR initiation explicitly simulated; no clinical outcome inferred", status="cpr_started")
        elif action.action == "aed_use":
            if not any(a["status"] == "delivered" for a in incident.assignments.get("aeds", [])):
                raise HTTPException(409, "A synthetic AED must be delivered before recording simulated use")
            event(incident, "intervention", "AED use explicitly simulated; shock delivery and outcome are not modelled", status="aed_use")
    update_analytics(incident)


def change_status(incident, status):
    value = status.value
    if value not in {"ASSESSED", "CANCELLED", "COMPLETED"}:
        raise HTTPException(409, "Use simulation time controls to advance resource-dependent lifecycle states")
    transition(incident, value)
    if value in TERMINAL:
        incident.assignments["schedule"] = []
        event(incident, "resources", "All synthetic resource reservations released", status="released")
    update_analytics(incident)
