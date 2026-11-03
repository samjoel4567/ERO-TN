import React from 'react';
import {
  BarChart3,
  MapPin,
  TrendingUp,
  Activity,
  CheckCircle2,
  Database,
  Compass,
  PieChart
} from 'lucide-react';
import { VERIFIED_DATASET_FACTS, TAMIL_NADU_DISTRICTS } from '../data/mockData';

export default function AnalyticsView() {
  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-graphite-900 border border-graphite-border rounded-xl p-5 text-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-tealops-700 text-white shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Statewide Emergency Coverage & Settlement Analytics
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Geospatial analysis across 2,391 retained village coordinates and 38 district administrative records.
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-stone-500 font-medium block">Village Settlement Points</span>
          <span className="text-2xl font-extrabold font-mono text-stone-900 mt-1 block">
            {VERIFIED_DATASET_FACTS.settlementCoordinates.formatted}
          </span>
          <span className="text-[11px] text-stone-500 mt-0.5 block">Retained coordinates in dataset</span>
        </div>

        <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-stone-500 font-medium block">District Coverage Records</span>
          <span className="text-2xl font-extrabold font-mono text-tealops-700 mt-1 block">
            38 / 38
          </span>
          <span className="text-[11px] text-tealops-700 mt-0.5 block">Administrative zones mapped</span>
        </div>

        <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-stone-500 font-medium block">Mapped Healthcare Nodes</span>
          <span className="text-2xl font-extrabold font-mono text-stone-900 mt-1 block">
            {VERIFIED_DATASET_FACTS.hospitals.formatted}
          </span>
          <span className="text-[11px] text-stone-500 mt-0.5 block">Receiving centers</span>
        </div>

        <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-stone-500 font-medium block">Baseline Fleet Pool</span>
          <span className="text-2xl font-extrabold font-mono text-burnt-600 mt-1 block">
            {VERIFIED_DATASET_FACTS.ambulances.formatted}
          </span>
          <span className="text-[11px] text-burnt-700 mt-0.5 block">Reported ambulances</span>
        </div>
      </div>

      {/* District Fleet Density Grid */}
      <div className="bg-white border border-ivory-border rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 mb-3">
          District-Level Resource Saturation Index (Sample Districts in Dataset)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TAMIL_NADU_DISTRICTS.map((d) => (
            <div key={d.id} className="p-3 rounded-lg bg-ivory-50 border border-ivory-border flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-stone-900">{d.name}</span>
                <span className="text-[10px] text-stone-500 block">{d.zone} Zone</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-stone-800">{d.fleetCount} fleet</span>
                <span className="text-[10px] text-tealops-700 block font-mono">{d.hospitalsCount} hospitals</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

