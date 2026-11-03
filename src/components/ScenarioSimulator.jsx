import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Flame,
  Users,
  Ambulance,
  Building2,
  Navigation,
  Clock,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Crosshair,
  MapPin,
  Truck,
  ArrowRight,
  ShieldAlert,
  Info,
  ChevronRight,
  Calendar,
  Layers,
  Sparkles,
  FileText,
  Activity,
  HeartPulse,
  Database,
  Cpu
} from 'lucide-react';
import {
  SCENARIO_INCIDENT_TYPES,
  PRESET_INCIDENT_LOCATIONS,
  SCENARIO_AMBULANCE_BASES,
  SCENARIO_AMBULANCES,
  calculateHaversineKm
} from '../data/scenarioData';
import { VERIFIED_HOSPITALS } from '../data/mockData';
import { fetchRoadRoute, calculateTwoLegMission } from '../services/routingService';
import {
  buildMedicalRequirements,
  evaluateHospitalCandidate,
  rankEligibleHospitals,
  generateHospitalRecommendationExplanation
} from '../services/hospitalDecision';
import {
  executePulpOptimization,
  buildOptimizationPayload,
  checkBackendHealth
} from '../services/optimizationService';
import OptimizationComparisonPanel from './OptimizationComparisonPanel';
import GisMap from './GisMap';

export default function ScenarioSimulator() {
  // Navigation: incident, medical assessment, ambulance dispatch, hospital decision, response, results
  const [activeStep, setActiveStep] = useState(1);

  // ---------------------------------------------------------------------------
  // Step 1: Incident Creation State
  // ---------------------------------------------------------------------------
  const [incidentType, setIncidentType] = useState('Highway Accident');
  const [incidentTitle, setIncidentTitle] = useState('NH-45 Tambaram Highway Multi-Vehicle Pileup');
  const [incidentLocation, setIncidentLocation] = useState({
    lat: 12.9249,
    lng: 80.1190,
    name: 'NH-45 Tambaram Bypass (Chennai Sector)'
  });
  const [totalCasualties, setTotalCasualties] = useState(4);
  const [criticalCasualties, setCriticalCasualties] = useState(2);
  const [incidentSeverity, setIncidentSeverity] = useState('CRITICAL');
  const [incidentDescription, setIncidentDescription] = useState(
    'Multi-vehicle rear-end collision involving express bus and two passenger cars near Irumbuliyur bridge.'
  );
  const [isPickingLocationOnMap, setIsPickingLocationOnMap] = useState(false);

  // ---------------------------------------------------------------------------
  // Step 3: Ambulance Selection State
  // ---------------------------------------------------------------------------
  // Default to first scenario ambulance
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState(SCENARIO_AMBULANCES[0].id);

  // ---------------------------------------------------------------------------
  // Step 4: Hospital Decision State
  // ---------------------------------------------------------------------------
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [pendingHospitalId, setPendingHospitalId] = useState('');
  const [scenarioHospitalCapacity, setScenarioHospitalCapacity] = useState(4); // Configurable scenario intake buffer
  const [scenarioHospitalWorkload, setScenarioHospitalWorkload] = useState(0); // Configurable scenario current workload
  const [scenarioHospitalWorkloads, setScenarioHospitalWorkloads] = useState({});
  const [useScenarioProfiles, setUseScenarioProfiles] = useState(true); // Toggle scenario clinical capability assumptions

  // ---------------------------------------------------------------------------
  // Step 4: Road Routing State
  // ---------------------------------------------------------------------------
  const [isCalculatingRoutes, setIsCalculatingRoutes] = useState(false);
  const [missionRoutes, setMissionRoutes] = useState(null);
  const [routingError, setRoutingError] = useState(null);
  const [discovery, setDiscovery] = useState({ status: 'searching', hospitals: [], ambulances: [] });
  const [manualHospitalOverride, setManualHospitalOverride] = useState(false);
  const [manualAmbulanceOverride, setManualAmbulanceOverride] = useState(false);
  const [hospitalOverrideReason, setHospitalOverrideReason] = useState('');
  const [hospitalDecisionAudit, setHospitalDecisionAudit] = useState(null);
  const [ambulanceOverrideReason, setAmbulanceOverrideReason] = useState('');

  // ---------------------------------------------------------------------------
  // PuLP Operations Research Optimization State
  // ---------------------------------------------------------------------------
  const [pulpResponse, setPulpResponse] = useState(null);
  const [isPulpSolving, setIsPulpSolving] = useState(false);
  const [pulpError, setPulpError] = useState(null);
  const [pulpObjectiveMode, setPulpObjectiveMode] = useState('weighted_sum');
  const [isPulpSolutionApplied, setIsPulpSolutionApplied] = useState(false);
  const [isContentionMode, setIsContentionMode] = useState(false);

  // ---------------------------------------------------------------------------
  // Step 5: Simulation State Machine Engine
  // ---------------------------------------------------------------------------
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(2); // 1x, 2x, 5x, 10x
  const [elapsedSimSeconds, setElapsedSimSeconds] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('DISPATCH_PENDING');
  const [eventLogs, setEventLogs] = useState([]);
  const [currentVehiclePos, setCurrentVehiclePos] = useState(null);
  const [traveledWaypoints, setTraveledWaypoints] = useState([]);

  const animFrameRef = useRef(null);
  const lastRealTimeRef = useRef(null);

  // Get active ambulance object
  const activeAmbulance =
    SCENARIO_AMBULANCES.find((a) => a.id === selectedAmbulanceId) || SCENARIO_AMBULANCES[0];

  // Helper to load a preset incident
  const handleSelectPreset = (preset) => {
    setIsContentionMode(false);
    setPulpResponse(null);
    setPulpError(null);
    setIsPulpSolutionApplied(false);

    setIncidentTitle(preset.name);
    setIncidentType(preset.type);
    setIncidentSeverity(preset.severity);
    setTotalCasualties(preset.totalCasualties);
    setCriticalCasualties(preset.criticalCasualties);
    setIncidentDescription(preset.description);
    setIncidentLocation({
      lat: preset.lat,
      lng: preset.lng,
      name: preset.name
    });
    // Auto-select a nearby scenario ambulance
    const nearbyAmb = SCENARIO_AMBULANCES.find(
      (a) => a.district.toLowerCase() === preset.district.toLowerCase()
    );
    if (nearbyAmb) setSelectedAmbulanceId(nearbyAmb.id);
  };

  // Helper to load two-incident resource contention scenario
  const handleSelectContentionPreset = () => {
    setIsContentionMode(true);
    setPulpResponse(null);
    setPulpError(null);
    setIsPulpSolutionApplied(false);

    const inc1 = PRESET_INCIDENT_LOCATIONS[0]; // Tambaram
    const inc2 = PRESET_INCIDENT_LOCATIONS[3]; // Katpadi Railway

    setIncidentTitle('Multi-Incident Contention (Tambaram NH-45 + Katpadi Railway)');
    setIncidentType('Highway Accident');
    setIncidentSeverity('CRITICAL');
    setTotalCasualties(inc1.totalCasualties + inc2.totalCasualties); // 18
    setCriticalCasualties(inc1.criticalCasualties + inc2.criticalCasualties); // 7
    setIncidentDescription(
      'Simultaneous emergencies competing for northern Tamil Nadu fleet & hospital beds: NH-45 Tambaram pileup (4 casualties) and Katpadi rail accident (14 casualties).'
    );
    setIncidentLocation({
      lat: inc1.lat,
      lng: inc1.lng,
      name: 'Tambaram Sector (Incident Alpha) + Katpadi Perimeter (Incident Beta)'
    });
    setSelectedAmbulanceId(SCENARIO_AMBULANCES[0].id);
  };

  // Map click handler when user picks location from map
  const handleMapClick = (lat, lng) => {
    if (isPickingLocationOnMap || activeStep === 1) {
      setIncidentLocation({
        lat,
        lng,
        name: `Selected Coordinate [${lat}°N, ${lng}°E]`
      });
      setIsPickingLocationOnMap(false);
    }
  };

  const medicalRequirements = buildMedicalRequirements({ incidentType, incidentSeverity, criticalCasualties });
  const requiredMedicalCapabilities = medicalRequirements.filter((requirement) => requirement.mandatory);
  useEffect(() => {
    setSelectedHospital(null);
    setPendingHospitalId('');
    setManualHospitalOverride(false);
    setHospitalOverrideReason('');
    setHospitalDecisionAudit(null);
    setMissionRoutes(null);
    setRoutingError(null);
    setIsPlaying(false);
    setElapsedSimSeconds(0);
    setEventLogs([]);
    setCurrentPhase('DISPATCH_PENDING');
    setActiveStep((step) => Math.min(step, 4));
  }, [incidentLocation.lat, incidentLocation.lng, incidentType, incidentSeverity, criticalCasualties, totalCasualties]);

  // Sort scenario ambulances by proximity to the incident
  const rankedAmbulances = SCENARIO_AMBULANCES.map((amb) => {
    const directKm = calculateHaversineKm(amb.lat, amb.lng, incidentLocation.lat, incidentLocation.lng);
    const approxRoadKm = directKm * 1.35;
    const approxDurationMins = (approxRoadKm / amb.speedKmph) * 60;
    return {
      ...amb,
      approxRoadKm: Number(approxRoadKm.toFixed(1)),
      approxDurationMins: Number(approxDurationMins.toFixed(1))
    };
  }).sort((a, b) => a.approxRoadKm - b.approxRoadKm);

  // Discovery is geographically bounded before routing: eight nearby hospitals plus
  // the small illustrative ambulance pool. Clinical capability is explicitly unknown.
  useEffect(() => {
    let cancelled = false;
    const nearbyHospitals = VERIFIED_HOSPITALS.map((hospital) => ({
      ...hospital,
      directKm: calculateHaversineKm(incidentLocation.lat, incidentLocation.lng, hospital.lat, hospital.lng)
    })).filter((hospital) => hospital.directKm <= 100).sort((a, b) => a.directKm - b.directKm).slice(0, 8);
    setDiscovery({ status: 'searching', hospitals: [], ambulances: [] });
    const discover = async () => {
      const hospitalResults = [];
      for (const hospital of nearbyHospitals) {
        try {
          const route = await fetchRoadRoute(incidentLocation, hospital);
          hospitalResults.push({ ...hospital, route });
          if (!cancelled) setDiscovery((current) => ({ ...current, hospitals: [...hospitalResults] }));
        } catch (error) { console.warn('Hospital route discovery failed', error); }
      }
      const ambulanceResults = [];
      for (const ambulance of rankedAmbulances) {
        try {
          const route = await fetchRoadRoute(ambulance, incidentLocation);
          ambulanceResults.push({ ...ambulance, route, available: ambulance.status.toLowerCase() === 'available',
            suitable: ambulance.type === 'ALS' && criticalCasualties > 0,
            reason: ambulance.type === 'ALS' ? 'Illustrative ALS profile; scenario capability assumption' : 'Lower acuity profile; critical clinical fit not established' });
          if (!cancelled) setDiscovery((current) => ({ ...current, ambulances: [...ambulanceResults] }));
        } catch (error) { console.warn('Ambulance route discovery failed', error); }
      }
      if (!cancelled) setDiscovery((current) => ({ ...current, status: 'complete' }));
    };
    discover();
    return () => { cancelled = true; };
  }, [incidentLocation.lat, incidentLocation.lng, criticalCasualties]);

  const evaluatedHospitalCandidates = discovery.hospitals.map((hospital) =>
    evaluateHospitalCandidate(
      hospital,
      medicalRequirements,
      scenarioHospitalCapacity,
      scenarioHospitalWorkload,
      totalCasualties,
      useScenarioProfiles
    )
  );
  const rankedEligibleHospitalCandidates = rankEligibleHospitals(evaluatedHospitalCandidates);
  const recommendedHospital = rankedEligibleHospitalCandidates[0] || null;
  const recommendationExplanation = generateHospitalRecommendationExplanation(
    recommendedHospital,
    evaluatedHospitalCandidates,
    { incidentType, incidentSeverity, totalCasualties, criticalCasualties }
  );
  const recommendedAmbulance = [...discovery.ambulances]
    .filter((a) => a.available && a.suitable)
    .sort((a, b) => a.route.durationMins - b.route.durationMins)[0];

  useEffect(() => {
    if (recommendedHospital && !manualHospitalOverride && discovery.status === 'complete') {
      setSelectedHospital(recommendedHospital);
      setHospitalDecisionAudit({
        source: 'SYSTEM RECOMMENDATION',
        hospitalId: recommendedHospital.id,
        reason: recommendationExplanation.summary,
        timestamp: new Date().toISOString()
      });
    } else if (!recommendedHospital && !manualHospitalOverride && discovery.status === 'complete') {
      setSelectedHospital(null);
      setHospitalDecisionAudit(null);
    }
  }, [
    discovery.status,
    recommendedHospital?.id,
    manualHospitalOverride,
    scenarioHospitalCapacity,
    scenarioHospitalWorkload,
    totalCasualties,
    useScenarioProfiles
  ]);

  useEffect(() => {
    if (recommendedAmbulance && !manualAmbulanceOverride && discovery.status === 'complete') {
      setSelectedAmbulanceId(recommendedAmbulance.id);
    }
  }, [discovery.status, recommendedAmbulance?.id, manualAmbulanceOverride]);

  const confirmHospitalOverride = () => {
    const candidate = evaluatedHospitalCandidates.find(
      (hospital) => String(hospital.id) === String(pendingHospitalId)
    );
    if (!candidate || hospitalOverrideReason.trim().length < 5) return;
    setSelectedHospital(candidate);
    setManualHospitalOverride(true);
    setHospitalDecisionAudit({
      source: 'OPERATOR SELECTION',
      hospitalId: candidate.id,
      reason: hospitalOverrideReason.trim(),
      originalRecommendation: recommendedHospital ? recommendedHospital.name : 'None',
      timestamp: new Date().toISOString()
    });
    setRoutingError(null);
  };

  const revertToSystemRecommendation = () => {
    if (recommendedHospital) {
      setSelectedHospital(recommendedHospital);
      setManualHospitalOverride(false);
      setHospitalOverrideReason('');
      setPendingHospitalId('');
      setHospitalDecisionAudit({
        source: 'SYSTEM RECOMMENDATION',
        hospitalId: recommendedHospital.id,
        reason: recommendationExplanation.summary,
        timestamp: new Date().toISOString()
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Action: Calculate Road Routes (OSRM)
  // ---------------------------------------------------------------------------
  const handleCalculateRoutes = async (customAmb = null, customHosp = null) => {
    // Guard against React SyntheticEvent or invalid argument passing
    const ambToUse = (customAmb && typeof customAmb.lat === 'number' && !isNaN(customAmb.lat)) ? customAmb : activeAmbulance;
    const hospToUse = (customHosp && typeof customHosp.lat === 'number' && !isNaN(customHosp.lat)) ? customHosp : selectedHospital;

    if (isCalculatingRoutes || !ambToUse || !hospToUse) {
      if (!hospToUse) setRoutingError('No verified eligible hospital was found. Select an alternative and confirm the operator override with a reason before routing.');
      return;
    }
    setIsCalculatingRoutes(true);
    setRoutingError(null);
    try {
      const ambulanceCoords = { lat: ambToUse.lat, lng: ambToUse.lng };
      const incidentCoords = { lat: incidentLocation.lat, lng: incidentLocation.lng };
      const hospitalCoords = { lat: hospToUse.lat, lng: hospToUse.lng };

      const routes = await calculateTwoLegMission(ambulanceCoords, incidentCoords, hospitalCoords);
      setMissionRoutes(routes);
      initializeLogs();
      setIsCalculatingRoutes(false);
      setActiveStep(5);
    } catch (err) {
      console.error('Error calculating mission routes:', err);
      setRoutingError('Failed to retrieve road geometry. Please try again.');
      setIsCalculatingRoutes(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Action: Execute PuLP Mathematical Optimization via FastAPI
  // ---------------------------------------------------------------------------
  const handleRunPulpOptimization = async () => {
    setIsPulpSolving(true);
    setPulpError(null);
    setIsPulpSolutionApplied(false);

    let incidentsToSolve = [];
    if (isContentionMode) {
      incidentsToSolve = [
        PRESET_INCIDENT_LOCATIONS[0], // HOTSPOT-01 Tambaram
        PRESET_INCIDENT_LOCATIONS[3]  // HOTSPOT-04 Katpadi Railway
      ];
    } else {
      incidentsToSolve = [
        {
          id: 'INC-SIM',
          name: incidentTitle,
          type: incidentType,
          severity: incidentSeverity,
          totalCasualties,
          criticalCasualties,
          lat: incidentLocation.lat,
          lng: incidentLocation.lng,
          description: incidentDescription
        }
      ];
    }

    const payload = buildOptimizationPayload({
      incidents: incidentsToSolve,
      objectiveMode: pulpObjectiveMode,
      alpha: 1.0,
      beta: 1.0,
      M: 10000.0,
      allowUnservedPenalty: true,
      enforceStrictAls: true,
      scenarioHospitalCapacity,
      scenarioHospitalWorkload
    });

    const result = await executePulpOptimization(payload);

    if (result.success) {
      setPulpResponse(result.data);
    } else {
      setPulpError(result.error);
      setPulpResponse(null);
    }

    setIsPulpSolving(false);
  };

  // ---------------------------------------------------------------------------
  // Action: Apply Solver Allocations to Active Mission Simulation
  // ---------------------------------------------------------------------------
  const handleApplyPulpSolution = async () => {
    if (!pulpResponse || !pulpResponse.incident_resolutions?.length) return;

    const firstRes = pulpResponse.incident_resolutions[0];

    // 1. Resolve Dispatched Ambulance
    let ambToDispatch = null;
    if (firstRes.ambulances_dispatched?.length > 0) {
      const topAmbAlloc = firstRes.ambulances_dispatched[0];
      ambToDispatch =
        SCENARIO_AMBULANCES.find(
          (a) => a.baseId === topAmbAlloc.base_id && a.type === topAmbAlloc.ambulance_type
        ) ||
        SCENARIO_AMBULANCES.find((a) => a.baseId === topAmbAlloc.base_id) ||
        activeAmbulance;

      if (ambToDispatch) {
        setSelectedAmbulanceId(ambToDispatch.id);
      }
    }

    // 2. Resolve Designated Hospital
    let hospToAllocate = null;
    if (firstRes.hospitals_allocated?.length > 0) {
      const topHospAlloc = firstRes.hospitals_allocated[0];
      hospToAllocate = VERIFIED_HOSPITALS.find((h) => String(h.id) === String(topHospAlloc.hospital_id));

      if (hospToAllocate) {
        setSelectedHospital(hospToAllocate);
        setHospitalDecisionAudit({
          source: 'PULP MILP SOLVER',
          hospitalId: hospToAllocate.id,
          reason: `PuLP Optimal Allocation: ${topHospAlloc.patients_allocated} casualties (${topHospAlloc.critical_patients_allocated} Critical to Trauma/ICU MCH, ${topHospAlloc.noncritical_patients_allocated} Non-Critical). ETA: ~${topHospAlloc.transport_time_mins}m.`,
          timestamp: new Date().toISOString()
        });
      }
    }

    setIsPulpSolutionApplied(true);

    // 3. Compute Road Routes with Solver Selected Resources
    await handleCalculateRoutes(ambToDispatch || activeAmbulance, hospToAllocate || selectedHospital);
  };

  // ---------------------------------------------------------------------------
  // Simulation State Machine & Clock
  // ---------------------------------------------------------------------------
  // Milestone timestamps in simulated minutes
  const leg1Duration = missionRoutes?.leg1?.durationMins || 8.0;
  const onSceneDuration = 3.0; // 3 minutes on scene for triage & casualty boarding
  const leg2Duration = missionRoutes?.leg2?.durationMins || 14.0;
  const handoverDuration = 1.5; // 1.5 minutes for hospital intake handover

  const dispatchTimeSec = 30; // 0.5 minutes (30 sec) dispatch acknowledgment
  const sceneArrivalTimeSec = dispatchTimeSec + leg1Duration * 60;
  const evacuationStartTimeSec = sceneArrivalTimeSec + onSceneDuration * 60;
  const hospitalArrivalTimeSec = evacuationStartTimeSec + leg2Duration * 60;
  const missionCompleteTimeSec = hospitalArrivalTimeSec + handoverDuration * 60;

  // Append a logged event
  const addEventLog = (timeSec, phase, title, details) => {
    const mins = Math.floor(timeSec / 60);
    const secs = Math.floor(timeSec % 60);
    const formatted = `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    setEventLogs((prev) => [
      ...prev,
      {
        id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        time: formatted,
        timeSec,
        phase,
        title,
        details
      }
    ]);
  };

  // Interpolate vehicle coordinate along waypoint array given fraction 0..1
  const interpolateAlongPath = (coords, t) => {
    if (!coords || coords.length === 0) return null;
    if (coords.length === 1 || t <= 0) return { pos: { lat: coords[0][0], lng: coords[0][1] }, traveled: [coords[0]] };
    if (t >= 1) {
      const last = coords[coords.length - 1];
      return { pos: { lat: last[0], lng: last[1] }, traveled: coords };
    }

    const totalSegs = coords.length - 1;
    const progressPt = t * totalSegs;
    const segIdx = Math.min(Math.floor(progressPt), totalSegs - 1);
    const segFrac = progressPt - segIdx;

    const p1 = coords[segIdx];
    const p2 = coords[segIdx + 1];

    const lat = p1[0] + (p2[0] - p1[0]) * segFrac;
    const lng = p1[1] + (p2[1] - p1[1]) * segFrac;

    const traveled = coords.slice(0, segIdx + 1);
    traveled.push([lat, lng]);

    return { pos: { lat, lng }, traveled };
  };

  // Reset simulation
  const handleResetSimulation = () => {
    setIsPlaying(false);
    setElapsedSimSeconds(0);
    setCurrentPhase('DISPATCH_PENDING');
    setEventLogs([]);
    setCurrentVehiclePos({ lat: activeAmbulance.lat, lng: activeAmbulance.lng });
    setTraveledWaypoints([]);
  };

  // Start / Resume simulation
  const handlePlayPause = () => {
    if (!missionRoutes) {
      setRoutingError('Calculate the road routes before starting the simulation.');
      return;
    }
    const restarting = elapsedSimSeconds >= missionCompleteTimeSec;
    if (restarting) {
      handleResetSimulation();
      initializeLogs();
    } else if (eventLogs.length === 0) {
      initializeLogs();
    }
    setIsPlaying((playing) => restarting || !playing);
  };

  // Initialize event logs on first load of simulation step
  const initializeLogs = () => {
    setEventLogs([
      {
        id: 'evt-init-1',
        time: 'T+00:00',
        timeSec: 0,
        phase: 'INCIDENT_CREATED',
        title: `Incident Logged: ${incidentType}`,
        details: `${incidentTitle} reported with ${totalCasualties} casualties (${criticalCasualties} critical).`
      },
      {
        id: 'evt-init-2',
        time: 'T+00:15',
        timeSec: 15,
        phase: 'AMBULANCE_ASSIGNED',
        title: `Ambulance Assigned: ${activeAmbulance.callsign}`,
        details: `${activeAmbulance.type} unit assigned from ${activeAmbulance.baseName}.`
      }
    ]);
    setCurrentVehiclePos({ lat: activeAmbulance.lat, lng: activeAmbulance.lng });
  };

  // Animation frame loop
  useEffect(() => {
    if (!isPlaying) {
      lastRealTimeRef.current = null;
      return;
    }

    const tick = (timestamp) => {
      if (!lastRealTimeRef.current) lastRealTimeRef.current = timestamp;
      const realDeltaMs = timestamp - lastRealTimeRef.current;
      lastRealTimeRef.current = timestamp;

      // Simulated elapsed seconds = real seconds * speedMultiplier
      const simDeltaSec = (realDeltaMs / 1000) * speedMultiplier;

      setElapsedSimSeconds((prev) => {
        const next = prev + simDeltaSec;

        // Check phase transitions and trigger events
        // 1. Dispatch
        if (prev < dispatchTimeSec && next >= dispatchTimeSec) {
          setCurrentPhase('DISPATCH');
          addEventLog(dispatchTimeSec, 'DISPATCH', 'Emergency Dispatch Confirmed', `${activeAmbulance.callsign} acknowledged and rolling out with sirens active.`);
        }

        // 2. En-Route to Scene
        if (next >= dispatchTimeSec && next < sceneArrivalTimeSec) {
          setCurrentPhase('EN_ROUTE_INCIDENT');
          const frac = (next - dispatchTimeSec) / (sceneArrivalTimeSec - dispatchTimeSec);
          if (missionRoutes?.leg1?.coordinates) {
            const result = interpolateAlongPath(missionRoutes.leg1.coordinates, frac);
            if (result) {
              setCurrentVehiclePos(result.pos);
              setTraveledWaypoints(result.traveled);
            }
          }
        }

        // 3. Scene Arrival
        if (prev < sceneArrivalTimeSec && next >= sceneArrivalTimeSec) {
          setCurrentPhase('SCENE_ARRIVAL');
          addEventLog(
            sceneArrivalTimeSec,
            'SCENE_ARRIVAL',
            'Scene Arrival Confirmed',
            `Unit arrived at incident perimeter [${incidentLocation.lat}, ${incidentLocation.lng}]. Paramedics commencing extrication.`
          );
          setCurrentVehiclePos({ lat: incidentLocation.lat, lng: incidentLocation.lng });
        }

        // 4. On-Scene Evacuation & Triage
        if (next >= sceneArrivalTimeSec && next < evacuationStartTimeSec) {
          setCurrentPhase('EVACUATION');
          setCurrentVehiclePos({ lat: incidentLocation.lat, lng: incidentLocation.lng });
        }

        // 5. Evacuation Departure
        if (prev < evacuationStartTimeSec && next >= evacuationStartTimeSec) {
          setCurrentPhase('EN_ROUTE_HOSPITAL');
          const transported = Math.min(totalCasualties, activeAmbulance.capacityCasualties);
          addEventLog(
            evacuationStartTimeSec,
            'EVACUATION',
            'Casualties Stabilized & Evacuation Commenced',
            `${transported} casualties boarded. En-route to ${selectedHospital?.name || 'operator-selected hospital'}.`
          );
        }

        // 6. En-Route to Hospital
        if (next >= evacuationStartTimeSec && next < hospitalArrivalTimeSec) {
          setCurrentPhase('EN_ROUTE_HOSPITAL');
          const frac = (next - evacuationStartTimeSec) / (hospitalArrivalTimeSec - evacuationStartTimeSec);
          if (missionRoutes?.leg2?.coordinates) {
            const result = interpolateAlongPath(missionRoutes.leg2.coordinates, frac);
            if (result) {
              setCurrentVehiclePos(result.pos);
              setTraveledWaypoints(result.traveled);
            }
          }
        }

        // 7. Hospital Arrival
        if (prev < hospitalArrivalTimeSec && next >= hospitalArrivalTimeSec) {
          setCurrentPhase('HOSPITAL_ARRIVAL');
          addEventLog(
            hospitalArrivalTimeSec,
            'HOSPITAL_ARRIVAL',
            'Arrived at Hospital Receiving Bay',
            `Unit pulled into emergency intake at ${selectedHospital?.name || 'selected hospital'}.`
          );
          if (selectedHospital) setCurrentVehiclePos({ lat: selectedHospital.lat, lng: selectedHospital.lng });
        }

        // 8. Handover Completed
        if (prev < missionCompleteTimeSec && next >= missionCompleteTimeSec) {
          setCurrentPhase('HANDOVER_COMPLETED');
          setIsPlaying(false);
          addEventLog(
            missionCompleteTimeSec,
            'HANDOVER_COMPLETED',
            'Hospital Handover Complete — Mission Concluded',
            `Emergency department transfer signed off. Unit returning to standby.`
          );
          if (selectedHospital) setCurrentVehiclePos({ lat: selectedHospital.lat, lng: selectedHospital.lng });
          return missionCompleteTimeSec;
        }

        return next;
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speedMultiplier, missionRoutes, activeAmbulance, selectedHospital, incidentLocation]);

  // Formatted current time string
  const simMinutes = Math.floor(elapsedSimSeconds / 60);
  const simSeconds = Math.floor(elapsedSimSeconds % 60);
  const clockFormatted = `T+${String(simMinutes).padStart(2, '0')}:${String(simSeconds).padStart(2, '0')}`;

  // Pack active mission data for GisMap
  const missionMapData = {
    incident: {
      ...incidentLocation,
      title: incidentTitle,
      type: incidentType,
      severity: incidentSeverity,
      totalCasualties,
      criticalCasualties,
      description: incidentDescription
    },
    ambulance: activeAmbulance,
    hospital: selectedHospital,
    hospitalDecisionAudit,
    routes: missionRoutes,
    simulationState: {
      isPlaying,
      currentVehiclePos,
      traveledWaypoints,
      currentPhase,
      callsign: activeAmbulance.callsign
    }
  };

  return (
    <div className="scenario-simulator space-y-6">
      {/* 1. Page Header & Workflow Stepper Ribbon */}
      <div className="bg-graphite-900 border border-graphite-border rounded-xl p-5 text-stone-200 shadow-md" style={{ backgroundColor: '#171A1D', color: '#E7E5E4' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-burnt-600 text-white shadow-md shadow-burnt-600/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Single-Incident Emergency Response Simulator
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-tealops-900 text-tealops-200 border border-tealops-700 font-bold uppercase">
                  Decision Support
                </span>
              </div>
              <p className="text-sm text-stone-300 mt-1">
                Assess incident needs, discover nearby response resources, review the system hospital recommendation, and run a routed response simulation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-stone-300">
              Step {activeStep} of 6
            </span>
          </div>
        </div>

        {/* Stepper Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-5 pt-4 border-t border-graphite-border">
          {[
            { num: 1, label: '1. Create Incident' },
            { num: 2, label: '2. Assess Requirements' },
            { num: 3, label: '3. Rank Ambulances' },
            { num: 4, label: '4. Recommend Hospital' },
            { num: 5, label: '5. Routes & Response' },
            { num: 6, label: '6. Mission Results' }
          ].map((s) => (
            <button
              key={s.num}
              disabled={(s.num > activeStep + 1) || (s.num === 5 && (!missionRoutes || !selectedHospital)) || (s.num === 6 && currentPhase !== 'HANDOVER_COMPLETED')}
              onClick={() => {
                if (s.num === activeStep + 1 && s.num === 5) {
                  handleCalculateRoutes();
                } else if (s.num <= activeStep || s.num === activeStep + 1) {
                  setActiveStep(s.num);
                  if (s.num === 5 && eventLogs.length === 0) initializeLogs();
                }
              }}
              className={`p-2.5 rounded-lg text-left text-sm font-semibold transition-all border disabled:cursor-not-allowed disabled:opacity-60 ${
                activeStep === s.num
                  ? 'bg-burnt-600 text-white border-burnt-500 shadow-xs'
                  : s.num < activeStep
                  ? 'bg-graphite-800 text-tealops-300 border-graphite-700'
                  : 'bg-graphite-950 text-stone-200 border-graphite-700'
              }`}
            >
              <div className="text-[10px] font-mono uppercase opacity-75">{s.label.split('.')[0]}</div>
              <div className="truncate text-[11px] mt-0.5">{s.label.split('. ')[1]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Main Work Area: Left Control Panel + Right Interactive Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Active Step Interface (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* ============================================================== */}
          {/* STEP 1: INCIDENT CREATION */}
          {/* ============================================================== */}
          {activeStep === 1 && (
            <div className="bg-white border border-ivory-border rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ivory-border">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <AlertTriangle className="w-4 h-4 text-burnt-600" />
                <span>Step 1: Create Emergency Incident</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-ivory-100 text-stone-600 border border-ivory-border">
                  Scenario Parameters
                </span>
              </div>

              {/* Quick Presets Dropdown */}
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1.5">
                  Load Tamil Nadu Preset Emergency Hotspot:
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {PRESET_INCIDENT_LOCATIONS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`text-left p-2 rounded-lg border text-xs transition-all ${
                        !isContentionMode && incidentLocation.name === preset.name
                          ? 'bg-burnt-50 border-burnt-500 text-burnt-900 font-semibold'
                          : 'bg-ivory-50 border-ivory-border text-stone-700 hover:bg-ivory-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{preset.name}</span>
                        <span className="text-[10px] font-mono uppercase text-stone-500">{preset.district}</span>
                      </div>
                      <div className="text-[11px] text-stone-500 truncate mt-0.5">{preset.type} • {preset.totalCasualties} casualties</div>
                    </button>
                  ))}

                  {/* Multi-Incident Contention Scenario Button */}
                  <button
                    onClick={handleSelectContentionPreset}
                    className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                      isContentionMode
                        ? 'bg-critical-50 border-critical-600 text-critical-900 font-semibold shadow-xs'
                        : 'bg-critical-50/50 border-critical-200 text-stone-800 hover:bg-critical-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-critical-700">
                        <span>⚡ Two-Incident Contention Scenario</span>
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-critical-200 text-critical-900 font-bold uppercase">
                        HOTSPOT 01 + 04
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-600 truncate mt-0.5">
                      Tambaram Highway + Katpadi Railway • 18 total casualties (7 Critical)
                    </div>
                  </button>
                </div>
              </div>

              {/* Incident Type Selector */}
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Incident Type:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Highway Accident', 'Railway Accident', 'Stampede'].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setIncidentType(t);
                        if (t === 'Highway Accident') {
                          setTotalCasualties(4);
                          setCriticalCasualties(2);
                          setIncidentSeverity('CRITICAL');
                        } else if (t === 'Railway Accident') {
                          setTotalCasualties(12);
                          setCriticalCasualties(4);
                          setIncidentSeverity('CRITICAL');
                        } else {
                          setTotalCasualties(8);
                          setCriticalCasualties(2);
                          setIncidentSeverity('HIGH');
                        }
                      }}
                      className={`p-2 rounded-lg border text-xs font-semibold text-center transition-all ${
                        incidentType === t
                          ? 'bg-burnt-600 text-white border-burnt-500 shadow-xs'
                          : 'bg-ivory-50 text-stone-700 border-ivory-border hover:bg-ivory-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    Incident Title:
                  </label>
                  <input
                    type="text"
                    value={incidentTitle}
                    onChange={(e) => setIncidentTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-ivory-50 border border-ivory-border rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-burnt-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    Description:
                  </label>
                  <textarea
                    rows={2}
                    value={incidentDescription}
                    onChange={(e) => setIncidentDescription(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-ivory-50 border border-ivory-border rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-burnt-500/20"
                  />
                </div>
              </div>

              {/* Geographic Coordinates Picker */}
              <div className="p-3 rounded-lg bg-ivory-100/70 border border-ivory-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-burnt-600" />
                    <span>Incident Coordinates</span>
                  </span>
                  <button
                    onClick={() => setIsPickingLocationOnMap(!isPickingLocationOnMap)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                      isPickingLocationOnMap
                        ? 'bg-critical-600 text-white animate-pulse'
                        : 'bg-graphite-800 text-stone-200 hover:bg-graphite-700'
                    }`}
                  >
                    {isPickingLocationOnMap ? 'Clicking Map Active...' : 'Click Map to Relocate'}
                  </button>
                </div>
                <div className="font-mono text-xs text-stone-800 font-bold">
                  {incidentLocation.lat.toFixed(4)}°N, {incidentLocation.lng.toFixed(4)}°E
                </div>
                <div className="text-[11px] text-stone-500 truncate">{incidentLocation.name}</div>
              </div>

              {/* Casualties & Severity Inputs */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                    Total Casualties:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={totalCasualties}
                    onChange={(e) => setTotalCasualties(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-ivory-50 border border-ivory-border rounded-lg text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                    Critical Count:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={totalCasualties}
                    value={criticalCasualties}
                    onChange={(e) =>
                      setCriticalCasualties(Math.min(totalCasualties, Math.max(0, parseInt(e.target.value) || 0)))
                    }
                    className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-ivory-50 border border-ivory-border rounded-lg text-critical-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                    Severity:
                  </label>
                  <select
                    value={incidentSeverity}
                    onChange={(e) => setIncidentSeverity(e.target.value)}
                    className="w-full px-2 py-1 text-xs font-semibold bg-ivory-50 border border-ivory-border rounded-lg text-stone-800"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                  </select>
                </div>
              </div>

              {/* Next Button */}
              <button
                onClick={() => setActiveStep(2)}
                className="w-full py-2.5 rounded-lg bg-burnt-600 hover:bg-burnt-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <span>Confirm Incident & Assess Medical Requirements</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 2: MEDICAL REQUIREMENTS ASSESSMENT */}
          {/* ============================================================== */}
          {activeStep === 2 && (
            <div className="bg-white border border-ivory-border rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-ivory-border pb-3 font-bold text-stone-900 text-sm">
                <HeartPulse className="w-4 h-4 text-critical-600" />
                <span>Step 2: Assess Medical Requirements</span>
              </div>
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                This is a configurable simulation screening profile, not a clinical protocol. Medical control should confirm patient needs.
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-ivory-50 p-3 text-sm">
                <div><b>Incident acuity</b><div className="text-stone-700">{incidentSeverity} · {incidentType}</div></div>
                <div><b>Patients</b><div className="text-stone-700">{totalCasualties} total · {criticalCasualties} critical</div></div>
              </div>
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-700">Mandatory destination checks</div>
                <ul className="space-y-2">
                  {medicalRequirements.filter((requirement) => requirement.mandatory).map((requirement) => (
                    <li key={requirement.key} className="flex items-center justify-between rounded-lg border border-ivory-border bg-white px-3 py-2 text-sm">
                      <span className="font-semibold text-stone-800">{requirement.label}</span>
                      <span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-950">REQUIRED · VERIFY</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs leading-relaxed text-stone-700">Requirements are generated from the selected severity and critical patient count. Hospital capability fields are not present in the verified facility dataset, so missing values will remain UNKNOWN and cannot pass eligibility.</p>
              <div className="flex gap-2">
                <button onClick={() => setActiveStep(1)} className="rounded-lg bg-ivory-200 px-4 py-2 text-sm font-semibold text-stone-800">Back</button>
                <button onClick={() => setActiveStep(3)} className="flex-1 rounded-lg bg-burnt-700 px-4 py-2 text-sm font-bold text-white">Continue to Ambulance Discovery <ArrowRight className="inline h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 3: AMBULANCE RESOURCE SELECTION */}
          {/* ============================================================== */}
          {activeStep === 3 && (
            <div className="bg-white border border-ivory-border rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ivory-border">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <Truck className="w-4 h-4 text-burnt-600" />
                  <span>Step 3: Discover and Rank Ambulances</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-ivory-100 text-stone-600 border border-ivory-border">
                  Scenario Resource Pool
                </span>
              </div>

              {/* Data Transparency Banner */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs">
                <div className="font-bold font-mono text-[11px] uppercase text-amber-950 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  <span>Scenario Data Transparency Rule:</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-900/90">
                  Government 108 records report district-level counts (1,353 units across 38 districts). Station GPS is not published. Below are <strong>explicitly assumed scenario depot bases and vehicles</strong> for dispatch simulation.
                </p>
              </div>

              {/* Ambulance List sorted by proximity */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {rankedAmbulances.map((amb) => {
                  const isSelected = selectedAmbulanceId === amb.id;
                  const isALS = amb.type === 'ALS';
                  return (
                    <div
                      key={amb.id}
                      onClick={() => { setSelectedAmbulanceId(amb.id); setManualAmbulanceOverride(true); }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-burnt-50/80 border-burnt-500 shadow-xs'
                          : 'bg-white border-ivory-border hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-stone-900 text-xs">{amb.id}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                                isALS ? 'bg-burnt-100 text-burnt-800' : 'bg-tealops-100 text-tealops-800'
                              }`}
                            >
                              {amb.type}
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              {amb.status}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-stone-700 mt-1">{amb.callsign}</div>
                          <div className="text-[11px] text-stone-500 mt-0.5">{amb.baseName} ({amb.district})</div>
                        </div>

                        <div className="text-right font-mono">
                          <div className="text-xs font-bold text-burnt-700">~{amb.approxDurationMins}m</div>
                          <div className="text-[10px] text-stone-400">{amb.approxRoadKm} km away</div>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-ivory-border/70 flex items-center justify-between text-[10px] text-stone-500">
                        <span>Capacity: {amb.capacityCasualties} casualty cot</span>
                        <span className="italic text-amber-800">Scenario Assumed Base</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setActiveStep(2)}
                  className="px-4 py-2 rounded-lg bg-ivory-100 hover:bg-ivory-200 text-stone-700 text-xs font-semibold transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setActiveStep(4)}
                  className="flex-1 py-2 rounded-lg bg-burnt-600 hover:bg-burnt-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <span>Confirm Ambulance & Review Hospital Recommendation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 4: SYSTEM HOSPITAL DECISION AND OPERATOR OVERRIDE */}
          {/* ============================================================== */}
          {activeStep === 4 && (
            <div className="bg-white border border-ivory-border rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ivory-border">
                <div>
                  <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                    <Building2 className="w-4 h-4 text-tealops-700" />
                    <span>Step 4: Automatic Hospital Recommendation</span>
                  </div>
                  <div className="text-[11px] text-tealops-800 font-semibold mt-0.5">
                    Principle: &ldquo;Nearest appropriate hospital&rdquo;, NOT &ldquo;nearest hospital&rdquo;
                  </div>
                </div>
                <span className="rounded border border-ivory-border bg-ivory-100 px-2 py-1 text-xs font-bold text-stone-800">
                  {discovery.hospitals.length} nearby candidates
                </span>
              </div>

              {/* PuLP Operations Research Optimization Engine Section */}
              <div className="bg-graphite-900 border border-graphite-border rounded-xl p-4 text-stone-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-graphite-border">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-burnt-400" />
                    <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                      Operations Research Optimisation (PuLP MILP)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-tealops-900 text-tealops-200 border border-tealops-700">
                    FastAPI Engine
                  </span>
                </div>

                <p className="text-xs text-stone-300 leading-relaxed">
                  Calculate globally optimal ambulance dispatch, hospital beds, and patient acuity allocation using Mixed-Integer Linear Programming.
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-stone-400">Mode:</span>
                    <button
                      onClick={() => setPulpObjectiveMode('weighted_sum')}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                        pulpObjectiveMode === 'weighted_sum' ? 'bg-burnt-600 text-white' : 'bg-graphite-800 text-stone-300 hover:bg-graphite-750'
                      }`}
                    >
                      Weighted-Sum
                    </button>
                    <button
                      onClick={() => setPulpObjectiveMode('lexicographic')}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                        pulpObjectiveMode === 'lexicographic' ? 'bg-burnt-600 text-white' : 'bg-graphite-800 text-stone-300 hover:bg-graphite-750'
                      }`}
                    >
                      Lexicographic
                    </button>
                  </div>

                  <button
                    onClick={handleRunPulpOptimization}
                    disabled={isPulpSolving}
                    className="px-4 py-2 rounded-lg bg-burnt-600 hover:bg-burnt-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>{isPulpSolving ? 'Solving with PuLP MILP…' : 'Run PuLP Optimisation'}</span>
                  </button>
                </div>
              </div>

              {/* Render Optimization Comparison Panel if solved, error, or loading */}
              {(pulpResponse || pulpError || isPulpSolving) && (
                <OptimizationComparisonPanel
                  optimizationResponse={pulpResponse}
                  isLoading={isPulpSolving}
                  error={pulpError}
                  onRunOptimization={handleRunPulpOptimization}
                  onApplySolution={handleApplyPulpSolution}
                  isSolutionApplied={isPulpSolutionApplied}
                  scenarioMode={isContentionMode ? 'contention' : 'single'}
                />
              )}

              {/* 1. Primary Recommendation / Status Banner */}
              <div
                className={`rounded-lg border p-3.5 transition-all ${
                  manualHospitalOverride
                    ? 'border-amber-400 bg-amber-50/80'
                    : recommendedHospital
                    ? 'border-tealops-400 bg-tealops-50/90 shadow-xs'
                    : 'border-critical-300 bg-critical-50'
                }`}
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono font-extrabold uppercase px-2 py-0.5 rounded ${
                      manualHospitalOverride
                        ? 'bg-amber-200 text-amber-950 border border-amber-400'
                        : recommendedHospital
                        ? 'bg-tealops-200 text-tealops-900 border border-tealops-400'
                        : 'bg-critical-200 text-critical-900 border border-critical-400'
                    }`}
                  >
                    {discovery.status !== 'complete'
                      ? 'DISCOVERING & VERIFYING CANDIDATES…'
                      : manualHospitalOverride
                      ? 'OPERATOR OVERRIDE ACTIVE'
                      : recommendedHospital
                      ? '★ SYSTEM RECOMMENDATION: NEAREST APPROPRIATE'
                      : 'NO VERIFIED ELIGIBLE DESTINATION'}
                  </span>

                  {manualHospitalOverride && (
                    <button
                      onClick={revertToSystemRecommendation}
                      className="text-[10px] text-tealops-800 hover:text-tealops-900 underline font-bold"
                    >
                      Revert to System Recommendation
                    </button>
                  )}
                </div>

                {/* Content: Recommended Hospital */}
                {!manualHospitalOverride && recommendedHospital && (
                  <div className="mt-2 text-stone-900">
                    <div className="text-base font-extrabold text-tealops-950">{recommendedHospital.name}</div>
                    <div className="flex items-center gap-3 text-xs font-mono font-bold mt-1 text-stone-800">
                      <span className="text-burnt-700">{recommendedHospital.route.durationMins} min ETA</span>
                      <span>•</span>
                      <span>{recommendedHospital.route.distanceKm} road km</span>
                      <span>•</span>
                      <span className="text-tealops-800">{recommendedHospital.district}</span>
                    </div>

                    <p className="mt-1.5 text-xs text-stone-700 leading-relaxed">
                      {recommendationExplanation.summary}
                    </p>

                    {/* Closer Bypassed Facilities Notice */}
                    {recommendationExplanation.bypassedCloser && recommendationExplanation.bypassedCloser.length > 0 && (
                      <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-950 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-[11px] text-amber-900">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span>Bypassed Closer Facilities (Lacked Mandatory Capabilities):</span>
                        </div>
                        {recommendationExplanation.bypassedCloser.map((bypassed, idx) => (
                          <div key={idx} className="text-[11px] pl-5 text-stone-800">
                            <strong>{bypassed.name}</strong> ({bypassed.distanceKm} km, ~{bypassed.durationMins}m) — <span className="text-critical-700 font-semibold">{bypassed.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Content: Operator Override Selected */}
                {manualHospitalOverride && selectedHospital && (
                  <div className="mt-2 text-stone-900">
                    <div className="text-sm font-bold text-amber-950">
                      Current Selection: <strong>{selectedHospital.name}</strong>
                    </div>
                    <div className="text-xs text-stone-700 mt-0.5">
                      Road Distance: {selectedHospital.route?.distanceKm} km • ETA: ~{selectedHospital.route?.durationMins} min
                    </div>
                    {hospitalDecisionAudit?.reason && (
                      <div className="mt-1.5 p-2 rounded bg-white/80 border border-amber-300 text-xs text-stone-800">
                        <span className="font-bold text-amber-950">Recorded Rationale:</span> {hospitalDecisionAudit.reason}
                      </div>
                    )}
                    {recommendedHospital && (
                      <div className="mt-1 text-[11px] text-stone-600">
                        Original System Recommendation: <em>{recommendedHospital.name}</em>
                      </div>
                    )}
                  </div>
                )}

                {/* Content: No Eligible Destination */}
                {!recommendedHospital && !manualHospitalOverride && discovery.status === 'complete' && (
                  <div className="mt-2 text-xs text-critical-950 space-y-1.5">
                    <p className="font-semibold leading-relaxed">
                      Medical-control review required. Unknown or unmet mandatory capabilities exclude every candidate from automated recommendation.
                    </p>
                    <p className="text-[11px] text-stone-700">
                      In accordance with PALS Data Integrity Rules, unverified facilities are never assumed suitable. To dispatch an ambulance, an authorized operator must select an alternative below and record a clinical/operational justification.
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Simulation Screening Parameters & Scenario Profile Toggle */}
              <div className="rounded-lg border border-ivory-border bg-ivory-50 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-ivory-border pb-2">
                  <span className="text-xs font-extrabold uppercase text-stone-800">
                    Clinical Screening & Capacity Assumptions
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={useScenarioProfiles}
                      onChange={(e) => setUseScenarioProfiles(e.target.checked)}
                      className="rounded text-burnt-600 focus:ring-burnt-500"
                    />
                    <span>Scenario Clinical Profiles</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {requiredMedicalCapabilities.map((req) => (
                    <span
                      key={req.key}
                      className="rounded border border-amber-300 bg-amber-100/80 px-2 py-0.5 text-[11px] font-bold text-amber-950"
                    >
                      {req.label}: MANDATORY
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="font-semibold text-stone-800">
                    Scenario receiving capacity per facility
                    <input
                      type="number"
                      min="1"
                      value={scenarioHospitalCapacity}
                      onChange={(e) => setScenarioHospitalCapacity(Math.max(1, Number(e.target.value) || 1))}
                      className="mt-1 block w-full rounded border border-ivory-border bg-white px-2 py-1.5 text-xs text-stone-900"
                    />
                  </label>
                  <label className="font-semibold text-stone-800">
                    Simulated current workload
                    <input
                      type="number"
                      min="0"
                      value={scenarioHospitalWorkload}
                      onChange={(e) => setScenarioHospitalWorkload(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 block w-full rounded border border-ivory-border bg-white px-2 py-1.5 text-xs text-stone-900"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-stone-500 italic">
                  Note: The official 108 dataset contains no live bed counts or capability telemetry. Clinical profiles and capacity buffers are configurable scenario assumptions.
                </p>
              </div>

              {/* 3. Routed Alternatives List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-extrabold uppercase text-stone-800">
                  <span>Evaluated Candidates ({evaluatedHospitalCandidates.length})</span>
                  <span className="text-[10px] font-normal text-stone-500">Sorted by Road ETA</span>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {evaluatedHospitalCandidates
                    .slice()
                    .sort((a, b) => (a.route?.durationMins ?? Infinity) - (b.route?.durationMins ?? Infinity))
                    .map((hospital) => {
                      const isRec = recommendedHospital?.id === hospital.id;
                      const isPending = String(pendingHospitalId) === String(hospital.id);
                      const isSel = selectedHospital?.id === hospital.id;

                      return (
                        <div
                          key={hospital.id}
                          className={`rounded-lg border p-3 transition-all ${
                            isPending || isSel
                              ? 'border-burnt-500 bg-burnt-50/70 shadow-xs'
                              : isRec
                              ? 'border-tealops-400 bg-tealops-50/40'
                              : 'border-ivory-border bg-white'
                          }`}
                        >
                          <button
                            onClick={() => setPendingHospitalId(String(hospital.id))}
                            className="w-full text-left"
                            aria-pressed={isPending}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-xs font-bold text-stone-900">{hospital.name}</span>
                                {isRec && (
                                  <span className="ml-2 text-[10px] bg-tealops-100 text-tealops-900 px-1.5 py-0.2 rounded font-mono font-bold">
                                    ★ SYSTEM REC
                                  </span>
                                )}
                              </div>
                              <span className="shrink-0 font-mono text-xs font-bold text-stone-900">
                                {hospital.route
                                  ? `${hospital.route.durationMins} min · ${hospital.route.distanceKm} km`
                                  : 'ROUTING…'}
                              </span>
                            </div>

                            <div className="mt-1 flex justify-between gap-2 text-[11px] text-stone-600">
                              <span>{hospital.type} • {hospital.district}</span>
                              <b
                                className={`font-mono text-[10px] font-bold ${
                                  hospital.eligibility === 'ELIGIBLE'
                                    ? 'text-tealops-800'
                                    : hospital.eligibility === 'INELIGIBLE'
                                    ? 'text-critical-700'
                                    : 'text-stone-600'
                                }`}
                              >
                                {hospital.eligibility}
                              </b>
                            </div>

                            <div className="mt-1 text-[11px] font-medium text-stone-700">
                              {hospital.rejectionReason}
                            </div>
                          </button>

                          <details className="mt-2 text-[11px] text-stone-600 border-t border-ivory-border/60 pt-1.5">
                            <summary className="cursor-pointer font-semibold text-stone-700 hover:text-stone-900">
                              Inspect Capability & Capacity Breakdown
                            </summary>
                            <ul className="mt-1.5 space-y-0.5 font-mono text-[10px]">
                              {hospital.capabilityChecks.map((check) => (
                                <li key={check.key} className="flex justify-between">
                                  <span>{check.label}:</span>
                                  <b
                                    className={
                                      check.status === 'PASS'
                                        ? 'text-emerald-700'
                                        : check.status === 'FAIL'
                                        ? 'text-critical-700'
                                        : 'text-stone-500'
                                    }
                                  >
                                    {check.status}
                                  </b>
                                </li>
                              ))}
                              <li className="flex justify-between">
                                <span>Configured Free Capacity:</span>
                                <b>{hospital.freeScenarioCapacity ?? 'UNKNOWN'} ({hospital.capacityStatus})</b>
                              </li>
                              <li className="flex justify-between">
                                <span>Simulated Workload:</span>
                                <span>{hospital.simulatedWorkload}</span>
                              </li>
                            </ul>
                          </details>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 4. Optional Operator Override Controls */}
              <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3.5 space-y-2">
                <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span>Optional Operator / Medical Control Override</span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  To override the automated recommendation or dispatch to an unverified candidate, select a facility above and document the clinical authorization reason.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-stone-800">
                    Override Justification (Required, min 5 chars):
                  </label>
                  <textarea
                    value={hospitalOverrideReason}
                    onChange={(e) => setHospitalOverrideReason(e.target.value)}
                    rows={2}
                    placeholder="Document clinical protocol, physician order, or specific intake coordination reason..."
                    className="mt-1 w-full rounded border border-amber-300 bg-white p-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <button
                  onClick={confirmHospitalOverride}
                  disabled={!pendingHospitalId || hospitalOverrideReason.trim().length < 5 || discovery.status !== 'complete'}
                  className="w-full py-2 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold disabled:cursor-not-allowed disabled:bg-stone-400 transition-colors shadow-xs"
                >
                  Record & Authorize Operator Override
                </button>
              </div>

              {routingError && (
                <p role="alert" className="rounded-lg border border-critical-200 bg-critical-50 px-3 py-2 text-xs font-semibold text-critical-800">
                  {routingError}
                </p>
              )}

              {/* Step Navigation */}
              <div className="flex gap-2 border-t border-ivory-border pt-3">
                <button
                  onClick={() => setActiveStep(3)}
                  className="px-4 py-2 rounded-lg bg-ivory-100 hover:bg-ivory-200 text-stone-700 text-xs font-semibold transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => handleCalculateRoutes()}
                  disabled={isCalculatingRoutes || !selectedHospital}
                  className="flex-1 py-2.5 rounded-lg bg-burnt-600 hover:bg-burnt-500 text-white text-xs font-bold disabled:cursor-not-allowed disabled:bg-stone-400 transition-colors shadow-xs flex items-center justify-center gap-2"
                >
                  <span>
                    {isCalculatingRoutes
                      ? 'Calculating Mission Routes…'
                      : selectedHospital
                      ? `Accept Destination & Calculate Routes (${selectedHospital.name.split(' ')[0]})`
                      : 'Destination Decision Required'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 5: ROUTES AND RESPONSE */}
          {/* ============================================================== */}
          {activeStep === 5 && missionRoutes && selectedHospital && (
            <div className="bg-white border border-ivory-border rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ivory-border">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <Navigation className="w-4 h-4 text-burnt-600" />
                  <span>Step 5: Calculate Routes & Run Response</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    missionRoutes?.isRealRoadRoute
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {missionRoutes?.isRealRoadRoute ? 'OSRM Road Router' : 'Geometric Fallback'}
                </span>
              </div>

              {routingError && (
                <div className="p-3 rounded-lg bg-critical-50 border border-critical-200 text-critical-800 text-xs">
                  {routingError}
                </div>
              )}

              {/* Mission Summary Cards */}
              <div className="space-y-3">
                {/* Leg 1 */}
                <div className="p-3 rounded-xl bg-ivory-50 border border-ivory-border">
                  <div className="flex items-center justify-between text-xs font-bold text-stone-800">
                    <span className="flex items-center gap-1.5 text-burnt-600">
                      <Truck className="w-3.5 h-3.5" />
                      <span>Leg 1: Base to Incident</span>
                    </span>
                    <span className="font-mono text-burnt-700">~{missionRoutes?.leg1?.durationMins} mins</span>
                  </div>
                  <div className="text-[11px] text-stone-600 mt-1">
                    From: <strong>{activeAmbulance.baseName}</strong>
                  </div>
                  <div className="text-[11px] text-stone-600">
                    To: <strong>{incidentLocation.name}</strong>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-ivory-border text-[10px] text-stone-500 flex justify-between font-mono">
                    <span>Distance: {missionRoutes?.leg1?.distanceKm} km</span>
                    <span>Waypoints: {missionRoutes?.leg1?.coordinates?.length || 0}</span>
                  </div>
                </div>

                {/* Leg 2 */}
                <div className="p-3 rounded-xl bg-ivory-50 border border-ivory-border">
                  <div className="flex items-center justify-between text-xs font-bold text-stone-800">
                    <span className="flex items-center gap-1.5 text-tealops-700">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Leg 2: Incident to Hospital</span>
                    </span>
                    <span className="font-mono text-tealops-800">~{missionRoutes?.leg2?.durationMins} mins</span>
                  </div>
                  <div className="text-[11px] text-stone-600 mt-1">
                    From: <strong>{incidentLocation.name}</strong>
                  </div>
                  <div className="text-[11px] text-stone-600">
                    To: <strong>{selectedHospital.name}</strong>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-ivory-border text-[10px] text-stone-500 flex justify-between font-mono">
                    <span>Distance: {missionRoutes?.leg2?.distanceKm} km</span>
                    <span>Waypoints: {missionRoutes?.leg2?.coordinates?.length || 0}</span>
                  </div>
                </div>

                {/* Totals Ribbon */}
                <div className="p-3 rounded-xl bg-graphite-900 text-stone-200 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-stone-400 block">TOTAL MISSION ROAD DISTANCE</span>
                    <span className="text-base font-extrabold text-burnt-400">{missionRoutes?.totalDistanceKm} km</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 block">ESTIMATED TRANSIT TIME</span>
                    <span className="text-base font-extrabold text-tealops-300">{missionRoutes?.totalDurationMins} mins</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setActiveStep(4)}
                  className="px-4 py-2 rounded-lg bg-ivory-100 hover:bg-ivory-200 text-stone-700 text-xs font-semibold transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    handleResetSimulation();
                    initializeLogs();
                    setActiveStep(5);
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-burnt-600 hover:bg-burnt-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Launch Event Simulation</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 5: EVENT-DRIVEN SIMULATION CONTROLS & LOG */}
          {/* ============================================================== */}
          {activeStep === 5 && (
            <div className="bg-white border border-ivory-border rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ivory-border">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <Activity className="w-4 h-4 text-burnt-600" />
                  <span>Step 5: Event-Driven Simulation Playback</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-burnt-100 text-burnt-800 font-bold uppercase">
                  Time-Based State Machine
                </span>
              </div>

              {/* Simulation Clock & Timeline Controls Card */}
              <div className="bg-graphite-900 rounded-xl p-4 text-stone-200 border border-graphite-border space-y-3" style={{ backgroundColor: '#171A1D', color: '#E7E5E4' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono">
                    <Clock className="w-4 h-4 text-burnt-400" />
                    <span className="text-xs text-stone-400">Clock:</span>
                    <span className="text-lg font-extrabold text-white tracking-widest">{clockFormatted}</span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      currentPhase === 'HANDOVER_COMPLETED'
                        ? 'bg-emerald-900 text-emerald-200 border border-emerald-700'
                        : isPlaying
                        ? 'bg-burnt-900 text-burnt-200 border border-burnt-700 animate-pulse'
                        : 'bg-graphite-800 text-stone-400'
                    }`}
                  >
                    {currentPhase.replace('_', ' ')}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-graphite-950 h-2.5 rounded-full overflow-hidden border border-graphite-800">
                  <div
                    className="bg-gradient-to-r from-burnt-600 via-burnt-500 to-tealops-500 h-full transition-all duration-100"
                    style={{
                      width: `${Math.min(100, (elapsedSimSeconds / missionCompleteTimeSec) * 100)}%`
                    }}
                  />
                </div>

                {/* Play, Pause, Reset, Speed Multipliers */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePlayPause}
                      aria-label={isPlaying ? 'Pause emergency simulation' : elapsedSimSeconds > 0 ? 'Resume emergency simulation' : 'Start emergency simulation'}
                      className={`min-h-11 min-w-32 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md border border-white/25 ${
                        isPlaying
                          ? 'bg-caution-700 hover:bg-caution-800 text-white'
                          : 'bg-burnt-700 hover:bg-burnt-800 text-white'
                      }`}
                      style={{ backgroundColor: isPlaying ? '#B45309' : '#C2410C', color: '#FFFFFF' }}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{elapsedSimSeconds > 0 ? 'Resume Simulation' : 'Start Simulation'}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleResetSimulation}
                      className="min-h-11 px-3 py-2 rounded-lg text-sm font-semibold bg-graphite-800 hover:bg-graphite-750 text-stone-100 border border-graphite-700 flex items-center gap-2"
                      style={{ backgroundColor: '#252A2F', color: '#F5F5F4' }}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>

                  {/* Speed Controls: 1x, 2x, 5x, 10x */}
                  <div className="flex items-center gap-1 bg-graphite-950 p-1 rounded-lg border border-graphite-800 text-xs font-mono" style={{ backgroundColor: '#101214' }}>
                    <span className="text-xs text-stone-300 px-1.5 font-sans">Speed:</span>
                    {[1, 2, 5, 10].map((multiplier) => (
                      <button
                        key={multiplier}
                        onClick={() => setSpeedMultiplier(multiplier)}
                        aria-pressed={speedMultiplier === multiplier}
                        className={`min-h-9 min-w-10 px-2 py-1 rounded text-sm font-bold transition-colors ${
                          speedMultiplier === multiplier ? 'bg-burnt-600 text-white' : 'text-stone-300 hover:text-white'
                        }`}
                        style={{ color: speedMultiplier === multiplier ? '#FFFFFF' : '#D6D3D1', backgroundColor: speedMultiplier === multiplier ? '#D9531E' : 'transparent' }}
                      >
                        {multiplier}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Real-time Vehicle Telemetry Panel */}
              <div className="p-3 rounded-xl bg-ivory-50 border border-ivory-border">
                <div className="flex items-center justify-between text-xs font-bold text-stone-800 mb-2">
                  <span className="flex items-center gap-1.5 text-stone-900">
                    <Truck className="w-3.5 h-3.5 text-burnt-600" />
                    <span>Unit: {activeAmbulance.callsign} ({activeAmbulance.type})</span>
                  </span>
                  <span className="font-mono text-emerald-700 font-semibold">
                    {isPlaying ? 'EN ROUTE' : 'HOLDING'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-stone-400 block text-[10px]">CURRENT POSITION</span>
                    <span className="font-semibold text-stone-800">
                      {currentVehiclePos ? `${currentVehiclePos.lat.toFixed(4)}, ${currentVehiclePos.lng.toFixed(4)}` : 'Station Base'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">DESTINATION</span>
                    <span className="font-semibold text-stone-800 truncate block">
                      {currentPhase === 'EN_ROUTE_HOSPITAL' || currentPhase === 'HOSPITAL_ARRIVAL' || currentPhase === 'HANDOVER_COMPLETED'
                        ? selectedHospital?.name || 'No destination confirmed'
                        : incidentLocation.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Event Log Stream */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-stone-800 uppercase font-mono">
                    Real-Time Event Log ({eventLogs.length})
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono">Live Timecode</span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {eventLogs.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2 rounded-lg bg-ivory-50 border border-ivory-border text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-burnt-700 text-[11px]">{evt.time}</span>
                        <span className="text-[9px] font-mono px-1 rounded bg-graphite-100 text-stone-700 border border-stone-200">
                          {evt.phase}
                        </span>
                      </div>
                      <div className="font-bold text-stone-900 text-[11px]">{evt.title}</div>
                      <p className="text-[10px] text-stone-600 leading-tight">{evt.details}</p>
                    </div>
                  ))}
                </div>
              </div>

              {currentPhase === 'HANDOVER_COMPLETED' && (
                <button
                  onClick={() => setActiveStep(6)}
                  className="w-full py-2.5 rounded-lg bg-tealops-700 hover:bg-tealops-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs animate-bounce-short"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Complete Mission Debrief Report &rarr;</span>
                </button>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 6: SIMULATION RESULTS & DEBRIEF */}
          {/* ============================================================== */}
          {activeStep === 6 && (
            <div className="bg-white border border-ivory-border rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ivory-border">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <FileText className="w-4 h-4 text-tealops-700" />
                  <span>Step 6: Mission Results & Performance Debrief</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase">
                  Simulation Finished
                </span>
              </div>

              {/* Mission Summary Stats Ribbon */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border">
                  <span className="text-stone-400 block text-[10px]">TOTAL MISSION TIME</span>
                  <span className="text-base font-extrabold font-mono text-stone-900">
                    {(missionCompleteTimeSec / 60).toFixed(1)} mins
                  </span>
                  <span className="text-[10px] text-stone-500 block mt-0.5">Dispatch to ER Handover</span>
                </div>
                <div className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border">
                  <span className="text-stone-400 block text-[10px]">TOTAL ROAD DISTANCE</span>
                  <span className="text-base font-extrabold font-mono text-burnt-700">
                    {missionRoutes?.totalDistanceKm || 0} km
                  </span>
                  <span className="text-[10px] text-stone-500 block mt-0.5">Calculated via OSRM</span>
                </div>
              </div>

              {/* Casualty Transport Outcomes */}
              <div className="p-3 rounded-xl bg-ivory-50 border border-ivory-border space-y-2">
                <div className="text-xs font-bold text-stone-900 flex items-center justify-between">
                  <span>Casualty Outcome Analysis:</span>
                  <span className="font-mono text-tealops-800">
                    Capacity: {activeAmbulance.capacityCasualties} cots
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-white border border-ivory-border">
                    <span className="text-stone-400 block text-[10px]">CASUALTIES TRANSPORTED</span>
                    <span className="text-sm font-bold text-emerald-700">
                      {Math.min(totalCasualties, activeAmbulance.capacityCasualties)} of {totalCasualties}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-ivory-border">
                    <span className="text-stone-400 block text-[10px]">REMAINING CASUALTIES</span>
                    <span
                      className={`text-sm font-bold ${
                        totalCasualties > activeAmbulance.capacityCasualties
                          ? 'text-critical-700'
                          : 'text-stone-500'
                      }`}
                    >
                      {Math.max(0, totalCasualties - activeAmbulance.capacityCasualties)} unserved
                    </span>
                  </div>
                </div>
                {totalCasualties > activeAmbulance.capacityCasualties && (
                  <div className="text-[10px] text-critical-800 bg-critical-50 p-2 rounded border border-critical-200">
                    *Incident casualty volume exceeded single-unit capacity. Multi-unit dispatch required for remaining casualties in Stage 4.
                  </div>
                )}
              </div>

              {/* Timeline Breakdown Table */}
              <div className="border border-ivory-border rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-ivory-100 text-[10px] text-stone-600 font-mono uppercase">
                    <tr>
                      <th className="py-2 px-3">Milestone Event</th>
                      <th className="py-2 px-3 text-right">Timecode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ivory-border font-mono text-[11px]">
                    <tr>
                      <td className="py-1.5 px-3">Incident Alarm Created</td>
                      <td className="py-1.5 px-3 text-right">T+00:00</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3">Ambulance Dispatch Acknowledged</td>
                      <td className="py-1.5 px-3 text-right">T+00:30</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3">Scene Arrival (Incident Perimeter)</td>
                      <td className="py-1.5 px-3 text-right">
                        T+{Math.floor(sceneArrivalTimeSec / 60)}:{String(Math.floor(sceneArrivalTimeSec % 60)).padStart(2, '0')}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3">Casualty Stabilization & Evac Departure</td>
                      <td className="py-1.5 px-3 text-right">
                        T+{Math.floor(evacuationStartTimeSec / 60)}:{String(Math.floor(evacuationStartTimeSec % 60)).padStart(2, '0')}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3">Hospital Gate Arrival ({selectedHospital?.name || 'No destination confirmed'})</td>
                      <td className="py-1.5 px-3 text-right">
                        T+{Math.floor(hospitalArrivalTimeSec / 60)}:{String(Math.floor(hospitalArrivalTimeSec % 60)).padStart(2, '0')}
                      </td>
                    </tr>
                    <tr className="bg-emerald-50 text-emerald-950 font-bold">
                      <td className="py-1.5 px-3">Emergency Handover Complete</td>
                      <td className="py-1.5 px-3 text-right">
                        T+{Math.floor(missionCompleteTimeSec / 60)}:{String(Math.floor(missionCompleteTimeSec % 60)).padStart(2, '0')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* PuLP Solver Comparative Debrief */}
              {pulpResponse && (
                <div className="space-y-2 pt-2 border-t border-ivory-border">
                  <div className="text-xs font-bold uppercase tracking-wider text-stone-800 font-mono">
                    PuLP Mathematical Optimisation Performance
                  </div>
                  <OptimizationComparisonPanel
                    optimizationResponse={pulpResponse}
                    isLoading={false}
                    error={null}
                    onRunOptimization={handleRunPulpOptimization}
                    scenarioMode={isContentionMode ? 'contention' : 'single'}
                  />
                </div>
              )}

              {/* Data Transparency Audit Statement */}
              <div className="p-3 rounded-lg bg-ivory-100/70 border border-ivory-border text-[10px] text-stone-600 space-y-1">
                <div className="font-bold text-stone-800 uppercase font-mono">Dataset Provenance Audit:</div>
                <p>• <strong>Verified Data Used:</strong> 339 hospital facility records and coordinates; OpenStreetMap road network geometry via OSRM.</p>
                <p>• <strong>Scenario Assumptions:</strong> Illustrative ambulance base depot and vehicle availability (official 108 records aggregate by district); hospital intake capacity buffer.</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    handleResetSimulation();
                    setActiveStep(1);
                  }}
                  className="w-full py-2 rounded-lg bg-burnt-600 hover:bg-burnt-500 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  Configure New Emergency Incident
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live GIS Map Viewport (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-ivory-border">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-900 font-mono uppercase">
                <Navigation className="w-3.5 h-3.5 text-burnt-600" />
                <span>Mission GIS Operations Map</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-stone-500">
                <span className="w-2 h-2 rounded-full bg-burnt-500 inline-block" />
                <span>Leg 1: Base &rarr; Incident</span>
                <span className="w-2 h-2 rounded-full bg-tealops-600 inline-block ml-2" />
                <span>Leg 2: Incident &rarr; Hospital</span>
              </div>
            </div>

            {/* Embedded GisMap connected to active simulation mission */}
            <GisMap
              onMapClick={handleMapClick}
              selectedIncident={null}
              selectedUnit={null}
              selectedHospital={selectedHospital}
              missionData={missionMapData}
              discoveryData={{ ...discovery, hospitals: evaluatedHospitalCandidates }}
            />

            <section className="mt-3 rounded-lg border border-ivory-border bg-ivory-50 p-3 text-xs" aria-live="polite">
              <div className="flex items-center justify-between border-b border-ivory-border pb-2">
                <strong className="text-stone-900">LIVE RESOURCE DISCOVERY</strong>
                <span className={`rounded px-2 py-1 font-mono text-[10px] font-bold ${discovery.status === 'complete' ? 'bg-tealops-100 text-tealops-900' : 'bg-amber-100 text-amber-950 animate-pulse'}`}>
                  {discovery.status === 'complete' ? 'ROUTES CALCULATED' : 'SEARCHING NEARBY RESOURCES'}
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-3 pt-3">
                <div>
                  <div className="font-bold text-stone-800">HOSPITAL ANALYSIS <span className="font-normal text-stone-600">{discovery.hospitals.length} / 8 discovered</span></div>
                  {recommendedHospital ? <div className="mt-1 rounded border border-burnt-300 bg-white p-2 text-stone-800">
                    <b className="text-burnt-800">Recommended: {recommendedHospital.name}</b>
                    <div>{recommendedHospital.route.distanceKm} km • {recommendedHospital.route.durationMins} min • {recommendedHospital.route.isRealRoadRoute ? 'OSRM road route' : 'Estimated fallback route'}</div>
                    <div>Capacity assumption: {recommendedHospital.eligible ? 'passes' : 'fails'} • Clinical capability: UNKNOWN</div>
                    <div className="text-stone-700">{recommendedHospital.reason}</div>
                  </div> : <p className="mt-1 text-stone-700">No eligible routed candidate yet. Clinical capability is unverified for all facilities.</p>}
                  <ul className="mt-1 max-h-32 space-y-1 overflow-auto text-[11px] text-stone-700">
                    {discovery.hospitals.map((h) => <li key={h.id} className="flex justify-between gap-2"><span className="truncate">{h.name} · {h.eligible ? 'eligible by capacity assumption' : h.reason}</span><span className="shrink-0">{h.route.durationMins}m{h.route.isFallback ? ' est.' : ''}</span></li>)}
                  </ul>
                </div>
                <div>
                  <div className="font-bold text-stone-800">AMBULANCE ANALYSIS <span className="font-normal text-stone-600">{discovery.ambulances.length} found</span></div>
                  {recommendedAmbulance ? <div className="mt-1 rounded border border-burnt-300 bg-white p-2 text-stone-800">
                    <b className="text-burnt-800">Recommended: {recommendedAmbulance.id} ({recommendedAmbulance.type})</b>
                    <div>{recommendedAmbulance.route.distanceKm} km • {recommendedAmbulance.route.durationMins} min • {recommendedAmbulance.baseName}</div>
                    <div>Available • {recommendedAmbulance.reason} • illustrative origin</div>
                  </div> : <p className="mt-1 text-stone-700">Calculating routes and checking scenario resource profiles…</p>}
                  <ul className="mt-1 max-h-32 space-y-1 overflow-auto text-[11px] text-stone-700">
                    {discovery.ambulances.map((a) => <li key={a.id} className="flex justify-between gap-2"><span>{a.id} · {a.type} · {a.reason}</span><span className="shrink-0">{a.route.durationMins}m{a.route.isFallback ? ' est.' : ''}</span></li>)}
                  </ul>
                </div>
              </div>
              <p className="mt-2 border-t border-ivory-border pt-2 text-[10px] text-stone-700">Routes are calculated progressively for up to 8 hospitals within 100 km and the illustrative ambulance pool. OSRM failures use labeled estimates. Facility clinical capability and live beds remain UNKNOWN; the intake buffer is a scenario assumption.</p>
              {manualHospitalOverride && <label className="mt-2 block text-[11px] font-semibold text-stone-800">Manual hospital selection reason
                <input value={hospitalOverrideReason} onChange={(event) => setHospitalOverrideReason(event.target.value)} placeholder="Enter operational reason" className="mt-1 w-full rounded border border-ivory-border bg-white px-2 py-1 text-stone-900" />
              </label>}
              {manualAmbulanceOverride && <label className="mt-2 block text-[11px] font-semibold text-stone-800">Manual ambulance selection reason
                <input value={ambulanceOverrideReason} onChange={(event) => setAmbulanceOverrideReason(event.target.value)} placeholder="Enter dispatch reason" className="mt-1 w-full rounded border border-ivory-border bg-white px-2 py-1 text-stone-900" />
              </label>}
            </section>

            {/* Mission Key Details Footer */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-ivory-50 border border-ivory-border">
                <span className="text-[10px] text-stone-400 block font-sans">INCIDENT SITE</span>
                <span className="font-bold text-stone-900 truncate block">{incidentLocation.name}</span>
                <span className="text-[10px] text-critical-700">{totalCasualties} casualties ({incidentSeverity})</span>
              </div>

              <div className="p-2 rounded-lg bg-ivory-50 border border-ivory-border">
                <span className="text-[10px] text-stone-400 block font-sans">DISPATCHED UNIT</span>
                <span className="font-bold text-burnt-700 truncate block">{activeAmbulance.callsign}</span>
                <span className="text-[10px] text-stone-500">{activeAmbulance.type} • {activeAmbulance.baseName.split(' ')[0]}</span>
              </div>

              <div className="p-2 rounded-lg bg-ivory-50 border border-ivory-border">
                <span className="text-[10px] text-stone-400 block font-sans">TARGET HOSPITAL</span>
                <span className="font-bold text-tealops-800 truncate block">{selectedHospital?.name || 'No verified destination'}</span>
                <span className="text-[10px] text-stone-500">{selectedHospital ? `${selectedHospital.district} (${selectedHospital.type || 'Hospital'})` : 'Operator review required'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
