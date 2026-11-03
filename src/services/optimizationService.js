// PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
// Mathematical Operations Research Optimization Service (Python + PuLP Integration)

import {
  SCENARIO_AMBULANCE_BASES,
  SCENARIO_AMBULANCES,
  PRESET_INCIDENT_LOCATIONS,
  calculateHaversineKm
} from '../data/scenarioData.js';
import { VERIFIED_HOSPITALS } from '../data/mockData.js';
import { SCENARIO_HOSPITAL_PROFILES } from '../data/hospitalCapabilityProfiles.js';

const API_BASE_URL = ''; // Relative path leverages Vite dev proxy to http://127.0.0.1:8000
const DIRECT_BACKEND_URL = 'http://127.0.0.1:8000';

/**
 * Checks if the Python FastAPI backend is healthy and reachable.
 */
export async function checkBackendHealth() {
  const endpoints = ['/api/health', '/health', `${DIRECT_BACKEND_URL}/api/health`, `${DIRECT_BACKEND_URL}/health`];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (response.ok) {
        const data = await response.json();
        return { isOnline: true, data, endpoint: url };
      }
    } catch (err) {
      // Continue trying next endpoint
    }
  }

  return {
    isOnline: false,
    error: 'PuLP FastAPI backend offline at http://127.0.0.1:8000'
  };
}

/**
 * Prepares the optimization request payload matching Python backend schemas:
 * OptimizationRequest(incidents, bases, hospitals, ambulance_types, parameters)
 */
export function buildOptimizationPayload({
  incidents = [],
  objectiveMode = 'weighted_sum',
  alpha = 1.0,
  beta = 1.0,
  M = 10000.0,
  allowUnservedPenalty = true,
  enforceStrictAls = true,
  scenarioHospitalCapacity = 4,
  scenarioHospitalWorkload = 0
}) {
  // 1. Format Incidents
  const formattedIncidents = incidents.map((inc, idx) => {
    const total = Number(inc.totalCasualties || inc.total_casualties || 4);
    const critical = Number(inc.criticalCasualties || inc.critical_casualties || 1);
    const severity = (inc.severity || 'CRITICAL').toUpperCase();

    let severityWeight = 1.5;
    if (severity === 'CRITICAL') severityWeight = 2.0;
    else if (severity === 'HIGH') severityWeight = 1.5;
    else if (severity === 'MEDIUM') severityWeight = 1.0;

    return {
      id: inc.id || `INC-${String(idx + 1).padStart(2, '0')}`,
      name: inc.name || inc.title || `Incident ${inc.id}`,
      type: inc.type || 'Highway Accident',
      severity,
      severity_weight: severityWeight,
      total_casualties: total,
      critical_casualties: critical,
      lat: Number(inc.lat),
      lng: Number(inc.lng),
      description: inc.description || ''
    };
  });

  // 2. Format Bases with Available Units
  const baseUnitsMap = {};
  SCENARIO_AMBULANCES.forEach((amb) => {
    if (amb.status.toLowerCase() === 'available') {
      if (!baseUnitsMap[amb.baseId]) {
        baseUnitsMap[amb.baseId] = { ALS: 0, BLS: 0, NLS: 0 };
      }
      if (baseUnitsMap[amb.baseId][amb.type] !== undefined) {
        baseUnitsMap[amb.baseId][amb.type] += 1;
      }
    }
  });

  const formattedBases = SCENARIO_AMBULANCE_BASES.map((b) => ({
    id: b.id,
    name: b.name,
    lat: Number(b.lat),
    lng: Number(b.lng),
    district: b.district,
    available_units: baseUnitsMap[b.id] || { ALS: 0, BLS: 0, NLS: 0 }
  }));

  // 3. Format Candidate Hospitals (discovering nearest for all incidents)
  const candidateHospitalMap = {};

  formattedIncidents.forEach((inc) => {
    // Find hospitals within 130 km radius
    const nearby = VERIFIED_HOSPITALS.map((h) => ({
      ...h,
      distanceKm: calculateHaversineKm(inc.lat, inc.lng, h.lat, h.lng)
    }))
      .filter((h) => h.distanceKm <= 130)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 8);

    nearby.forEach((h) => {
      if (!candidateHospitalMap[h.id]) {
        const profile = SCENARIO_HOSPITAL_PROFILES[String(h.id)] || {};
        candidateHospitalMap[h.id] = {
          id: String(h.id),
          name: h.name,
          lat: Number(h.lat),
          lng: Number(h.lng),
          district: h.district || 'Tamil Nadu',
          facility_type: h.type || 'Hospital',
          receiving_capacity: Number(scenarioHospitalCapacity),
          simulated_workload: Number(scenarioHospitalWorkload),
          capabilities: {
            emergencyDepartment: profile.emergencyDepartment ?? 'UNKNOWN',
            traumaCare: profile.traumaCare ?? 'UNKNOWN',
            emergencyEquipment: profile.emergencyEquipment ?? 'UNKNOWN',
            icu: profile.icu ?? 'UNKNOWN',
            specialistCare: profile.specialistCare ?? 'UNKNOWN',
            burnUnit: profile.burnUnit ?? 'UNKNOWN'
          },
          is_scenario_profile: Boolean(SCENARIO_HOSPITAL_PROFILES[String(h.id)])
        };
      }
    });
  });

  const formattedHospitals = Object.values(candidateHospitalMap);

  // 4. Default Ambulance Types
  const ambulanceTypes = [
    { type: 'ALS', patient_capacity: 2, speed_kmph: 55.0, is_als_capable: true },
    { type: 'BLS', patient_capacity: 2, speed_kmph: 58.0, is_als_capable: false },
    { type: 'NLS', patient_capacity: 1, speed_kmph: 50.0, is_als_capable: false }
  ];

  // 5. Optimization Parameters
  const parameters = {
    alpha,
    beta,
    M,
    M_critical: M * 2.0,
    M_noncritical: M,
    objective_mode: objectiveMode,
    default_als_capacity: 2,
    default_bls_capacity: 2,
    allow_unserved_penalty: allowUnservedPenalty,
    enforce_strict_als_for_critical: enforceStrictAls
  };

  return {
    incidents: formattedIncidents,
    bases: formattedBases,
    hospitals: formattedHospitals,
    ambulance_types: ambulanceTypes,
    parameters
  };
}

/**
 * Invokes the actual PuLP Optimization Engine via FastAPI.
 * Strictly adheres to rule: If the solver fails, show an error.
 * NEVER silently fall back to fabricated or hardcoded results.
 */
export async function executePulpOptimization(payload) {
  const endpoints = ['/api/optimize', `${DIRECT_BACKEND_URL}/api/optimize`];
  let lastError = null;

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000) // 10 second timeout for solver
      });

      if (!response.ok) {
        let errDetail = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errBody = await response.json();
          if (errBody.detail) errDetail = errBody.detail;
        } catch (_) {}
        throw new Error(errDetail);
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
        endpointUsed: url
      };
    } catch (err) {
      lastError = err;
    }
  }

  // When both endpoints fail:
  console.error('PuLP Optimization Solver invocation failed:', lastError);
  return {
    success: false,
    error: `PuLP Backend Connection Failed: ${lastError?.message || 'Unable to reach optimization API at http://127.0.0.1:8000'}. Ensure the backend service is started ('python3 -m uvicorn app.main:app --app-dir backend --port 8000').`,
    rawError: lastError
  };
}
