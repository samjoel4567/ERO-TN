import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import CommandCentreView from './components/CommandCentreView';
import GisMap from './components/GisMap';
import SimulationController from './components/SimulationController';
import ScenarioSimulator from './components/ScenarioSimulator';
import CardiacArrestView from './components/CardiacArrestView';
import AmbulanceFleetView from './components/AmbulanceFleetView';
import HospitalNetworkView from './components/HospitalNetworkView';
import RescueTeamsView from './components/RescueTeamsView';
import OptimisationResultsView from './components/OptimisationResultsView';
import AnalyticsView from './components/AnalyticsView';
import ErrorBoundary from './components/ErrorBoundary';
import { BENCHMARK_INCIDENTS, FLEET_UNITS, MAPPED_HOSPITALS } from './data/mockData';

export default function App() {
  const [activeNav, setActiveNav] = useState('Command Centre');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Selection states across views
  const [selectedIncident, setSelectedIncident] = useState(BENCHMARK_INCIDENTS[0]);
  const [selectedUnit, setSelectedUnit] = useState(FLEET_UNITS[0]);
  const [selectedHospital, setSelectedHospital] = useState(MAPPED_HOSPITALS[0]);

  // Simulation execution state
  const [simulationState, setSimulationState] = useState({
    isPlaying: false,
    progress: 0,
    currentVehiclePos: null,
    traveledWaypoints: null,
    phase: 'Idle'
  });

  const [isOptimizing, setIsOptimizing] = useState(false);

  // Map click handler (e.g. user selects coordinates on the map)
  const handleMapClick = (lat, lng) => {
    // When map is clicked, set or create coordinates for incident
    console.log(`Map Coordinate Selected: ${lat}°N, ${lng}°E`);
  };

  const handleRunOptimization = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      setIsOptimizing(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] flex text-stone-900 font-sans antialiased selection:bg-burnt-600 selection:text-white">
      {/* Charcoal / Graphite Sidebar */}
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Workspace (Warm Ivory / Off-White) */}
      <div className="flex-1 flex flex-col lg:pl-72 min-w-0">
        {/* Top Navigation */}
        <TopNav
          activeNav={activeNav}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onToggleMobileMenu={() => setIsMobileOpen(!isMobileOpen)}
          isMobileOpen={isMobileOpen}
        />

        {/* Workspace Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          <ErrorBoundary>
          {/* 1. COMMAND CENTRE VIEW */}
          {activeNav === 'Command Centre' && (
            <CommandCentreView
              selectedIncident={selectedIncident}
              selectedUnit={selectedUnit}
              selectedHospital={selectedHospital}
              simulationState={simulationState}
              onSelectIncident={setSelectedIncident}
              onSelectUnit={setSelectedUnit}
              onSelectHospital={setSelectedHospital}
              onSimulationUpdate={setSimulationState}
              onSimulationReset={() =>
                setSimulationState({
                  isPlaying: false,
                  progress: 0,
                  currentVehiclePos: null,
                  traveledWaypoints: null,
                  phase: 'Idle'
                })
              }
              onSwitchToSimulator={() => setActiveNav('Scenario Simulator')}
              onMapClick={handleMapClick}
              searchQuery={searchQuery}
            />
          )}

          {/* 2. LIVE INCIDENT MAP (Dedicated Full-Screen GIS Experience) */}
          {activeNav === 'Live Incident Map' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-stone-900 tracking-tight">
                    Tamil Nadu 2D GIS Live Spatial Incident Command
                  </h2>
                  <p className="text-xs text-stone-500">
                    Interactive OpenStreetMap vector tiles • Active highway corridor routing • Event-driven vehicle position interpolation.
                  </p>
                </div>
              </div>

              {/* Simulation Timeline Controls directly above the Map */}
              <SimulationController
                activeIncident={selectedIncident}
                onSimulationUpdate={setSimulationState}
                onSimulationReset={() =>
                  setSimulationState({
                    isPlaying: false,
                    progress: 0,
                    currentVehiclePos: null,
                    traveledWaypoints: null,
                    phase: 'Idle'
                  })
                }
              />

              {/* GIS Map Container */}
              <GisMap
                selectedIncident={selectedIncident}
                selectedUnit={selectedUnit}
                selectedHospital={selectedHospital}
                simulationState={simulationState}
                onSelectIncident={setSelectedIncident}
                onSelectUnit={setSelectedUnit}
                onSelectHospital={setSelectedHospital}
                onMapClick={handleMapClick}
              />

              {/* Selected Incident Telemetry Footer */}
              {selectedIncident && (
                <div className="p-4 rounded-xl bg-white border border-ivory-border shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-burnt-600 font-bold uppercase">
                      Selected Incident Corridor: {selectedIncident.id}
                    </span>
                    <h4 className="text-sm font-bold text-stone-900 mt-0.5">{selectedIncident.title}</h4>
                    <p className="text-stone-500">{selectedIncident.district} • Estimated Casualties: {selectedIncident.casualtyEstimate} victims</p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div>
                      <span className="text-stone-400 block text-[10px]">Assigned Unit</span>
                      <span className="font-bold text-stone-900">{selectedIncident.recommendedUnitId}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">Destination Center</span>
                      <span className="font-bold text-tealops-800">{selectedIncident.targetHospitalId}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">Optimised Arrival</span>
                      <span className="font-bold text-emerald-700">{selectedIncident.optimisedResponseMins}m</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. SCENARIO SIMULATOR (Single-Incident End-to-End Simulation) */}
          {activeNav === 'Scenario Simulator' && (
            <ScenarioSimulator />
          )}

          {activeNav === 'Cardiac Arrest' && <CardiacArrestView />}

          {/* 4. AMBULANCE FLEET VIEW */}
          {activeNav === 'Ambulance Fleet' && (
            <AmbulanceFleetView
              onSelectUnit={(unit) => {
                setSelectedUnit(unit);
                setActiveNav('Live Incident Map');
              }}
            />
          )}

          {/* 5. RESCUE TEAMS VIEW */}
          {activeNav === 'Rescue Teams' && <RescueTeamsView />}

          {/* 6. HOSPITAL NETWORK VIEW */}
          {activeNav === 'Hospital Network' && (
            <HospitalNetworkView
              onSelectHospital={(hosp) => {
                setSelectedHospital(hosp);
                setActiveNav('Live Incident Map');
              }}
            />
          )}

          {/* 7. OPTIMISATION RESULTS VIEW */}
          {activeNav === 'Optimisation Results' && <OptimisationResultsView />}

          {/* 8. ANALYTICS VIEW */}
          {activeNav === 'Analytics' && <AnalyticsView />}
        </ErrorBoundary>
      </main>
      </div>
    </div>
  );
}
