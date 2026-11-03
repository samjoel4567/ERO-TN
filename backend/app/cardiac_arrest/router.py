from datetime import datetime, timezone

from fastapi import APIRouter, Query

from . import service
from .aed_service import nearby_aeds
from .dispatch_service import commitments, dispatch, reserved_ids
from .responder_service import nearby_responders
from .schemas import (AssessmentUpdate, CardiacArrestReport, CardiacIncident, DispatchOptions,
                      SimulationAction, StatusUpdate)

router = APIRouter(prefix="/api", tags=["Cardiac arrest simulation"])


@router.post("/cardiac-arrest/report", response_model=CardiacIncident, status_code=201)
def report_incident(payload: CardiacArrestReport):
    return service.create_incident(payload)


@router.get("/cardiac-arrest", response_model=list[CardiacIncident])
def list_incidents():
    with service.store.transaction() as repo:
        return repo.all()


@router.get("/cardiac-arrest/{incident_id}", response_model=CardiacIncident)
def get_incident(incident_id: str):
    with service.store.transaction() as repo:
        return service.require_incident(repo, incident_id)


@router.post("/cardiac-arrest/{incident_id}/assessment", response_model=CardiacIncident)
def assess_incident(incident_id: str, payload: AssessmentUpdate):
    with service.store.transaction() as repo:
        incident = service.require_incident(repo, incident_id)
        service.assess_incident(incident, payload)
        repo.save(incident)
        return incident


@router.post("/cardiac-arrest/{incident_id}/dispatch", response_model=CardiacIncident)
def dispatch_incident(incident_id: str, payload: DispatchOptions):
    with service.store.transaction() as repo:
        incident = service.require_incident(repo, incident_id)
        dispatch(incident, repo.all(), payload)
        repo.save(incident)
        return incident


@router.get("/cardiac-arrest/{incident_id}/resources")
def get_resources(incident_id: str):
    with service.store.transaction() as repo:
        incident = service.require_incident(repo, incident_id)
        return {"incident_id": incident.id, "data_origin": incident.data_origin,
                "assignments": {k: v for k, v in incident.assignments.items() if k != "schedule"},
                "nearby_aeds": incident.nearby_aeds, "nearby_responders": incident.nearby_responders}


@router.get("/cardiac-arrest/{incident_id}/timeline")
def get_timeline(incident_id: str):
    with service.store.transaction() as repo:
        return service.require_incident(repo, incident_id).timeline


@router.patch("/cardiac-arrest/{incident_id}/status", response_model=CardiacIncident)
def update_status(incident_id: str, payload: StatusUpdate):
    with service.store.transaction() as repo:
        incident = service.require_incident(repo, incident_id)
        service.change_status(incident, payload.status)
        repo.save(incident)
        return incident


@router.post("/cardiac-arrest/{incident_id}/simulate", response_model=CardiacIncident)
def simulate(incident_id: str, payload: SimulationAction):
    with service.store.transaction() as repo:
        incident = service.require_incident(repo, incident_id)
        service.apply_action(incident, payload, repo.all())
        repo.save(incident)
        return incident


@router.get("/aed/nearby")
def find_aeds(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180),
              radius_km: float = Query(5, gt=0, le=25), at: datetime | None = None):
    with service.store.transaction() as repo:
        active = commitments(repo.all())
        return {"data_origin": "synthetic_simulation", "resources": nearby_aeds(latitude, longitude,
                at if at and at.tzinfo else datetime.now(timezone.utc), radius_km, reserved_ids(active, "aeds"))}


@router.get("/responders/nearby")
def find_responders(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180),
                    radius_km: float = Query(5, gt=0, le=25)):
    with service.store.transaction() as repo:
        return {"data_origin": "synthetic_simulation", "resources": nearby_responders(latitude, longitude,
                radius_km, reserved_ids(commitments(repo.all()), "responders"))}
