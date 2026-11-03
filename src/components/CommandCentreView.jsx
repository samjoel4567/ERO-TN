import React from 'react';
import StatCard from './StatCard';
import GisMap from './GisMap';
import SimulationController from './SimulationController';
import ResourceSummary from './ResourceSummary';
import IncidentsTable from './IncidentsTable';
import {
  VERIFIED_DATASET_FACTS,
  KPI_METRICS,
  BENCHMARK_INCIDENTS,
  FLEET_UNITS,
  MAPPED_HOSPITALS
} from '../data/mockData';
import {
  AlertTriangle,
  Database,
  Compass,
  Activity,
  SlidersHorizontal,
  ArrowRight,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Clock
} from 'lucide-react';

export default function CommandCentreView({
  selectedIncident,
  selectedUnit,
  selectedHospital,
  simulationState,
  onSelectIncident,
  onSelectUnit,
  onSelectHospital,
  onSimulationUpdate,
  onSimulationReset,
  onSwitchToSimulator,
  onMapClick,
  searchQuery
}) {
  return (
    <div className="space-y-6">
      {/* 1. MANDATORY VISIBLE INDICATOR: "DEMO DATA — NOT LIVE OPERATIONAL DATA" */}
      <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-amber-950">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-600 text-white shrink-0 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs sm:text-sm tracking-wide uppercase text-amber-950 font-mono">
                DEMO DATA — NOT LIVE OPERATIONAL DATA
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300 uppercase">
                Stage 2 GIS Engine
              </span>
            </div>
            <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed">
              Platform operates on verified static baseline datasets (1,353 ambulances, 339 mapped hospitals, 2,391 village coordinates) alongside clearly labeled simulated scenario parameters. <strong>Not connected to live emergency services.</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-200/90 text-amber-900 border border-amber-300 font-mono text-[11px]">
            Academic Prototype
          </span>
        </div>
      </div>

      {/* 2. VERIFIED BASELINE DATASET RIBBON */}
      <div className="bg-white rounded-xl p-4 border border-ivory-border shadow-xs">
        <div className="flex items-center justify-between pb-2.5 border-b border-ivory-border mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-800 uppercase tracking-wider font-mono">
            <Database className="w-4 h-4 text-burnt-600" />
            <span>Verified Project Baseline Facts (Tamil Nadu Disaster Management Study)</span>
          </div>
          <span className="text-[10px] font-mono text-stone-500 bg-ivory-100 px-2 py-0.5 rounded border border-ivory-border">
            Static Baseline Data
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border">
            <span className="text-xs text-stone-500 block">District-Reported Fleet</span>
            <span className="text-lg sm:text-xl font-bold font-mono text-stone-900">
              {VERIFIED_DATASET_FACTS.ambulances.formatted}
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">38 district records</span>
          </div>

          <div className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border">
            <span className="text-xs text-stone-500 block">Mapped Hospital Facilities</span>
            <span className="text-lg sm:text-xl font-bold font-mono text-tealops-700">
              {VERIFIED_DATASET_FACTS.hospitals.formatted}
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">Healthcare nodes</span>
          </div>

          <div className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border">
            <span className="text-xs text-stone-500 block">District-Level Records</span>
            <span className="text-lg sm:text-xl font-bold font-mono text-stone-900">
              {VERIFIED_DATASET_FACTS.districtRecords.formatted}
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">Administrative zones</span>
          </div>

          <div className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border">
            <span className="text-xs text-stone-500 block">Village Settlement Points</span>
            <span className="text-lg sm:text-xl font-bold font-mono text-burnt-600">
              {VERIFIED_DATASET_FACTS.settlementCoordinates.formatted}
            </span>
            <span className="text-[10px] text-stone-400 block mt-0.5">Retained coordinates</span>
          </div>
        </div>
      </div>

      {/* 3. Core Overview KPI Metrics */}
      <section aria-label="Key Performance Indicators">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title={KPI_METRICS.totalAmbulances.label}
            value={KPI_METRICS.totalAmbulances.value}
            change={KPI_METRICS.totalAmbulances.change}
            status="burnt"
            details={KPI_METRICS.totalAmbulances.details}
            isVerified={KPI_METRICS.totalAmbulances.isVerified}
            isSimulated={KPI_METRICS.totalAmbulances.isSimulated}
            unitLabel={KPI_METRICS.totalAmbulances.unitLabel}
          />
          <StatCard
            title={KPI_METRICS.availableAmbulances.label}
            value={KPI_METRICS.availableAmbulances.value}
            change={KPI_METRICS.availableAmbulances.change}
            status="green"
            details={KPI_METRICS.availableAmbulances.details}
            isVerified={KPI_METRICS.availableAmbulances.isVerified}
            isSimulated={KPI_METRICS.availableAmbulances.isSimulated}
            unitLabel={KPI_METRICS.availableAmbulances.unitLabel}
          />
          <StatCard
            title={KPI_METRICS.hospitalsInNetwork.label}
            value={KPI_METRICS.hospitalsInNetwork.value}
            change={KPI_METRICS.hospitalsInNetwork.change}
            status="teal"
            details={KPI_METRICS.hospitalsInNetwork.details}
            isVerified={KPI_METRICS.hospitalsInNetwork.isVerified}
            isSimulated={KPI_METRICS.hospitalsInNetwork.isSimulated}
            unitLabel={KPI_METRICS.hospitalsInNetwork.unitLabel}
          />
          <StatCard
            title={KPI_METRICS.activeIncidents.label}
            value={KPI_METRICS.activeIncidents.value}
            change={KPI_METRICS.activeIncidents.change}
            status="amber"
            details={KPI_METRICS.activeIncidents.details}
            isVerified={KPI_METRICS.activeIncidents.isVerified}
            isSimulated={KPI_METRICS.activeIncidents.isSimulated}
            unitLabel={KPI_METRICS.activeIncidents.unitLabel}
          />
        </div>
      </section>

      {/* 4. Real Interactive Leaflet 2D GIS Map */}
      <section aria-label="Interactive Leaflet GIS Map">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-stone-900 tracking-tight font-sans">
                Tamil Nadu 2D GIS Operations Map (Leaflet & OpenStreetMap)
              </h2>
              <p className="text-xs text-stone-500">
                Interactive spatial map plotting real Tamil Nadu coordinates, incident sites, mapped hospitals, and ambulance base corridors.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onSwitchToSimulator}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-burnt-600 hover:bg-burnt-500 text-white flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Launch 10-Step Simulator</span>
              </button>
            </div>
          </div>

          <GisMap
            selectedIncident={selectedIncident}
            selectedUnit={selectedUnit}
            selectedHospital={selectedHospital}
            simulationState={simulationState}
            onSelectIncident={onSelectIncident}
            onSelectUnit={onSelectUnit}
            onSelectHospital={onSelectHospital}
            onMapClick={onMapClick}
          />
        </div>
      </section>

      {/* 5. Event-Driven Simulation Timeline Controller */}
      <section aria-label="Simulation Playback Controller">
        <SimulationController
          activeIncident={selectedIncident || BENCHMARK_INCIDENTS[0]}
          onSimulationUpdate={onSimulationUpdate}
          onSimulationReset={onSimulationReset}
        />
      </section>

      {/* 6. Resource Availability Summary */}
      <section aria-label="Resource Availability Summary">
        <ResourceSummary />
      </section>

      {/* 7. Incident Register Table */}
      <section aria-label="Emergency Incidents Table">
        <IncidentsTable
          searchQuery={searchQuery}
          onSelectIncident={onSelectIncident}
          selectedIncident={selectedIncident}
        />
      </section>
    </div>
  );
}

