import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  MapPin,
  Ambulance,
  Filter,
  Eye,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  Navigation
} from 'lucide-react';
import { BENCHMARK_INCIDENTS } from '../data/mockData';

export default function IncidentsTable({ searchQuery = '', onSelectIncident, selectedIncident }) {
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const filteredIncidents = BENCHMARK_INCIDENTS.filter((inc) => {
    if (severityFilter !== 'ALL' && inc.severity !== severityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        inc.id.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.type.toLowerCase().includes(q) ||
        inc.district.toLowerCase().includes(q) ||
        inc.recommendedUnitId.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-critical-50 text-critical-700 border border-critical-200">
            <span className="w-1.5 h-1.5 rounded-full bg-critical-600" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-caution-50 text-caution-700 border border-caution-200">
            <span className="w-1.5 h-1.5 rounded-full bg-caution-600" />
            HIGH
          </span>
        );
      case 'MODERATE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-ivory-200 text-stone-700 border border-ivory-border">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
            MODERATE
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-ivory-border shadow-xs overflow-hidden">
      {/* Table Header */}
      <div className="p-4 sm:p-5 border-b border-ivory-border flex flex-wrap items-center justify-between gap-3 bg-ivory-50/50">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-stone-900 tracking-tight font-sans">
              Emergency Incidents & Scenario Dispatch Register
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-burnt-100 text-burnt-800 border border-burnt-200">
              {filteredIncidents.length} Benchmark Scenarios
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Synthetic benchmark incidents mapped with real Tamil Nadu highway corridor waypoints for route simulation.
          </p>
        </div>

        {/* Severity Filter Pills */}
        <div className="flex items-center bg-ivory-200 p-1 rounded-lg text-xs font-medium text-stone-700">
          <span className="px-2 text-stone-500 flex items-center gap-1 text-[11px]">
            <Filter className="w-3 h-3" />
            Filter:
          </span>
          {['ALL', 'CRITICAL', 'HIGH'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                severityFilter === sev
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-ivory-100 border-b border-ivory-border text-stone-600 font-semibold uppercase text-[10px] tracking-wider">
              <th className="py-3 px-4">Scenario ID</th>
              <th className="py-3 px-4">Incident Title & Type</th>
              <th className="py-3 px-4">District & Coordinates</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Casualties</th>
              <th className="py-3 px-4">Recommended Unit</th>
              <th className="py-3 px-4">Baseline vs Opt</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ivory-border/70">
            {filteredIncidents.map((inc) => {
              const isSelected = selectedIncident?.id === inc.id;
              return (
                <tr
                  key={inc.id}
                  onClick={() => onSelectIncident && onSelectIncident(inc)}
                  className={`transition-colors cursor-pointer ${
                    isSelected ? 'bg-burnt-50/50' : 'hover:bg-ivory-50'
                  }`}
                >
                  <td className="py-3 px-4 font-mono font-bold text-burnt-600">
                    {inc.id}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-stone-900">{inc.title}</div>
                    <div className="text-[11px] text-stone-500">{inc.type}</div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-stone-800 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{inc.district}</span>
                    </div>
                    <div className="text-[10px] font-mono text-stone-400">
                      [{inc.lat}, {inc.lng}]
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    {getSeverityBadge(inc.severity)}
                  </td>

                  <td className="py-3 px-4 font-mono font-bold text-stone-800">
                    {inc.casualtyEstimate} victims
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-mono text-xs font-bold text-stone-900 block">
                      {inc.recommendedUnitId}
                    </span>
                    <span className="text-[10px] text-stone-500 font-medium">
                      Target: {inc.targetHospitalId}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-stone-400 line-through">{inc.baselineResponseMins}m</span>
                      <span>&rarr;</span>
                      <span className="text-emerald-700 font-bold">{inc.optimisedResponseMins}m</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold block">
                      -{(inc.baselineResponseMins - inc.optimisedResponseMins).toFixed(1)}m transit
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectIncident) onSelectIncident(inc);
                      }}
                      className="px-3 py-1 text-xs font-semibold rounded bg-burnt-600 text-white hover:bg-burnt-500 transition-colors shadow-xs"
                    >
                      Inspect Route
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
