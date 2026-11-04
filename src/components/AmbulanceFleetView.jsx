import React, { useState } from 'react';
import {
  Truck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Wrench,
  Fuel,
  MapPin,
  ShieldAlert,
  Database
} from 'lucide-react';
import { FLEET_UNITS, VERIFIED_DATASET_FACTS, TAMIL_NADU_DISTRICTS } from '../data/mockData';

export default function AmbulanceFleetView({ onSelectUnit }) {
  const [districtFilter, setDistrictFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUnits = FLEET_UNITS.filter((unit) => {
    if (districtFilter !== 'All' && !unit.district.toLowerCase().includes(districtFilter.toLowerCase())) return false;
    if (typeFilter !== 'All' && !unit.type.toLowerCase().includes(typeFilter.toLowerCase())) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        unit.id.toLowerCase().includes(q) ||
        unit.callsign.toLowerCase().includes(q) ||
        unit.district.toLowerCase().includes(q) ||
        unit.baseStation.toLowerCase().includes(q) ||
        unit.crew.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Overview Stat Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-stone-500 block">Total District Fleet</span>
          <span className="text-2xl font-extrabold font-mono text-stone-900 mt-1 block">
            {VERIFIED_DATASET_FACTS.ambulances.formatted}
          </span>
          <span className="text-[11px] text-stone-500 mt-0.5 block">Across 38 district records</span>
        </div>

        <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-stone-500 block">Modeled Standby Ready</span>
          <span className="text-2xl font-extrabold font-mono text-tealops-700 mt-1 block">
            846
          </span>
          <span className="text-[11px] text-tealops-700 mt-0.5 block">~62.5% shift availability</span>
        </div>

        <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-stone-500 block">Simulated Active Transit</span>
          <span className="text-2xl font-extrabold font-mono text-burnt-600 mt-1 block">
            383
          </span>
          <span className="text-[11px] text-burnt-700 mt-0.5 block">Dispatched & on-scene load</span>
        </div>

        <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-stone-500 block">Maintenance Reserve</span>
          <span className="text-2xl font-extrabold font-mono text-caution-600 mt-1 block">
            124
          </span>
          <span className="text-[11px] text-stone-500 mt-0.5 block">Service buffer</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-40 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by unit ID, callsign, depot, or crew..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-ivory-50 border border-ivory-border rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-burnt-500/20 focus:border-burnt-600"
            />
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {/* District Selector */}
          <select
            value={districtFilter}
            aria-label="Filter ambulances by district"
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="w-full min-w-0 max-w-full px-2.5 py-1.5 text-xs bg-ivory-50 border border-ivory-border rounded-lg text-stone-700 cursor-pointer sm:w-auto"
          >
            <option value="All">All 38 Districts</option>
            {TAMIL_NADU_DISTRICTS.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>

          {/* Type Selector */}
          <select
            value={typeFilter}
            aria-label="Filter ambulances by vehicle type"
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full min-w-0 max-w-full px-2.5 py-1.5 text-xs bg-ivory-50 border border-ivory-border rounded-lg text-stone-700 cursor-pointer sm:w-auto"
          >
            <option value="All">All Vehicle Types</option>
            <option value="ALS">Advanced Life Support (ALS)</option>
            <option value="BLS">Basic Life Support (BLS)</option>
            <option value="Bike">First Responder Bikes</option>
          </select>
        </div>
      </div>

      {/* Fleet Table */}
      <div className="bg-white border border-ivory-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-ivory-100 border-b border-ivory-border text-stone-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Unit ID & Callsign</th>
                <th className="py-3 px-4">Type & Equipment</th>
                <th className="py-3 px-4">Base Station & District</th>
                <th className="py-3 px-4">Crew Complement</th>
                <th className="py-3 px-4">Fuel & Telemetry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-border/70">
              {filteredUnits.map((unit) => {
                const isALS = unit.type.includes('ALS');
                return (
                  <tr
                    key={unit.id}
                    onClick={() => onSelectUnit && onSelectUnit(unit)}
                    className="hover:bg-ivory-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-stone-900">{unit.id}</div>
                      <div className="text-[11px] text-burnt-600 font-semibold">{unit.callsign}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        isALS ? 'bg-burnt-100 text-burnt-800' : 'bg-tealops-100 text-tealops-800'
                      }`}>
                        {unit.type}
                      </span>
                      <div className="text-[10px] text-stone-500 mt-1 max-w-[220px] truncate">
                        {unit.equipment}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-800">{unit.baseStation}</div>
                      <div className="text-[11px] text-stone-500">{unit.district}</div>
                    </td>

                    <td className="py-3 px-4 text-[11px] text-stone-700 font-medium">
                      {unit.crew}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Fuel className="w-3 h-3 text-stone-400" />
                        <span>{unit.fuelLevel}%</span>
                        <span className="text-stone-300">|</span>
                        <span>{unit.speedKmph} km/h</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-tealops-50 text-tealops-700 border border-tealops-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-tealops-600" />
                        {unit.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectUnit) onSelectUnit(unit);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-ivory-100 text-stone-700 hover:bg-burnt-50 hover:text-burnt-700 border border-ivory-border transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

