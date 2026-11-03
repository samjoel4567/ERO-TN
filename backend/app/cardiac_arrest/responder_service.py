from ..services.data_loader import calculate_haversine_km
from .aed_service import ROUTE_SOURCE, load_records, walking_minutes


def nearby_responders(latitude, longitude, radius_km=5, reserved=None, records=None):
    candidates = []
    for record in records if records is not None else load_records("responders.json"):
        if (record["id"] in (reserved or set()) or record["availability_status"] != "available"
                or record["training_status"] not in {"CPR", "CPR_AED"}):
            continue
        distance = calculate_haversine_km(latitude, longitude, record["latitude"], record["longitude"])
        if distance <= radius_km:
            candidates.append({**record, "distance_km": round(distance, 3),
                               "estimated_travel_minutes": walking_minutes(record["latitude"], record["longitude"], latitude, longitude),
                               "route_source": ROUTE_SOURCE})
    return sorted(candidates, key=lambda r: (r["estimated_travel_minutes"], r["id"]))
