import React, { useState } from 'react';
import {
  MapPin,
  Layers,
  Compass,
  Maximize2,
  Navigation,
  Crosshair,
  ShieldAlert,
  Info,
  Radio,
  Building2,
  Ambulance,
  Sparkles,
  Database,
  FlaskConical
} from 'lucide-react';
import { DISTRICT_MAP_HUBS, VERIFIED_DATASET_FACTS } from '../data/mockData';

export default function MapPlaceholder({ searchQuery = '' }) {
  const [selectedHub, setSelectedHub] = useState(null);
  const [activeLayer, setActiveLayer] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');

  const filteredHubs = DISTRICT_MAP_HUBS.filter((hub) => {
    if (districtFilter !== 'all' && hub.id !== districtFilter) return false;
    if (
      searchQuery &&
      !hub.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Map Header Toolbar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {/* Labeled GIS Integration — Coming in Stage 2 */}
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                GIS Integration — Coming in Stage 2
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                Illustrative Schematic Grid
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              38 District Centers • 2,391 Settlement Coordinates Retained for Leaflet.js
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* District Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All Tamil Nadu Districts (38 Records)</option>
              <option value="chennai">Chennai District Center</option>
              <option value="coimbatore">Coimbatore District Center</option>
              <option value="madurai">Madurai District Center</option>
              <option value="trichy">Tiruchirappalli District Center</option>
              <option value="salem">Salem District Center</option>
              <option value="tirunelveli">Tirunelveli District Center</option>
            </select>
          </div>

          {/* Layer Filter Pills */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-lg text-xs font-medium text-slate-700">
            <button
              onClick={() => setActiveLayer('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeLayer === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              All Schematic Nodes
            </button>
            <button
              onClick={() => setActiveLayer('fleet')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeLayer === 'fleet'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              District Fleet Records
            </button>
            <button
              onClick={() => setActiveLayer('incidents')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeLayer === 'incidents'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Benchmark Scenarios
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Visual Canvas Placeholder */}
      <div className="relative w-full h-[480px] bg-slate-950 overflow-hidden select-none">
        {/* Technical GIS Grid Background */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #38bdf8 1px, transparent 1px),
              linear-gradient(to bottom, #38bdf8 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Concentric reference distance isochrone rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-blue-500/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full border border-blue-500/20 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full border border-blue-500/30 pointer-events-none" />

        {/* Dynamic Tamil Nadu State Command Grid Network (SVG) */}
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="corridorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Inter-hub schematic transit corridor links */}
          <line x1="82%" y1="22%" x2="70%" y2="20%" stroke="url(#corridorGrad)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="70%" y1="20%" x2="55%" y2="24%" stroke="url(#corridorGrad)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="55%" y1="24%" x2="50%" y2="38%" stroke="url(#corridorGrad)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="50%" y1="38%" x2="28%" y2="50%" stroke="url(#corridorGrad)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="50%" y1="38%" x2="58%" y2="52%" stroke="url(#corridorGrad)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="58%" y1="52%" x2="70%" y2="55%" stroke="url(#corridorGrad)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="58%" y1="52%" x2="48%" y2="68%" stroke="url(#corridorGrad)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="28%" y1="50%" x2="48%" y2="68%" stroke="url(#corridorGrad)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="48%" y1="68%" x2="42%" y2="84%" stroke="url(#corridorGrad)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="42%" y1="84%" x2="38%" y2="94%" stroke="url(#corridorGrad)" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>

        {/* Illustrative District Command Hub Nodes */}
        {filteredHubs.map((hub) => {
          const isSelected = selectedHub?.id === hub.id;
          const hasScenarios = hub.benchmarkIncidents > 0;

          return (
            <div
              key={hub.id}
              style={{ left: `${hub.x}%`, top: `${hub.y}%` }}
              onClick={() => setSelectedHub(hub)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
            >
              {/* Illustrative pulse */}
              {hasScenarios && (
                <div className="absolute -inset-2.5 rounded-full bg-amber-500/25 animate-ping pointer-events-none" />
              )}

              {/* Node core dot */}
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center ring-4 transition-all duration-200 ${
                  hasScenarios
                    ? 'bg-amber-500 ring-amber-500/20 shadow-lg shadow-amber-500/40'
                    : 'bg-blue-500 ring-blue-500/20 shadow-lg shadow-blue-500/40'
                } ${isSelected ? 'scale-125 ring-8 ring-white/30' : 'group-hover:scale-115'}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>

              {/* Hub Label Pill */}
              <div
                className={`absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-mono font-medium backdrop-blur-md transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-900/85 text-slate-300 border border-slate-700/60 group-hover:bg-slate-800 group-hover:text-white'
                }`}
              >
                {hub.name}
                {hasScenarios && (
                  <span className="ml-1.5 text-amber-300 font-bold">
                    ({hub.benchmarkIncidents} test)
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Top-Left Geographic Orientation Badge (Clearly stating illustrative status) */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-3 text-xs text-slate-300 shadow-xl max-w-xs">
            <div className="flex items-center gap-1.5 text-blue-400 font-semibold mb-1">
              <Crosshair className="w-3.5 h-3.5" />
              <span>Schematic District Node Grid</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Markers represent static district administrative center reference points. Real-time GPS locations and vector tiles will be integrated in Stage 2 using 2,391 verified village coordinates.
            </p>
          </div>
        </div>

        {/* Selected Hub Floating Telemetry Card */}
        {selectedHub && (
          <div className="absolute top-4 right-4 z-20 bg-slate-900/95 backdrop-blur-md border border-blue-500/50 rounded-xl p-4 text-xs text-slate-200 shadow-2xl w-72 animate-in fade-in duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-blue-400 font-semibold">
                  District Reference Node
                </span>
                <h4 className="text-sm font-bold text-white mt-0.5">{selectedHub.name}</h4>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedHub(null);
                }}
                className="text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block">District Fleet Record</span>
                <span className="text-sm font-bold font-mono text-blue-400">
                  {selectedHub.districtFleet} units
                </span>
              </div>
              <div className="p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block">Test Scenarios</span>
                <span className="text-sm font-bold font-mono text-amber-400">
                  {selectedHub.benchmarkIncidents} active
                </span>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Coordinates: Schematic Reference</span>
              <span className="text-amber-400 font-mono">Stage 1 Layout</span>
            </div>
          </div>
        )}

        {/* Explicit Integration Stage Banner / Watermark Note */}
        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-3 text-xs text-slate-300 shadow-xl flex items-center justify-between gap-3 pointer-events-auto">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-400 shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-white">
                  GIS Integration — Coming in Stage 2 (Current markers are illustrative)
                </span>
                <p className="text-[11px] text-slate-400">
                  The network nodes above are schematic district placeholders. Stage 2 will bind Leaflet.js with interactive tiles, dynamic routing, and precise coordinate plotting from the 2,391 settlement dataset.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded bg-slate-800 text-amber-300 font-mono text-[11px] border border-slate-700 shrink-0">
              Stage 2 Milestone
            </span>
          </div>
        </div>
      </div>

      {/* Map Footer Bar: Legend & Statistics */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center flex-wrap gap-4">
          <span className="font-semibold text-slate-800 text-xs">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Illustrative District Center Node</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Benchmark Test Scenario Node</span>
          </div>
        </div>

        {/* Verified Dataset reference facts (NO fake "100% coverage" claim) */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1 text-slate-600 font-medium">
            <Database className="w-3 h-3 text-blue-600" />
            Verified Facts: 38 District Records • 2,391 Village Settlement Coordinates Retained
          </span>
        </div>
      </div>
    </div>
  );
}
