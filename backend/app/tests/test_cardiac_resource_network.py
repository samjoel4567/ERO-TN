"""Hospital-wide mock inventory and its use by the real cardiac dispatch path."""
from datetime import datetime
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.main import app
from app.cardiac_arrest import service
from app.cardiac_arrest.aed_service import all_aeds, nearby_aeds
from app.cardiac_arrest.models import IncidentStore
from app.cardiac_arrest.resource_catalog import cardiac_bases, cardiac_hospitals, fleet_units, hospital_aeds
from app.services.data_loader import get_default_bases, load_verified_hospitals


class HospitalResourceNetworkTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store_patch = patch.object(service, 'store', IncidentStore(Path(self.temp.name) / 'network.sqlite3'))
        self.store_patch.start()
        self.client = TestClient(app)
        self.hospitals = load_verified_hospitals()

    def tearDown(self):
        self.client.close()
        self.store_patch.stop()
        self.temp.cleanup()

    def make_incident(self, **overrides):
        # A mapped hospital outside the small original volunteer demonstration pool.
        h = self.hospitals[0]
        response = self.client.post('/api/cardiac-arrest/report', json={
            'latitude': h['lat'], 'longitude': h['lng'], 'location_name': 'Mock hospital network test',
            'reported_at': '2026-11-03T12:00:00+05:30', **overrides,
        })
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def dispatch(self, incident):
        response = self.client.post(f"/api/cardiac-arrest/{incident['id']}/dispatch", json={})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_every_mapped_hospital_has_a_unique_mock_aed_at_its_coordinates(self):
        aeds = hospital_aeds()
        self.assertEqual(len(aeds), len(self.hospitals))
        self.assertEqual(len({a['id'] for a in all_aeds()}), len(all_aeds()))
        by_hospital = {a['hospital_id']: a for a in aeds}
        for h in self.hospitals:
            aed = by_hospital[str(h['id'])]
            self.assertEqual((aed['latitude'], aed['longitude']), (h['lat'], h['lng']))
            self.assertEqual(aed['data_origin'], 'synthetic_simulation')
            self.assertEqual(aed['availability_status'], 'available')
            self.assertEqual(aed['access_type'], 'public')

    def test_every_hospital_supplies_als_and_bls_with_stable_unique_ids(self):
        bases = cardiac_bases()
        units = fleet_units(bases)
        self.assertEqual(len(bases), len(self.hospitals) + len(get_default_bases()))
        self.assertEqual(len(units), 2 * len(self.hospitals) + 12)
        self.assertEqual(len({u['id'] for u in units}), len(units))
        self.assertEqual(units, fleet_units())
        for h in self.hospitals:
            self.assertEqual({u['ambulance_type'] for u in units if u['hospital_id'] == str(h['id'])}, {'ALS', 'BLS'})

    def test_default_lookup_exposes_more_than_two_aeds(self):
        resources = nearby_aeds(12.9249, 80.119, datetime.fromisoformat('2026-11-03T12:00:00+05:30'))
        self.assertGreater(len(resources), 10)
        self.assertTrue(any(a.get('hospital_id') for a in resources))
        result = self.client.get('/api/cardiac-arrest/catalog').json()
        self.assertEqual(result['summary']['hospital_aeds'], 339)
        self.assertEqual(result['summary']['total_aeds'], 347)
        self.assertEqual(result['summary']['hospital_ambulances'], 678)
        self.assertEqual(result['summary']['total_ambulances'], 690)

    def test_large_catalogue_uses_gzip_without_losing_resource_records(self):
        response = self.client.get('/api/cardiac-arrest/catalog', headers={'Accept-Encoding': 'gzip'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('Content-Encoding'), 'gzip')
        self.assertEqual(len(response.json()['aeds']), 347)
        self.assertEqual(len(response.json()['ambulances']), 690)

    def test_hospital_ambulance_dispatch_and_aed_delivery_without_community_responder(self):
        plan = self.dispatch(self.make_incident())
        ambulance = plan['assignments']['ambulances'][0]
        aed = plan['assignments']['aeds'][0]
        self.assertEqual(ambulance['hospital_id'], str(self.hospitals[0]['id']))
        self.assertEqual(ambulance['ambulance_type'], 'ALS')
        self.assertEqual(aed['delivery_method'], 'ambulance')
        self.assertEqual(aed['collector_id'], ambulance['id'])
        self.assertEqual(plan['assignments']['responders'], [])
        self.assertEqual(plan['analytics']['ambulance_base_count'], 349)
        self.assertEqual(plan['analytics']['hospital_candidate_count'], 339)
        self.assertEqual(plan['analytics']['unserved_victims'], 0)
        response = self.client.post(f"/api/cardiac-arrest/{plan['id']}/simulate", json={'action': 'advance', 'seconds': 90})
        self.assertEqual(response.status_code, 200, response.text)
        actual = response.json()['analytics']
        self.assertEqual(actual['aed_access_minutes'], actual['ambulance_arrival_minutes'])
        self.assertIsNone(actual['aed_use_minutes'])

    def test_expanded_reservations_are_visible_and_release_on_cancellation(self):
        plan = self.dispatch(self.make_incident())
        catalog = self.client.get('/api/cardiac-arrest/catalog').json()
        vehicle = plan['assignments']['ambulances'][0]['id']
        device = plan['assignments']['aeds'][0]['id']
        self.assertEqual(next(u for u in catalog['ambulances'] if u['id'] == vehicle)['availability_status'], 'assigned')
        self.assertFalse(next(a for a in catalog['aeds'] if a['id'] == device)['eligible'])
        other = self.dispatch(self.make_incident())
        self.assertNotIn(vehicle, {u['id'] for u in other['assignments']['ambulances']})
        self.assertNotIn(device, {a['id'] for a in other['assignments']['aeds']})
        response = self.client.patch(f"/api/cardiac-arrest/{plan['id']}/status", json={'status': 'CANCELLED'})
        self.assertEqual(response.status_code, 200)
        catalog = self.client.get('/api/cardiac-arrest/catalog').json()
        self.assertEqual(next(u for u in catalog['ambulances'] if u['id'] == vehicle)['availability_status'], 'available')
        self.assertTrue(next(a for a in catalog['aeds'] if a['id'] == device)['eligible'])

    def test_replacing_hospital_ambulance_does_not_leave_a_phantom_aed_delivery(self):
        plan = self.dispatch(self.make_incident())
        vehicle = plan['assignments']['ambulances'][0]['id']
        response = self.client.post(f"/api/cardiac-arrest/{plan['id']}/simulate", json={'action': 'ambulance_unavailable'})
        self.assertEqual(response.status_code, 200, response.text)
        updated = response.json()
        self.assertNotIn(vehicle, {u['id'] for u in updated['assignments']['ambulances']})
        self.assertFalse(any(a.get('collector_id') == vehicle for a in updated['assignments']['aeds']))

    def test_large_incident_uses_expanded_fleet_and_receiving_capacity(self):
        plan = self.dispatch(self.make_incident(victim_count=20))
        self.assertEqual(plan['analytics']['unserved_victims'], 0)
        self.assertGreaterEqual(len(plan['assignments']['ambulances']), 10)
        self.assertTrue(any(u.get('hospital_id') for u in plan['assignments']['ambulances']))
        self.assertTrue(all(h['patients_allocated'] <= 6 for h in plan['assignments']['hospitals']))

    def test_general_hospital_directory_and_original_simulator_remain_unchanged(self):
        from app.services.data_loader import SCENARIO_CLINICAL_PROFILES
        self.assertLess(len(SCENARIO_CLINICAL_PROFILES), len(cardiac_hospitals()))
        self.assertEqual(self.hospitals, load_verified_hospitals())
        self.assertEqual(len(get_default_bases()), 10)


if __name__ == '__main__':
    unittest.main()
