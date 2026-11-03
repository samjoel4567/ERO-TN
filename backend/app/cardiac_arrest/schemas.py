from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class IncidentStatus(str, Enum):
    REPORTED = "REPORTED"
    ASSESSED = "ASSESSED"
    DISPATCHED = "DISPATCHED"
    RESPONDERS_EN_ROUTE = "RESPONDERS_EN_ROUTE"
    ON_SCENE = "ON_SCENE"
    TRANSPORTING = "TRANSPORTING"
    HOSPITAL_HANDOVER = "HOSPITAL_HANDOVER"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CardiacArrestReport(StrictRequest):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_name: str = Field(default="Synthetic cardiac arrest scenario", max_length=160)
    responsive: bool | None = None
    breathing_status: Literal["normal", "abnormal", "not_breathing", "unknown"] = "unknown"
    victim_count: int = Field(default=1, ge=1, le=20)
    description: str = Field(default="", max_length=4000)
    reported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("reported_at")
    @classmethod
    def require_timezone(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("reported_at must include a timezone")
        return value


class AssessmentUpdate(StrictRequest):
    responsive: bool | None = None
    breathing_status: Literal["normal", "abnormal", "not_breathing", "unknown"] = "unknown"
    victim_count: int = Field(default=1, ge=1, le=20)


class DispatchOptions(StrictRequest):
    mode: Literal["baseline", "aed", "full"] = "full"
    search_radius_km: float = Field(default=5, gt=0, le=25)
    scene_minutes: float = Field(default=4, ge=0, le=30)


class StatusUpdate(StrictRequest):
    status: IncidentStatus


class SimulationAction(StrictRequest):
    action: Literal["advance", "responder_decline", "road_closure", "ambulance_unavailable",
                    "hospital_full", "cpr_started", "aed_use"]
    seconds: int = Field(default=30, ge=1, le=3600)


class CardiacIncident(BaseModel):
    id: str
    type: Literal["CARDIAC_ARREST"] = "CARDIAC_ARREST"
    status: IncidentStatus
    data_origin: Literal["synthetic_simulation"] = "synthetic_simulation"
    report: CardiacArrestReport
    assessment: dict = Field(default_factory=dict)
    elapsed_seconds: float = 0
    timeline: list[dict] = Field(default_factory=list)
    assignments: dict = Field(default_factory=dict)
    nearby_aeds: list[dict] = Field(default_factory=list)
    nearby_responders: list[dict] = Field(default_factory=list)
    options: dict = Field(default_factory=dict)
    exclusions: dict = Field(default_factory=lambda: {"ambulances": [], "hospitals": [], "responders": []})
    analytics: dict = Field(default_factory=dict)
    comparison: list[dict] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
