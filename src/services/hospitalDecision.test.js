import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateHospitalCandidate,
  rankEligibleHospitals,
  buildMedicalRequirements,
  generateHospitalRecommendationExplanation
} from './hospitalDecision.js';

const requirements = [
  { key: 'emergencyDepartment', label: 'Emergency department', mandatory: true },
  { key: 'traumaCare', label: 'Trauma care', mandatory: true }
];
const route = (durationMins, distanceKm) => ({ durationMins, distanceKm });

test('unknown hospital capabilities remain unverified and cannot be recommended', () => {
  const candidate = evaluateHospitalCandidate({ name: 'Mapped facility' }, requirements, 4, 0, 2, false);
  assert.equal(candidate.eligibility, 'UNVERIFIED');
  assert.equal(candidate.capabilityChecks[0].status, 'UNKNOWN');
  assert.deepEqual(rankEligibleHospitals([candidate]), []);
});

test('verified mandatory capability failure excludes a nearer hospital', () => {
  const failed = evaluateHospitalCandidate(
    { capabilities: { emergencyDepartment: true, traumaCare: false }, route: route(2, 1) },
    requirements,
    4,
    0,
    2,
    false
  );
  const eligible = evaluateHospitalCandidate(
    { capabilities: { emergencyDepartment: true, traumaCare: true }, route: route(8, 6) },
    requirements,
    4,
    0,
    2,
    false
  );
  assert.equal(failed.eligibility, 'INELIGIBLE');
  assert.equal(rankEligibleHospitals([failed, eligible])[0], eligible);
});

test('configured workload can fail receiving capacity', () => {
  const candidate = evaluateHospitalCandidate(
    { capabilities: { emergencyDepartment: true, traumaCare: true } },
    requirements,
    4,
    3,
    2,
    false
  );
  assert.equal(candidate.capacityStatus, 'FAIL');
  assert.equal(candidate.eligibility, 'INELIGIBLE');
});

test('nearest appropriate hospital principle: bypasses closer inappropriate hospital', () => {
  // Tambaram hospital (id 19928) is 2.8 km away, but has no trauma or ICU
  // Kilpauk hospital (id 47400) is 21.6 km away, and has Level II trauma and ICU
  const criticalReqs = buildMedicalRequirements({
    incidentType: 'Highway Accident',
    incidentSeverity: 'CRITICAL',
    criticalCasualties: 2,
    totalCasualties: 4
  });

  const tambaramHosp = evaluateHospitalCandidate(
    { id: '19928', name: 'TAMBARAM', route: route(8.5, 2.8) },
    criticalReqs,
    4,
    0,
    4,
    true
  );

  const kilpaukHosp = evaluateHospitalCandidate(
    { id: '47400', name: 'GOVT KILPAUK MEDICAL COLL HOSPITAL MCH', route: route(26.0, 21.6) },
    criticalReqs,
    4,
    0,
    4,
    true
  );

  assert.equal(tambaramHosp.eligibility, 'INELIGIBLE');
  assert.equal(kilpaukHosp.eligibility, 'ELIGIBLE');

  const ranked = rankEligibleHospitals([tambaramHosp, kilpaukHosp]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, '47400');

  const explanation = generateHospitalRecommendationExplanation(ranked[0], [tambaramHosp, kilpaukHosp]);
  assert.equal(explanation.bypassedCloser.length, 1);
  assert.equal(explanation.bypassedCloser[0].name, 'TAMBARAM');
});
