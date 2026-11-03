import React, { useState } from 'react';
import {
  Building2,
  Search,
  Filter,
  CheckCircle2,
  Flame,
  HeartPulse,
  MapPin,
  Database,
  Plane
} from 'lucide-react';
import { MAPPED_HOSPITALS, VERIFIED_DATASET_FACTS, TAMIL_NADU_DISTRICTS } from '../data/mockData';

export default function HospitalNetworkView({ onSelectHospital }) {
  const [districtFilter, setDistrictFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHospitals = MAPPED_HOSPITALS.filter((hosp) => {
    if (districtFilter !== 'All' && !hosp.district.toLowerCase().includes(districtFilter.toLowerCase())) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        hosp.name.toLowerCase().includes(q) ||
        hosp.district.toLowerCase().includes(q) ||
        hosp.tier.toLowerCase().includes(q) ||
        hosp.type.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Overview Stat Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-stone-500 block">Total Mapped Facilities</span>
          <span className="text-2xl font-extrabold font-mono text-tealops-700 mt-1 block">
            {VERIFIED_DATASET_FACTS.hospitals.formatted}
          </span>
          <span className="text-[11px] text-stone-500 mt-0.5 block">Tamil Nadu GIS database records</span>
        </div>

        <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-stone-500 block">Apex & Medical Colleges</span>
          <span className="text-2xl font-extrabold font-mono text-stone-900 mt-1 block">
            48
          </span>
          <span className="text-[11px] text-stone-500 mt-0.5 block">Level-1 & Level-2 trauma centers</span>
        </div>

        <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-stone-500 block">Secondary & Community Centers</span>
          <span className="text-2xl font-extrabold font-mono text-stone-900 mt-1 block">
            291
          </span>
          <span className="text-[11px] text-stone-500 mt-0.5 block">District & Taluk stabilization posts</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by hospital name, tier, or district..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-ivory-50 border border-ivory-border rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-burnt-500/20 focus:border-burnt-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-ivory-50 border border-ivory-border rounded-lg text-stone-700 cursor-pointer"
          >
            <option value="All">All Districts</option>
            {TAMIL_NADU_DISTRICTS.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Hospital Facility Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredHospitals.map((hosp) => (
          <div
            key={hosp.id}
            onClick={() => onSelectHospital && onSelectHospital(hosp)}
            className="bg-white border border-ivory-border rounded-xl p-5 hover:border-tealops-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold text-tealops-700 block">
                    {hosp.tier}
                  </span>
                  <h4 className="text-sm font-bold text-stone-900 mt-1">{hosp.name}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>{hosp.district}</span>
                    <span>•</span>
                    <span>{hosp.type}</span>
                  </div>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-tealops-100 text-tealops-800 font-bold shrink-0">
                  {hosp.traumaLevel}
                </span>
              </div>

              {/* Badges */}
              <div className="mt-3.5 flex flex-wrap gap-1.5 text-[11px]">
                {hosp.burnsCare && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-caution-50 text-caution-700 border border-caution-200">
                    <Flame className="w-3 h-3 text-caution-600" />
                    Burns Unit
                  </span>
                )}
                {hosp.cardiacLab && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-critical-50 text-critical-700 border border-critical-200">
                    <HeartPulse className="w-3 h-3 text-critical-600" />
                    Cath Lab
                  </span>
                )}
                {hosp.helipad && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-ivory-200 text-stone-700 border border-ivory-border">
                    <Plane className="w-3 h-3 text-stone-600" />
                    Helipad
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-ivory-border/70 flex items-center justify-between text-xs text-stone-600">
              <span className="font-mono text-[11px] text-stone-500">{hosp.bedsEstimate}</span>
              <span className="font-semibold text-tealops-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Intake: {hosp.intakeStatus}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

