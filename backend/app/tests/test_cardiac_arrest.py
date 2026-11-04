"""End-to-end cardiac simulation, persistence, contention and degradation checks."""
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from unittest.mock import patch
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.main import app
from app.cardiac_arrest import service
from app.cardiac_arrest.aed_service import accessible_at, load_records, nearby_aeds
from app.cardiac_arrest.assessment import rule_extract
from app.cardiac_arrest.models import IncidentStore


class CardiacArrestTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.store = IncidentStore(os.path.join(self.directory.name, "incidents.sqlite3"))
        self.store_patch = patch.object(service, "store", self.store)
        self.store_patch.start()
        self.env_patch = patch.dict(os.environ, {"GEMINI_API_KEY": "", "GEMINI_MODEL": ""})
        self.env_patch.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.store_patch.stop()
        self.env_patch.stop()
        self.directory.cleanup()

    def report(self, **overrides):
        payload = {"latitude": 12.9249, "longitude": 80.119, "reported_at": "2026-11-03T12:00:00+05:30",
                   "description": "One person is unresponsive and gasping."}
        payload.update(overrides)
        result = self.client.post("/api/cardiac-arrest/report", json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        return result.json()

    def dispatch(self, incident, **options):
        response = self.client.post(f"/api/cardiac-arrest/{incident['id']}/dispatch", json={"mode": "full", **options})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def action(self, incident, action, seconds=30, expected=200):
        response = self.client.post(f"/api/cardiac-arrest/{incident['id']}/simulate", json={"action": action, "seconds": seconds})
        self.assertEqual(response.status_code, expected, response.text)
        return response.json()

    def test_report_unknowns_persists_across_store_instances(self):
        incident = self.report()
        self.assertIsNone(incident["report"]["responsive"])
        self.assertEqual(incident["report"]["breathing_status"], "unknown")
        self.assertEqual(incident["assessment"]["extracted"]["responsive"], False)
        self.assertFalse(incident["assessment"]["reviewed"])
        with IncidentStore(self.store.path).transaction() as repo:
            self.assertEqual(repo.get(incident["id"]).report.description, incident["report"]["description"])
        self.assertEqual(len(self.client.get("/api/cardiac-arrest").json()), 1)

    def test_invalid_report_does_not_persist(self):
        for change in ({"latitude": 91}, {"longitude": 181}, {"victim_count": 0},
                       {"breathing_status": "diagnosed"}, {"reported_at": "2026-11-03T12:00:00"}):
            response = self.client.post("/api/cardiac-arrest/report", json={"latitude": 12.9, "longitude": 80.1, **change})
            self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(self.client.get("/api/cardiac-arrest").json(), [])

    def test_report_outside_solver_region_remains_saved(self):
        incident = self.report(latitude=51, longitude=0)
        response = self.client.post(f"/api/cardiac-arrest/{incident['id']}/dispatch", json={})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get(f"/api/cardiac-arrest/{incident['id']}").json()["status"], "REPORTED")

    def test_review_does_not_require_known_values(self):
        incident = self.report(responsive=True, breathing_status="normal")
        self.assertTrue(incident["report"]["responsive"])
        response = self.client.post(f"/api/cardiac-arrest/{incident['id']}/assessment", json={})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["assessment"]["reviewed"])
        self.assertEqual(self.dispatch(response.json())["status"], "DISPATCHED")

    def test_access_filter_operational_availability_and_hours(self):
        day = datetime.fromisoformat("2026-11-03T12:00:00+05:30")
        night = datetime.fromisoformat("2026-11-03T23:00:00+05:30")
        records = load_records("aeds.json")
        by_day = {a["id"] for a in nearby_aeds(12.9249, 80.119, day, radius_km=5, records=records)}
        by_night = {a["id"] for a in nearby_aeds(12.9249, 80.119, night, radius_km=5, records=records)}
        self.assertEqual(by_day, {"SIM-AED-01", "SIM-AED-02"})
        self.assertEqual(by_night, {"SIM-AED-01"})
        self.assertEqual(nearby_aeds(12.9249, 80.119, day, radius_km=5, reserved=by_day, records=records), [])
        self.assertTrue(all(a["data_origin"] == "synthetic_simulation" for a in load_records("aeds.json")))

    def test_overnight_aed_access_window(self):
        record = {"access_type": "time_limited", "opening_hours": {"opens": "22:00", "closes": "06:00"}}
        self.assertTrue(accessible_at(record, datetime.fromisoformat("2026-11-03T23:00:00+05:30")))
        self.assertFalse(accessible_at(record, datetime.fromisoformat("2026-11-03T12:00:00+05:30")))

    def test_full_workflow_explicit_interventions_and_completion(self):
        incident = self.dispatch(self.report())
        self.assertEqual(incident["analytics"]["unserved_victims"], 0)
        self.assertTrue(incident["assignments"]["ambulances"])
        self.assertTrue(incident["assignments"]["aeds"])
        self.assertTrue(incident["assignments"]["responders"])
        self.assertIsNone(incident["analytics"]["cpr_initiation_minutes"])
        self.action(incident, "aed_use", expected=409)
        incident = self.action(incident, "advance", seconds=300)
        self.assertIsNotNone(incident["analytics"]["aed_access_minutes"])
        self.assertIsNone(incident["analytics"]["aed_use_minutes"])
        incident = self.action(incident, "cpr_started")
        self.assertIsNotNone(incident["analytics"]["cpr_initiation_minutes"])
        self.action(incident, "cpr_started", expected=409)
        incident = self.action(incident, "aed_use")
        self.assertIsNotNone(incident["analytics"]["aed_use_minutes"])
        incident = self.action(incident, "advance", seconds=3600)
        self.assertEqual(incident["status"], "COMPLETED")
        states = [e["status"] for e in incident["timeline"] if e["kind"] == "incident"]
        self.assertEqual(states, ["REPORTED", "ASSESSED", "DISPATCHED", "RESPONDERS_EN_ROUTE", "ON_SCENE", "TRANSPORTING", "HOSPITAL_HANDOVER", "COMPLETED"])
        self.assertIsNotNone(incident["analytics"]["hospital_arrival_minutes"])

    def test_sparse_area_continues_without_aed_or_responders(self):
        with patch("app.cardiac_arrest.dispatch_service.nearby_aeds", return_value=[]):
            incident = self.dispatch(self.report(latitude=12.9715, longitude=79.1385))
        self.assertEqual(incident["assignments"]["aeds"], [])
        self.assertEqual(incident["assignments"]["responders"], [])
        self.assertTrue(incident["assignments"]["ambulances"])
        self.assertTrue(incident["warnings"])

    def test_secondary_service_failures_do_not_block_solver(self):
        with patch("app.cardiac_arrest.dispatch_service.nearby_aeds", side_effect=RuntimeError("offline")), \
             patch("app.cardiac_arrest.dispatch_service.nearby_responders", side_effect=RuntimeError("offline")):
            incident = self.dispatch(self.report())
        self.assertTrue(incident["assignments"]["ambulances"])
        self.assertIn("AED discovery unavailable", " ".join(incident["warnings"]))

    def test_gemini_failure_and_invalid_output_fall_back(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-only", "GEMINI_MODEL": "test-model"}), \
             patch("app.cardiac_arrest.assessment.requests.post") as request:
            request.return_value.json.return_value = {"candidates": [{"content": {"parts": [{"text": '{"responsive":"false","breathing_status":"unknown"}'}]}}]}
            incident = self.report()
        self.assertEqual(incident["assessment"]["source"], "deterministic_rules")
        self.assertIn("failed", incident["assessment"]["fallback_reason"])
        self.assertEqual(incident["status"], "REPORTED")

    def test_ambiguous_text_stays_unknown(self):
        self.assertIsNone(rule_extract("He is not unconscious").responsive)
        self.assertEqual(rule_extract("not breathing but breathing normally").breathing_status, "unknown")
        self.assertIsNone(rule_extract("unresponsive, now awake").responsive)

    def test_responder_decline_replaces_without_reusing_declined_resource(self):
        incident = self.dispatch(self.report())
        declined = incident["assignments"]["responders"][0]["id"]
        next_state = self.action(incident, "responder_decline")
        self.assertNotIn(declined, [r["id"] for r in next_state["assignments"]["responders"]])
        self.assertTrue(any(e["status"] == "declined" for e in next_state["timeline"]))
        self.assertTrue(next_state["assignments"]["ambulances"])

    def test_responder_decline_preserves_other_journey_and_timestamps(self):
        incident = self.dispatch(self.report())
        incident = self.action(incident, "advance", seconds=30)
        unaffected = incident["assignments"]["responders"][1]
        replacement = self.action(incident, "responder_decline")
        retained = next(p for p in replacement["assignments"]["responders"] if p["id"] == unaffected["id"])
        self.assertEqual(retained, unaffected)

    def test_no_hospital_capacity_reports_unserved_without_fabricated_dispatch(self):
        with patch("app.cardiac_arrest.dispatch_service.cardiac_hospitals", return_value=[]):
            incident = self.dispatch(self.report())
        self.assertEqual(incident["analytics"]["unserved_victims"], 1)
        self.assertEqual(incident["assignments"]["hospitals"], [])
        self.assertEqual(incident["assignments"]["ambulances"], [])
        self.assertTrue(incident["assignments"]["responders"])

    def test_solver_error_rolls_back_dispatch_and_reservations(self):
        incident = self.report()
        with patch("app.cardiac_arrest.dispatch_service.solve_emergency_dispatch_optimization",
                   return_value=SimpleNamespace(status="ERROR")):
            result = self.client.post(f"/api/cardiac-arrest/{incident['id']}/dispatch", json={})
        self.assertEqual(result.status_code, 503)
        stored = self.client.get(f"/api/cardiac-arrest/{incident['id']}").json()
        self.assertEqual(stored["status"], "REPORTED")
        self.assertFalse(stored["assignments"])
        self.assertTrue(self.dispatch(stored)["assignments"]["ambulances"])

    def test_aed_without_qualified_collector_is_identified_without_delivery(self):
        from app.cardiac_arrest.responder_service import nearby_responders
        responders = [r for r in nearby_responders(12.9249, 80.119) if r["training_status"] == "CPR"]
        with patch("app.cardiac_arrest.dispatch_service.nearby_responders", return_value=responders):
            incident = self.dispatch(self.report())
        self.assertEqual(incident["assignments"]["aeds"][0]["status"], "identified")
        self.assertIsNone(incident["assignments"]["aeds"][0]["arrival_seconds"])
        self.assertFalse(any(e["kind"] == "aed" for e in incident["assignments"]["schedule"]))
        self.assertTrue(incident["assignments"]["ambulances"])

    def test_comparison_percentages_only_exist_for_modelled_baseline_milestones(self):
        incident = self.dispatch(self.report())
        for row in incident["comparison"]:
            percent = row["improvement_vs_baseline_pct"]
            self.assertEqual(percent["ambulance_arrival_minutes"], 0)
            self.assertEqual(percent["hospital_arrival_minutes"], 0)
            self.assertIsNone(percent["responder_arrival_minutes"])
            self.assertIsNone(percent["aed_access_minutes"])

    def test_completion_drops_late_community_events(self):
        incident = self.dispatch(self.report())
        with self.store.transaction() as repo:
            saved = repo.get(incident["id"])
            for e in saved.assignments["schedule"]:
                if e["kind"] == "responder" and e["status"] == "arrived":
                    e["at_seconds"] = 3500
            repo.save(saved)
        finished = self.action(incident, "advance", seconds=3600)
        self.assertEqual(finished["status"], "COMPLETED")
        self.assertFalse(any(e["at_seconds"] > finished["elapsed_seconds"] for e in finished["timeline"]))
        self.assertEqual(finished["assignments"]["schedule"], [])

    def test_duplicate_dispatch_is_rejected(self):
        incident = self.dispatch(self.report())
        self.assertEqual(self.client.post(f"/api/cardiac-arrest/{incident['id']}/dispatch", json={}).status_code, 409)

    def test_parallel_incidents_never_share_reserved_resources(self):
        first, second = self.report(), self.report()
        with ThreadPoolExecutor(max_workers=2) as executor:
            plans = list(executor.map(self.dispatch, [first, second]))
        for group in ("ambulances", "responders", "aeds"):
            ids = [{r["id"] for r in p["assignments"][group]} for p in plans]
            self.assertFalse(ids[0] & ids[1], group)
        # Reservations survive a new store instance / backend restart.
        with patch.object(service, "store", IncidentStore(self.store.path)):
            third = self.dispatch(self.report())
        reserved = {r["id"] for p in plans for r in p["assignments"]["ambulances"]}
        self.assertFalse(reserved & {r["id"] for r in third["assignments"]["ambulances"]})

    def test_cancel_releases_resources_and_rejects_invalid_transition(self):
        incident = self.dispatch(self.report())
        url = f"/api/cardiac-arrest/{incident['id']}/status"
        self.assertEqual(self.client.patch(url, json={"status": "COMPLETED"}).status_code, 409)
        response = self.client.patch(url, json={"status": "CANCELLED"})
        self.assertEqual(response.status_code, 200)
        replacement = self.dispatch(self.report())
        self.assertEqual(incident["assignments"]["ambulances"][0]["id"], replacement["assignments"]["ambulances"][0]["id"])

    def test_road_closure_delays_future_milestones_preserving_original_comparison(self):
        incident = self.dispatch(self.report())
        updated = self.action(incident, "road_closure")
        self.assertGreater(updated["assignments"]["ambulances"][0]["arrival_seconds"], incident["assignments"]["ambulances"][0]["arrival_seconds"])
        self.assertEqual(updated["comparison"], incident["comparison"])
        updated = self.action(updated, "advance", seconds=3600)
        if updated["status"] != "COMPLETED":
            updated = self.action(updated, "advance", seconds=3600)
        self.assertEqual(updated["status"], "COMPLETED")

    def test_ambulance_unavailable_replans_existing_solver(self):
        incident = self.dispatch(self.report())
        failed = incident["assignments"]["ambulances"][0]["id"]
        updated = self.action(incident, "ambulance_unavailable")
        self.assertNotIn(failed, [a["id"] for a in updated["assignments"]["ambulances"]])
        self.assertTrue(updated["assignments"]["ambulances"])
        updated = self.action(updated, "advance", seconds=3600)
        if updated["status"] != "COMPLETED":
            updated = self.action(updated, "advance", seconds=3600)
        self.assertEqual(updated["status"], "COMPLETED")

    def test_hospital_full_changes_destination_preserves_vehicle_progress(self):
        incident = self.dispatch(self.report())
        incident = self.action(incident, "advance", seconds=30)
        destination = incident["assignments"]["hospitals"][0]["id"]
        vehicle = incident["assignments"]["ambulances"][0]
        updated = self.action(incident, "hospital_full")
        self.assertNotIn(destination, [h["id"] for h in updated["assignments"]["hospitals"]])
        self.assertEqual(updated["assignments"]["ambulances"][0]["arrival_seconds"], vehicle["arrival_seconds"])
        self.assertEqual(self.action(updated, "advance", seconds=3600)["status"], "COMPLETED")

    def test_journey_is_preserved_after_transport_starts(self):
        incident = self.dispatch(self.report())
        incident = self.action(incident, "advance", seconds=400)
        self.assertEqual(incident["status"], "TRANSPORTING")
        self.action(incident, "hospital_full", expected=409)
        self.action(incident, "ambulance_unavailable", expected=409)

    def test_baseline_and_aed_mode_do_not_infer_community_response(self):
        baseline = self.dispatch(self.report(), mode="baseline")
        self.assertFalse(baseline["assignments"]["responders"])
        self.assertFalse(baseline["assignments"]["aeds"])
        self.client.patch(f"/api/cardiac-arrest/{baseline['id']}/status", json={"status": "CANCELLED"})
        aed_mode = self.dispatch(self.report(), mode="aed")
        self.assertFalse(aed_mode["assignments"]["responders"])
        self.assertEqual(aed_mode["assignments"]["aeds"][0]["collector_id"], "SIM-RETRIEVAL-RUNNER")
        ambulance_times = {r["ambulance_arrival_minutes"] for r in aed_mode["comparison"]}
        self.assertEqual(len(ambulance_times), 1)
        self.assertTrue(all(r["cpr_initiation_minutes"] is None for r in aed_mode["comparison"]))

    def test_api_resources_timeline_and_nearby_contracts(self):
        incident = self.dispatch(self.report())
        root = f"/api/cardiac-arrest/{incident['id']}"
        self.assertEqual(self.client.get(root).status_code, 200)
        self.assertNotIn("schedule", self.client.get(root + "/resources").json()["assignments"])
        self.assertEqual(self.client.get(root + "/timeline").json(), incident["timeline"])
        for path in ("/api/aed/nearby", "/api/responders/nearby"):
            response = self.client.get(path, params={"latitude": 12.9249, "longitude": 80.119})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["data_origin"], "synthetic_simulation")
        self.assertEqual(self.client.get("/api/cardiac-arrest/missing").status_code, 404)


if __name__ == "__main__":
    unittest.main()
