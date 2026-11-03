// PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
// Scenario Simulation Resources Dataset (Stage 3)
//
// ==============================================================================
// IMPORTANT DATA TRANSPARENCY RULE:
// The official Tamil Nadu 108 dataset provides district-level aggregate counts
// (1,353 total ambulances across 38 districts), but station-level coordinates and
// individual live vehicle GPS telemetry are not published in public releases.
//
// The bases and vehicles defined below are EXPLICITLY LABELLED SCENARIO ASSUMPTIONS
// created to enable realistic road-routing, dispatch evaluation, and event simulation.
// They do NOT represent verified official station coordinates or real live assets.
// ==============================================================================

export const SCENARIO_INCIDENT_TYPES = [
  {
    id: 'highway_accident',
    name: 'Highway Accident',
    description: 'Multi-vehicle collision or pileup along high-speed national/state highways.',
    defaultCasualties: 5,
    defaultCritical: 2,
    defaultSeverity: 'CRITICAL',
    icon: 'AlertTriangle'
  },
  {
    id: 'railway_accident',
    name: 'Railway Accident',
    description: 'Derailment or level-crossing incident requiring mass-casualty triage and rapid extraction.',
    defaultCasualties: 12,
    defaultCritical: 4,
    defaultSeverity: 'CRITICAL',
    icon: 'Flame'
  },
  {
    id: 'stampede',
    name: 'Stampede / Crowd Surge',
    description: 'Mass-gathering surge or religious/festival gathering containment failure with crush injuries.',
    defaultCasualties: 8,
    defaultCritical: 3,
    defaultSeverity: 'HIGH',
    icon: 'Users'
  }
];

// Presets for quick-testing across Tamil Nadu geography
export const PRESET_INCIDENT_LOCATIONS = [
  {
    id: 'HOTSPOT-01',
    name: 'NH-45 Tambaram Bypass (Chennai Sector)',
    district: 'Chennai',
    lat: 12.9249,
    lng: 80.1190,
    type: 'Highway Accident',
    severity: 'CRITICAL',
    totalCasualties: 4,
    criticalCasualties: 2,
    description: 'Multi-vehicle rear-end collision involving express bus and 2 cars near Irumbuliyur bridge.'
  },
  {
    id: 'HOTSPOT-02',
    name: 'Avinashi Road Express Corridor (Coimbatore)',
    district: 'Coimbatore',
    lat: 11.0285,
    lng: 77.0120,
    type: 'Highway Accident',
    severity: 'HIGH',
    totalCasualties: 3,
    criticalCasualties: 1,
    description: 'Commercial carrier collision at Hope College junction with fuel spill risk.'
  },
  {
    id: 'HOTSPOT-03',
    name: 'Madurai Outer Ring Road (Samayanallur)',
    district: 'Madurai',
    lat: 9.9860,
    lng: 78.0640,
    type: 'Highway Accident',
    severity: 'CRITICAL',
    totalCasualties: 6,
    criticalCasualties: 3,
    description: 'Tourist van collision near Samayanallur interchange on NH-44.'
  },
  {
    id: 'HOTSPOT-04',
    name: 'Katpadi Railway Junction Perimeter (Vellore)',
    district: 'Vellore',
    lat: 12.9715,
    lng: 79.1385,
    type: 'Railway Accident',
    severity: 'CRITICAL',
    totalCasualties: 14,
    criticalCasualties: 5,
    description: 'Level-crossing freight collision with passenger feeder near Katpadi yard.'
  },
  {
    id: 'HOTSPOT-05',
    name: 'Thiruvannamalai Girivalam Outer Ring Path',
    district: 'Tiruvannamalai',
    lat: 12.2280,
    lng: 79.0550,
    type: 'Stampede',
    severity: 'HIGH',
    totalCasualties: 9,
    criticalCasualties: 2,
    description: 'Crowd surge at temple west gate during Chitra Pournami gathering.'
  }
];

// Illustrative Ambulance Base Stations (Realistic Tamil Nadu ERO Depots)
// Clearly labelled as scenario assumptions.
export const SCENARIO_AMBULANCE_BASES = [
  {
    id: 'BASE-CHN-01',
    name: 'Tambaram Emergency Response Sub-Depot',
    district: 'Chennai',
    lat: 12.9210,
    lng: 80.1115,
    category: 'Highway Emergency Hub',
    isScenarioAssumption: true,
    provenance: 'Illustrative base location placed along NH-45 corridor for scenario simulation.'
  },
  {
    id: 'BASE-CHN-02',
    name: 'Guindy Central Disaster Depot',
    district: 'Chennai',
    lat: 13.0080,
    lng: 80.2030,
    category: 'Urban Metropolitan Hub',
    isScenarioAssumption: true,
    provenance: 'Illustrative metropolitan response depot near Kathipara junction.'
  },
  {
    id: 'BASE-CBE-01',
    name: 'Gandhipuram Emergency Operations Post',
    district: 'Coimbatore',
    lat: 11.0180,
    lng: 76.9620,
    category: 'Urban Operations Hub',
    isScenarioAssumption: true,
    provenance: 'Illustrative urban transit post for western sector simulation.'
  },
  {
    id: 'BASE-CBE-02',
    name: 'Sulur Highway Rapid Post',
    district: 'Coimbatore',
    lat: 11.0240,
    lng: 77.1260,
    category: 'Corridor Post',
    isScenarioAssumption: true,
    provenance: 'Illustrative base near NH-544 corridor.'
  },
  {
    id: 'BASE-MDU-01',
    name: 'Mattuthavani Bus Terminal Rescue Post',
    district: 'Madurai',
    lat: 9.9430,
    lng: 78.1510,
    category: 'Southern Regional Hub',
    isScenarioAssumption: true,
    provenance: 'Illustrative transit hub for Madurai and southern districts.'
  },
  {
    id: 'BASE-TRZ-01',
    name: 'Thillai Nagar Emergency Transit Depot',
    district: 'Tiruchirappalli',
    lat: 10.8250,
    lng: 78.6880,
    category: 'Central Delta Hub',
    isScenarioAssumption: true,
    provenance: 'Illustrative central Tamil Nadu river basin emergency base.'
  },
  {
    id: 'BASE-SLM-01',
    name: 'Omalur Highway Response Post',
    district: 'Salem',
    lat: 11.7410,
    lng: 78.0430,
    category: 'Western Highway Hub',
    isScenarioAssumption: true,
    provenance: 'Illustrative toll corridor station on NH-44.'
  },
  {
    id: 'BASE-VEL-01',
    name: 'Vellore Golden City Rapid Depot',
    district: 'Vellore',
    lat: 12.9200,
    lng: 79.1350,
    category: 'Northern Corridor Hub',
    isScenarioAssumption: true,
    provenance: 'Illustrative base stationed along NH-48 Bangalore-Chennai highway.'
  },
  {
    id: 'BASE-KGI-01',
    name: 'Hosur SIPCOT Industrial Rapid Unit',
    district: 'Krishnagiri',
    lat: 12.7420,
    lng: 77.8210,
    category: 'Industrial Trauma Hub',
    isScenarioAssumption: true,
    provenance: 'Illustrative industrial zone emergency response base.'
  },
  {
    id: 'BASE-TVI-01',
    name: 'Thiruvannamalai Town Feeder Base',
    district: 'Tiruvannamalai',
    lat: 12.2290,
    lng: 79.0680,
    category: 'Pilgrimage Security Hub',
    isScenarioAssumption: true,
    provenance: 'Illustrative town base for crowd surge and temple perimeter response.'
  }
];

// Configurable Scenario Ambulances assigned to illustrative bases
// Clearly labelled as scenario assumptions.
export const SCENARIO_AMBULANCES = [
  {
    id: 'SIM-AMB-ALS-01',
    callsign: 'Alpha-ALS-01',
    type: 'ALS',
    typeDescription: 'Advanced Life Support (Ventilator, Defibrillator, Critical Telemetry)',
    baseId: 'BASE-CHN-01',
    baseName: 'Tambaram Emergency Response Sub-Depot',
    district: 'Chennai',
    lat: 12.9210,
    lng: 80.1115,
    status: 'Available',
    capacityCasualties: 2,
    crewLead: 'Paramedic S. Rajesh (ICM Certified)',
    speedKmph: 55,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  },
  {
    id: 'SIM-AMB-BLS-02',
    callsign: 'Alpha-BLS-02',
    type: 'BLS',
    typeDescription: 'Basic Life Support (AED, Trauma Kit, Oxygen, Spine Board)',
    baseId: 'BASE-CHN-01',
    baseName: 'Tambaram Emergency Response Sub-Depot',
    district: 'Chennai',
    lat: 12.9210,
    lng: 80.1115,
    status: 'Available',
    capacityCasualties: 2,
    crewLead: 'EMT K. Murugan',
    speedKmph: 58,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  },
  {
    id: 'SIM-AMB-ALS-03',
    callsign: 'Guindy-ALS-03',
    type: 'ALS',
    typeDescription: 'Advanced Life Support (Ventilator, Defibrillator, Infusion Pumps)',
    baseId: 'BASE-CHN-02',
    baseName: 'Guindy Central Disaster Depot',
    district: 'Chennai',
    lat: 13.0080,
    lng: 80.2030,
    status: 'Available',
    capacityCasualties: 2,
    crewLead: 'Dr. V. Kavitha (Resident EMT)',
    speedKmph: 52,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  },
  {
    id: 'SIM-AMB-NLS-04',
    callsign: 'Guindy-NLS-04',
    type: 'NLS',
    typeDescription: 'Neonatal & Pediatric Life Support (Transport Incubator, Micro-Ventilator)',
    baseId: 'BASE-CHN-02',
    baseName: 'Guindy Central Disaster Depot',
    district: 'Chennai',
    lat: 13.0080,
    lng: 80.2030,
    status: 'Available',
    capacityCasualties: 1,
    crewLead: 'Nurse Specialist M. Deepa',
    speedKmph: 50,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  },
  {
    id: 'SIM-AMB-ALS-05',
    callsign: 'Kongu-ALS-05',
    type: 'ALS',
    typeDescription: 'Advanced Life Support (Cardiac Telemetry, Extrication Kits)',
    baseId: 'BASE-CBE-01',
    baseName: 'Gandhipuram Emergency Operations Post',
    district: 'Coimbatore',
    lat: 11.0180,
    lng: 76.9620,
    status: 'Available',
    capacityCasualties: 2,
    crewLead: 'EMT P. Chandran',
    speedKmph: 55,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  },
  {
    id: 'SIM-AMB-BLS-06',
    callsign: 'Kongu-BLS-06',
    type: 'BLS',
    typeDescription: 'Basic Life Support (First-Aid Stabilization, Oxygen Therapy)',
    baseId: 'BASE-CBE-02',
    baseName: 'Sulur Highway Rapid Post',
    district: 'Coimbatore',
    lat: 11.0240,
    lng: 77.1260,
    status: 'Available',
    capacityCasualties: 2,
    crewLead: 'EMT N. Selvam',
    speedKmph: 60,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  },
  {
    id: 'SIM-AMB-ALS-07',
    callsign: 'Pandya-ALS-07',
    type: 'ALS',
    typeDescription: 'Advanced Life Support (Trauma Resuscitation Suite)',
    baseId: 'BASE-MDU-01',
    baseName: 'Mattuthavani Bus Terminal Rescue Post',
    district: 'Madurai',
    lat: 9.9430,
    lng: 78.1510,
    status: 'Available',
    capacityCasualties: 2,
    crewLead: 'EMT R. Karthikeyan',
    speedKmph: 54,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  },
  {
    id: 'SIM-AMB-BLS-08',
    callsign: 'Delta-BLS-08',
    type: 'BLS',
    typeDescription: 'Basic Life Support (Rapid Multi-casualty Triage)',
    baseId: 'BASE-TRZ-01',
    baseName: 'Thillai Nagar Emergency Transit Depot',
    district: 'Tiruchirappalli',
    lat: 10.8250,
    lng: 78.6880,
    status: 'Available',
    capacityCasualties: 2,
    crewLead: 'EMT J. Lawrence',
    speedKmph: 52,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  },
  {
    id: 'SIM-AMB-ALS-09',
    callsign: 'Steel-ALS-09',
    type: 'ALS',
    typeDescription: 'Advanced Life Support (Highway High-Speed Extrication)',
    baseId: 'BASE-SLM-01',
    baseName: 'Omalur Highway Response Post',
    district: 'Salem',
    lat: 11.7410,
    lng: 78.0430,
    status: 'Available',
    capacityCasualties: 2,
    crewLead: 'EMT A. Subramaniam',
    speedKmph: 62,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  },
  {
    id: 'SIM-AMB-ALS-10',
    callsign: 'Vellore-ALS-10',
    type: 'ALS',
    typeDescription: 'Advanced Life Support (Trauma Ventilator & Tele-ECG)',
    baseId: 'BASE-VEL-01',
    baseName: 'Vellore Golden City Rapid Depot',
    district: 'Vellore',
    lat: 12.9200,
    lng: 79.1350,
    status: 'Available',
    capacityCasualties: 2,
    crewLead: 'EMT T. Vignesh',
    speedKmph: 56,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  },
  {
    id: 'SIM-AMB-BLS-11',
    callsign: 'Hosur-BLS-11',
    type: 'BLS',
    typeDescription: 'Basic Life Support (Industrial Chemical & Burn Kit)',
    baseId: 'BASE-KGI-01',
    baseName: 'Hosur SIPCOT Industrial Rapid Unit',
    district: 'Krishnagiri',
    lat: 12.7420,
    lng: 77.8210,
    status: 'Available',
    capacityCasualties: 2,
    crewLead: 'EMT M. Srinivas',
    speedKmph: 58,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  },
  {
    id: 'SIM-AMB-BLS-12',
    callsign: 'Temple-BLS-12',
    type: 'BLS',
    typeDescription: 'Basic Life Support (Crush Injury & Spine Stabilization)',
    baseId: 'BASE-TVI-01',
    baseName: 'Thiruvannamalai Town Feeder Base',
    district: 'Tiruvannamalai',
    lat: 12.2290,
    lng: 79.0680,
    status: 'Available',
    capacityCasualties: 2,
    crewLead: 'EMT K. Sundaram',
    speedKmph: 50,
    isScenarioAssumption: true,
    originType: 'Scenario Assumed Base Depot'
  }
];

// Helper to calculate approximate distance in km (Haversine formula)
export function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Generate realistic intermediate highway corridor waypoints for fallback
export function generateCurvedFallbackRoute(origin, destination, numPoints = 12) {
  const points = [];
  const lat1 = origin.lat;
  const lon1 = origin.lng;
  const lat2 = destination.lat;
  const lon2 = destination.lng;

  // Vector between points
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  // Perpendicular offset to simulate highway curves
  const perpLat = -dLon * 0.08;
  const perpLon = dLat * 0.08;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    // Parabolic arc displacement
    const curve = Math.sin(t * Math.PI) * (i % 2 === 0 ? 1 : -0.6);
    const lat = lat1 + dLat * t + perpLat * curve;
    const lon = lon1 + dLon * t + perpLon * curve;
    points.push([Number(lat.toFixed(5)), Number(lon.toFixed(5))]);
  }
  return points;
}

