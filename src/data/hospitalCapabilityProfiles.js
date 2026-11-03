// PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
// Configurable Hospital Capability Profiles (Scenario Simulation Dataset)
//
// ==============================================================================
// DATA TRANSPARENCY NOTICE:
// The official Tamil Nadu hospital dataset (339 mapped facilities) provides
// facility names, types, addresses, and coordinates, but does NOT contain live bed
// counts, ICU availability, equipment inventories, or clinical capability tiers.
//
// In accordance with PALS Data Integrity Rules:
// 1. Unverified hospital capabilities in the raw dataset must remain UNKNOWN.
// 2. The profiles below are EXPLICITLY MARKED SCENARIO ASSUMPTIONS created to
//    enable clinical suitability evaluation and demonstrate the principle of
//    "Nearest Appropriate Hospital", NOT "Nearest Hospital".
// ==============================================================================

export const CAPABILITY_SCHEMA = {
  emergencyDepartment: 'Basic 24/7 casualty / emergency intake bay',
  traumaCare: 'Formal trauma resuscitation suite with dedicated trauma surgeons',
  emergencyEquipment: 'Ventilators, telemetry monitors, defibrillators, crash carts',
  icu: 'Intensive Care Unit beds with continuous critical care monitoring',
  specialistCare: 'Specialist surgical specialties (neurosurgery, orthopaedics, vascular)',
  traumaLevel: 'Trauma Center Classification (Level I, Level II, Level III, None)',
  burnUnit: 'Dedicated burn care and skin grafting unit',
  cardiacLab: 'Catheterization lab for acute cardiac interventions',
  surgeryCapacity: 'Emergency operating theatre readiness (HIGH, MEDIUM, LOW)'
};

export const SCENARIO_HOSPITAL_PROFILES = {
  // ---------------------------------------------------------------------------
  // Chennai Sector Major Facilities
  // ---------------------------------------------------------------------------
  // 19204: Rajiv Gandhi Government General Hospital (Tertiary Medical College)
  '19204': {
    hospitalId: '19204',
    name: 'RAJIVGANDHI GOVT.GENERAL HOSPITAL  MCH',
    emergencyDepartment: true,
    traumaCare: true,
    emergencyEquipment: true,
    icu: true,
    specialistCare: true,
    traumaLevel: 'Level I',
    burnUnit: true,
    cardiacLab: true,
    surgeryCapacity: 'HIGH',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },
  // 47400: Govt Kilpauk Medical College Hospital (Tertiary Specialty / Burns Hub)
  '47400': {
    hospitalId: '47400',
    name: 'GOVT KILPAUK MEDICAL COLL HOSPITAL MCH',
    emergencyDepartment: true,
    traumaCare: true,
    emergencyEquipment: true,
    icu: true,
    specialistCare: true,
    traumaLevel: 'Level II',
    burnUnit: true,
    cardiacLab: false,
    surgeryCapacity: 'MEDIUM',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },
  // 47402: Govt Peripheral Hospital KK Nagar (Medical College Attached Peripheral)
  '47402': {
    hospitalId: '47402',
    name: 'GOVT PERIPHERAL HL KK NAGAR MCH ATT',
    emergencyDepartment: true,
    traumaCare: false, // Lacks major trauma resuscitation
    emergencyEquipment: false,
    icu: false, // No dedicated critical ICU
    specialistCare: false,
    traumaLevel: 'None',
    burnUnit: false,
    cardiacLab: false,
    surgeryCapacity: 'LOW',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },
  // 19928: Tambaram Sub-District Hospital (Local Primary/Secondary Emergency)
  // CRITICAL TEST CASE: Closest to Tambaram Bypass (2.8 km), but NOT appropriate for high acuity/critical trauma!
  '19928': {
    hospitalId: '19928',
    name: 'TAMBARAM',
    emergencyDepartment: true,
    traumaCare: false, // FAILS mandatory trauma care for critical incidents
    emergencyEquipment: false,
    icu: false, // FAILS mandatory ICU check for critical casualties
    specialistCare: false,
    traumaLevel: 'None',
    burnUnit: false,
    cardiacLab: false,
    surgeryCapacity: 'LOW',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },
  // 37790: Poonamallee Sub-District Hospital
  '37790': {
    hospitalId: '37790',
    name: 'POONAMALLEE',
    emergencyDepartment: true,
    traumaCare: false,
    emergencyEquipment: false,
    icu: false,
    specialistCare: false,
    traumaLevel: 'None',
    burnUnit: false,
    cardiacLab: false,
    surgeryCapacity: 'LOW',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },
  // 47436: Saidapet Sub-District Hospital
  '47436': {
    hospitalId: '47436',
    name: 'SAIDAPET',
    emergencyDepartment: true,
    traumaCare: false,
    emergencyEquipment: false,
    icu: false,
    specialistCare: false,
    traumaLevel: 'None',
    burnUnit: false,
    cardiacLab: false,
    surgeryCapacity: 'LOW',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },

  // ---------------------------------------------------------------------------
  // Coimbatore Sector Facilities
  // ---------------------------------------------------------------------------
  // 42253: Coimbatore Medical College Hospital
  '42253': {
    hospitalId: '42253',
    name: 'COIMBATORE MEDL COLLEGE HOSP MCH',
    emergencyDepartment: true,
    traumaCare: true,
    emergencyEquipment: true,
    icu: true,
    specialistCare: true,
    traumaLevel: 'Level I',
    burnUnit: true,
    cardiacLab: true,
    surgeryCapacity: 'HIGH',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },
  // 46248: Sulur Sub-District Hospital (Local clinic near Avinashi / Sulur)
  '46248': {
    hospitalId: '46248',
    name: 'SULUR',
    emergencyDepartment: true,
    traumaCare: false,
    emergencyEquipment: false,
    icu: false,
    specialistCare: false,
    traumaLevel: 'None',
    burnUnit: false,
    cardiacLab: false,
    surgeryCapacity: 'LOW',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },

  // ---------------------------------------------------------------------------
  // Madurai Sector Facilities
  // ---------------------------------------------------------------------------
  // 66329: Govt Rajaji Hospital Madurai MCH
  '66329': {
    hospitalId: '66329',
    name: 'GOVT RAJAJI HOSP MADURAI MCH',
    emergencyDepartment: true,
    traumaCare: true,
    emergencyEquipment: true,
    icu: true,
    specialistCare: true,
    traumaLevel: 'Level I',
    burnUnit: true,
    cardiacLab: true,
    surgeryCapacity: 'HIGH',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },
  // 20685: Vadipatti Sub-District Hospital
  '20685': {
    hospitalId: '20685',
    name: 'VADIPATTI',
    emergencyDepartment: true,
    traumaCare: false,
    emergencyEquipment: false,
    icu: false,
    specialistCare: false,
    traumaLevel: 'None',
    burnUnit: false,
    cardiacLab: false,
    surgeryCapacity: 'LOW',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },

  // ---------------------------------------------------------------------------
  // Vellore Sector Facilities
  // ---------------------------------------------------------------------------
  // 19853: Vellore Medical College Hospital (Adukkamparai)
  '19853': {
    hospitalId: '19853',
    name: 'VELLORE MEDL COLL HOSP MCH',
    emergencyDepartment: true,
    traumaCare: true,
    emergencyEquipment: true,
    icu: true,
    specialistCare: true,
    traumaLevel: 'Level II',
    burnUnit: true,
    cardiacLab: false,
    surgeryCapacity: 'HIGH',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },
  // 37210: Vellore Sub-District Hospital (Town Center Clinic)
  // Closer to Katpadi junction (6.2 km) than Vellore MCH (14.3 km), but lacks tertiary trauma!
  '37210': {
    hospitalId: '37210',
    name: 'VELLORE',
    emergencyDepartment: true,
    traumaCare: false,
    emergencyEquipment: false,
    icu: false,
    specialistCare: false,
    traumaLevel: 'None',
    burnUnit: false,
    cardiacLab: false,
    surgeryCapacity: 'LOW',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },

  // ---------------------------------------------------------------------------
  // Tiruvannamalai Sector Facilities
  // ---------------------------------------------------------------------------
  // 20607: Tiruvannamalai MCH
  '20607': {
    hospitalId: '20607',
    name: 'Tiruvannamalai MCH',
    emergencyDepartment: true,
    traumaCare: true,
    emergencyEquipment: true,
    icu: true,
    specialistCare: true,
    traumaLevel: 'Level II',
    burnUnit: false,
    cardiacLab: false,
    surgeryCapacity: 'MEDIUM',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },
  // 71168: Thandrampattu Sub-District Hospital
  '71168': {
    hospitalId: '71168',
    name: 'Thandrampattu',
    emergencyDepartment: true,
    traumaCare: false,
    emergencyEquipment: false,
    icu: false,
    specialistCare: false,
    traumaLevel: 'None',
    burnUnit: false,
    cardiacLab: false,
    surgeryCapacity: 'LOW',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  },

  // ---------------------------------------------------------------------------
  // Tiruchirappalli Sector Facilities
  // ---------------------------------------------------------------------------
  // 58510: K.A.P. Viswanathan Govt Medical College Trichy
  '58510': {
    hospitalId: '58510',
    name: 'K.A.P.VISWANATHAN GOVT. MEDICAL COLLEGE',
    emergencyDepartment: true,
    traumaCare: true,
    emergencyEquipment: true,
    icu: true,
    specialistCare: true,
    traumaLevel: 'Level I',
    burnUnit: true,
    cardiacLab: true,
    surgeryCapacity: 'HIGH',
    isScenarioAssumption: true,
    profileSource: 'Configured Scenario Capability Profile — Not Verified Dataset'
  }
};

/**
 * Retrieve the scenario capability profile for a given hospital ID.
 * Returns null if no scenario profile has been configured (which leaves all fields UNKNOWN).
 */
export function getHospitalCapabilityProfile(hospitalId) {
  if (!hospitalId) return null;
  return SCENARIO_HOSPITAL_PROFILES[String(hospitalId)] || null;
}

/**
 * Returns a default unverified profile where all clinical capabilities are UNKNOWN.
 */
export function getDefaultUnverifiedProfile(hospitalId = null) {
  return {
    hospitalId: hospitalId ? String(hospitalId) : 'UNKNOWN',
    emergencyDepartment: 'UNKNOWN',
    traumaCare: 'UNKNOWN',
    emergencyEquipment: 'UNKNOWN',
    icu: 'UNKNOWN',
    specialistCare: 'UNKNOWN',
    traumaLevel: 'UNKNOWN',
    burnUnit: 'UNKNOWN',
    cardiacLab: 'UNKNOWN',
    surgeryCapacity: 'UNKNOWN',
    isScenarioAssumption: false,
    profileSource: 'Raw Dataset — No Capability Telemetry'
  };
}

