// PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
// Hospital Clinical Decision Support & Recommendation Engine
//
// ==============================================================================
// CORE PRINCIPLE:
// "Nearest appropriate hospital", NOT "nearest hospital".
//
// 1. Mandatory requirements are strictly separated from preference factors.
// 2. A hospital failing any mandatory requirement is marked INELIGIBLE.
// 3. Unknown capabilities remain UNKNOWN and cannot pass eligibility.
// 4. Configured intake capacity and simulated workload are explicitly verified.
// 5. Eligible hospitals are ranked by ETA, distance, capability score, capacity, and workload.
// ==============================================================================

import { getHospitalCapabilityProfile } from '../data/hospitalCapabilityProfiles.js';

export const UNKNOWN = 'UNKNOWN';

/**
 * Builds clinical requirements based on incident severity, type, and casualty triage.
 * Separates mandatory clinical gates from preference factors.
 */
export function buildMedicalRequirements({ incidentType = '', incidentSeverity = 'HIGH', criticalCasualties = 0, totalCasualties = 1 }) {
  const isHighAcuity = incidentSeverity === 'CRITICAL' || incidentSeverity === 'HIGH';
  const isTraumaIncident = /accident|stampede|trauma|derailment|collision/i.test(incidentType || '');
  const hasCriticalCasualties = criticalCasualties > 0;
  const isMassCasualty = totalCasualties >= 8 || criticalCasualties >= 3;

  return [
    // --- MANDATORY CLINICAL GATES ---
    {
      key: 'emergencyDepartment',
      label: 'Emergency Department Capability',
      mandatory: true,
      description: '24/7 dedicated acute emergency reception and triage facility'
    },
    {
      key: 'traumaCare',
      label: 'Trauma Care Capability',
      mandatory: isHighAcuity || isTraumaIncident,
      description: 'Dedicated trauma resuscitation bay with surgical stabilization'
    },
    {
      key: 'emergencyEquipment',
      label: 'Verified Emergency Equipment Profile',
      mandatory: hasCriticalCasualties,
      description: 'Critical monitoring telemetry, mechanical ventilators, and defibrillators'
    },
    {
      key: 'icu',
      label: 'ICU Availability',
      mandatory: hasCriticalCasualties,
      description: 'Critical care ICU beds with continuous intensivist supervision'
    },
    {
      key: 'specialistCare',
      label: 'Specialist Surgical Capabilities',
      mandatory: isMassCasualty || (incidentSeverity === 'CRITICAL' && criticalCasualties >= 2),
      description: 'On-duty neurosurgical, orthopaedic, and vascular surgical teams'
    },

    // --- PREFERENCE FACTORS (NON-MANDATORY SCORING WEIGHTS) ---
    {
      key: 'burnUnit',
      label: 'Burn Unit Capability',
      mandatory: false,
      preferred: /railway|fire|explosion|chemical|fuel/i.test(incidentType || ''),
      description: 'Specialized burn care isolation unit'
    },
    {
      key: 'cardiacLab',
      label: 'Cardiac Catheterization Lab',
      mandatory: false,
      preferred: false,
      description: 'Interventional cardiology catheterization suite'
    }
  ];
}

/**
 * Reads a capability key from a hospital record or its attached profile.
 * Respects strict UNKNOWN semantics: never assumes true if unrecorded.
 */
function readCapability(hospital, key, useScenarioProfiles = true) {
  // If scenario profiles enabled, check profile lookup first
  let profile = null;
  if (useScenarioProfiles && hospital?.id) {
    profile = getHospitalCapabilityProfile(hospital.id);
  }

  const value =
    profile?.[key] ??
    hospital?.capabilities?.[key] ??
    hospital?.clinicalProfile?.[key] ??
    hospital?.[key];

  if (value === true) return 'PASS';
  if (value === false) return 'FAIL';
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (['AVAILABLE', 'VERIFIED', 'YES', 'TRUE', 'PASS'].includes(normalized)) return 'PASS';
    if (['UNAVAILABLE', 'NO', 'FALSE', 'FAIL', 'NOT AVAILABLE'].includes(normalized)) return 'FAIL';
  }
  if (Array.isArray(value)) return value.length ? 'PASS' : 'FAIL';
  return UNKNOWN;
}

/**
 * Evaluates a single hospital candidate against incident clinical requirements,
 * configured receiving capacity, and current simulated workload.
 */
export function evaluateHospitalCandidate(
  hospital,
  requirements,
  scenarioCapacity = 4,
  simulatedWorkload = 0,
  casualtyCount = 1,
  useScenarioProfiles = true
) {
  const mandatoryRequirements = requirements.filter((r) => r.mandatory);
  const preferenceRequirements = requirements.filter((r) => !r.mandatory);

  // Evaluate mandatory clinical checks
  const capabilityChecks = mandatoryRequirements.map((req) => ({
    ...req,
    status: readCapability(hospital, req.key, useScenarioProfiles)
  }));

  // Evaluate preference checks
  const preferenceChecks = preferenceRequirements.map((req) => ({
    ...req,
    status: readCapability(hospital, req.key, useScenarioProfiles)
  }));

  // Receiving capacity evaluation
  const freeScenarioCapacity =
    Number.isFinite(scenarioCapacity) && Number.isFinite(simulatedWorkload)
      ? Math.max(0, scenarioCapacity - simulatedWorkload)
      : null;

  const capacityStatus =
    freeScenarioCapacity === null
      ? UNKNOWN
      : freeScenarioCapacity >= casualtyCount
      ? 'PASS'
      : 'FAIL';

  // Strict Eligibility Determination:
  // FAIL if any mandatory check fails OR capacity check fails.
  const hasFailure =
    capabilityChecks.some((c) => c.status === 'FAIL') || capacityStatus === 'FAIL';
  // UNVERIFIED if no failure but any mandatory capability is UNKNOWN or capacity is UNKNOWN.
  const hasUnknown =
    capabilityChecks.some((c) => c.status === UNKNOWN) || capacityStatus === UNKNOWN;

  const eligibility = hasFailure ? 'INELIGIBLE' : hasUnknown ? 'UNVERIFIED' : 'ELIGIBLE';

  // Construct detailed rejection or status reasons
  const failureReasons = capabilityChecks
    .filter((c) => c.status === 'FAIL')
    .map((c) => `${c.label}: FAIL`);

  const unknownReasons = capabilityChecks
    .filter((c) => c.status === UNKNOWN)
    .map((c) => `${c.label}: UNKNOWN`);

  if (capacityStatus === 'FAIL') {
    failureReasons.push(`Receiving capacity exceeded (Free: ${freeScenarioCapacity}, Needed: ${casualtyCount})`);
  } else if (capacityStatus === UNKNOWN) {
    unknownReasons.push(`Receiving capacity: UNKNOWN`);
  }

  let rejectionReason = 'All mandatory checks passed';
  if (eligibility === 'INELIGIBLE') {
    rejectionReason = failureReasons.join(' · ');
  } else if (eligibility === 'UNVERIFIED') {
    rejectionReason = `Unverified capabilities: ${unknownReasons.join(' · ')}`;
  }

  // Calculate clinical suitability score (0-100)
  // Used to break ties and prefer higher-tier trauma/teaching centers
  let capabilityScore = 50; // base score
  const profile = useScenarioProfiles && hospital?.id ? getHospitalCapabilityProfile(hospital.id) : null;
  if (profile?.traumaLevel === 'Level I') capabilityScore += 30;
  else if (profile?.traumaLevel === 'Level II') capabilityScore += 20;

  if (profile?.surgeryCapacity === 'HIGH') capabilityScore += 10;
  if (profile?.burnUnit) capabilityScore += 5;
  if (profile?.cardiacLab) capabilityScore += 5;

  return {
    ...hospital,
    capabilityChecks,
    preferenceChecks,
    scenarioCapacity,
    simulatedWorkload,
    freeScenarioCapacity,
    capacityStatus,
    eligibility,
    eligible: eligibility === 'ELIGIBLE',
    rejectionReason,
    capabilityScore,
    profileSource: profile?.profileSource || 'Raw Dataset (No Capability Telemetry)'
  };
}

/**
 * Filter and rank eligible hospitals using:
 * 1. Road travel time (ETA)
 * 2. Road distance
 * 3. Clinical capability suitability score
 * 4. Available configured capacity
 * 5. Current simulated workload
 */
export function rankEligibleHospitals(candidates) {
  return candidates
    .filter((candidate) => candidate.eligibility === 'ELIGIBLE' && candidate.route)
    .sort((a, b) => {
      // 1. Road travel time (lower ETA is preferred)
      const timeDiff = a.route.durationMins - b.route.durationMins;
      if (Math.abs(timeDiff) > 1.5) return timeDiff;

      // 2. Road distance (shorter distance)
      const distDiff = a.route.distanceKm - b.route.distanceKm;
      if (Math.abs(distDiff) > 2.0) return distDiff;

      // 3. Clinical capability suitability (higher tier preferred)
      const capDiff = (b.capabilityScore ?? 0) - (a.capabilityScore ?? 0);
      if (capDiff !== 0) return capDiff;

      // 4. Free scenario capacity (more buffer preferred)
      const capBufferDiff = (b.freeScenarioCapacity ?? 0) - (a.freeScenarioCapacity ?? 0);
      if (capBufferDiff !== 0) return capBufferDiff;

      // 5. Workload (lower current load preferred)
      return a.simulatedWorkload - b.simulatedWorkload;
    });
}

/**
 * Generates an explainable decision rationale for why PALS recommended this specific hospital,
 * including which nearer hospitals were bypassed and why.
 */
export function generateHospitalRecommendationExplanation(recommendedHospital, allCandidates = [], incident = {}) {
  if (!recommendedHospital) {
    return {
      headline: 'No Verified Eligible Hospital Identified',
      summary: 'No nearby facility passed all mandatory verified clinical capabilities and intake capacity checks.',
      bypassedCloser: [],
      passedChecks: []
    };
  }

  // Find closer hospitals that were bypassed because they were ineligible or unverified
  const bypassedCloser = allCandidates
    .filter(
      (c) =>
        c.id !== recommendedHospital.id &&
        c.route &&
        c.route.durationMins < recommendedHospital.route.durationMins
    )
    .map((c) => ({
      name: c.name,
      distanceKm: c.route.distanceKm,
      durationMins: c.route.durationMins,
      eligibility: c.eligibility,
      reason: c.rejectionReason
    }));

  const passedChecks = recommendedHospital.capabilityChecks.map((c) => `${c.label}: PASS`);

  let summary = `Selected as the nearest appropriate emergency facility (${recommendedHospital.route.durationMins} min ETA, ${recommendedHospital.route.distanceKm} km). All mandatory clinical gates verified.`;
  if (bypassedCloser.length > 0) {
    summary += ` Bypassed ${bypassedCloser.length} closer facility/facilities that lacked required trauma/ICU capabilities.`;
  }

  return {
    headline: `Recommended Destination: ${recommendedHospital.name}`,
    summary,
    bypassedCloser,
    passedChecks,
    freeCapacity: recommendedHospital.freeScenarioCapacity,
    simulatedWorkload: recommendedHospital.simulatedWorkload,
    auditStamp: new Date().toISOString()
  };
}
