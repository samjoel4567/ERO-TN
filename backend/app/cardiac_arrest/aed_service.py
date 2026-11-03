import json
from datetime import timedelta, timezone
from pathlib import Path

from ..services.data_loader import calculate_haversine_km, estimate_road_distance_km

IST = timezone(timedelta(hours=5, minutes=30))
ROUTE_SOURCE = "Estimated: 1.35× straight-line distance; walking at 5 km/h"


def load_records(filename):
    return json.loads((Path(__file__).parent / "data" / filename).read_text(encoding="utf-8"))


def walking_minutes(start_lat, start_lng, end_lat, end_lng):
    return round(estimate_road_distance_km(start_lat, start_lng, end_lat, end_lng) / 5 * 60, 2)


def accessible_at(aed, at):
    if aed["access_type"] == "restricted":
        return False
    if aed["access_type"] == "public":
        return True
    hours = aed.get("opening_hours")
    if not hours:
        return False
    current = at.astimezone(IST).strftime("%H:%M")
    opens, closes = hours["opens"], hours["closes"]
    return opens <= current < closes if opens < closes else current >= opens or current < closes


def nearby_aeds(latitude, longitude, at, radius_km=5, reserved=None, records=None):
    candidates = []
    for record in records if records is not None else load_records("aeds.json"):
        if (record["id"] in (reserved or set()) or record["operational_status"] != "operational"
                or record["availability_status"] != "available" or not accessible_at(record, at)):
            continue
        distance = calculate_haversine_km(latitude, longitude, record["latitude"], record["longitude"])
        if distance > radius_km:
            continue
        candidates.append({**record, "distance_km": round(distance, 3),
                           "estimated_access_minutes": round(2 * walking_minutes(latitude, longitude, record["latitude"], record["longitude"]) + record["access_delay_minutes"], 2),
                           "route_source": ROUTE_SOURCE})
    return sorted(candidates, key=lambda a: (a["estimated_access_minutes"], a["id"]))
