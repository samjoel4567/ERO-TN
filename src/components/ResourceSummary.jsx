import React from 'react';
import {
  Truck,
  Building2,
  Database,
  FlaskConical,
  Info,
  CheckCircle2,
  MapPin,
  Layers
} from 'lucide-react';
import { FLEET_AVAILABILITY_MODEL, HOSPITAL_FACILITY_TIERS } from '../data/mockData';

export default function ResourceSummary() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Ambulance Fleet Status Summary (1,353 in Dataset) */}
      <div className="bg-white rounded-xl border border-ivory-border shadow-xs p-5 flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-ivory-border">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-burnt-50 text-burnt-700 border border-burnt-200">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight font-sans">
                  Ambulance Fleet Availability Model (1,353 Total in Dataset)
                </h3>
                <p className="text-xs text-stone-500">
                  Modeled operational availability across 38 district administrative records
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-burnt-50 text-burnt-700 border border-burnt-200 font-bold uppercase tracking-wider flex items-center gap-1">
              <FlaskConical className="w-3 h-3 text-burnt-600" />
              Simulated Split
            </span>
          </div>

          {/* Dataset Fact Callout */}
          <div className="mt-3 p-2.5 rounded-lg bg-ivory-100 border border-ivory-border text-xs text-stone-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-burnt-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-stone-600">
              <strong className="text-stone-800">Verified Dataset Fact:</strong> 1,353 ambulances are reported across 38 district records. Because vehicles operate on shifts and maintenance rotations, not all 1,353 are active simultaneously.
            </p>
          </div>

          {/* Multi-segment Progress Bars */}
          <div className="mt-4 space-y-3.5">
            {FLEET_AVAILABILITY_MODEL.map((res) => {
              const availPercent = Math.round((res.available / res.total) * 100);
              const dispatchedPercent = Math.round((res.dispatched / res.total) * 100);
              const maintPercent = 100 - availPercent - dispatchedPercent;

              return (
                <div key={res.type} className="p-3 rounded-lg bg-ivory-50 border border-ivory-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800">{res.type}</span>
                    <span className="font-mono text-stone-600 font-bold">
                      {res.available} ready / {res.total} total
                    </span>
                  </div>

                  {/* Multi-segment Progress Bar */}
                  <div className="w-full h-2.5 bg-ivory-300 rounded-full overflow-hidden flex mt-2">
                    <div
                      style={{ width: `${availPercent}%` }}
                      className="bg-operational-600 transition-all duration-300"
                      title={`Simulated Ready: ${res.available} (${availPercent}%)`}
                    />
                    <div
                      style={{ width: `${dispatchedPercent}%` }}
                      className="bg-burnt-600 transition-all duration-300"
                      title={`Simulated Dispatched: ${res.dispatched} (${dispatchedPercent}%)`}
                    />
                    <div
                      style={{ width: `${maintPercent}%` }}
                      className="bg-caution-500 transition-all duration-300"
                      title={`Maintenance Buffer: ${res.maintenance} (${maintPercent}%)`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-500 mt-1.5">
                    <span className="truncate max-w-[230px] text-[10px] text-stone-400">
                      {res.description}
                    </span>
                    <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
                      <span className="text-operational-700 font-medium">● {res.available} Ready</span>
                      <span className="text-burnt-700 font-medium">● {res.dispatched} Active</span>
                      <span className="text-caution-700 font-medium">● {res.maintenance} Maint</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-ivory-border flex items-center justify-between text-[11px] text-stone-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-operational-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-operational-600" /> Modeled Ready (846)
            </span>
            <span className="flex items-center gap-1 text-burnt-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-burnt-600" /> In-Transit (383)
            </span>
            <span className="flex items-center gap-1 text-caution-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-caution-500" /> Maintenance (124)
            </span>
          </div>
          <span className="font-mono text-stone-400 text-[10px]">Total = 1,353</span>
        </div>
      </div>

      {/* 2. Mapped Hospital Facilities (339 Verified in Dataset - NO fabricated ICU beds) */}
      <div className="bg-white rounded-xl border border-ivory-border shadow-xs p-5 flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-ivory-border">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-tealops-50 text-tealops-700 border border-tealops-200">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight font-sans">
                  Mapped Hospital Facilities (339 in Dataset)
                </h3>
                <p className="text-xs text-stone-500">
                  Verified healthcare facilities cataloged in Tamil Nadu GIS database
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-tealops-50 text-tealops-700 border border-tealops-200 font-bold uppercase tracking-wider flex items-center gap-1">
              <Database className="w-3 h-3 text-tealops-600" />
              339 Verified
            </span>
          </div>

          {/* Verified Facility Tier Summary Grid */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {HOSPITAL_FACILITY_TIERS.map((tier) => (
              <div key={tier.tier} className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border text-center">
                <span className="text-lg font-extrabold font-mono text-stone-900 block">
                  {tier.count}
                </span>
                <span className="text-[10px] text-stone-500 leading-tight block mt-0.5">
                  {tier.tier}
                </span>
              </div>
            ))}
          </div>

          {/* Key Sample Facilities in Dataset */}
          <div className="mt-3.5 space-y-2">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider font-mono block">
              Sample Key Regional Centers in Dataset
            </span>
            {HOSPITAL_FACILITY_TIERS[0].facilities.map((hosp) => (
              <div
                key={hosp.name}
                className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border flex items-center justify-between text-xs"
              >
                <div>
                  <h4 className="font-semibold text-stone-900">{hosp.name}</h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5">
                    <MapPin className="w-3 h-3 text-stone-400" />
                    <span>{hosp.district}</span>
                    <span>•</span>
                    <span>{hosp.type}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-tealops-50 text-tealops-700 border border-tealops-200 shrink-0 font-medium">
                  Mapped Node
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fact Banner */}
        <div className="mt-4 pt-3 border-t border-ivory-border flex items-center justify-between text-[11px] text-stone-500">
          <span className="flex items-center gap-1 text-stone-600">
            <Info className="w-3.5 h-3.5 text-tealops-600" />
            Live ICU & bed counts are not in the static dataset; interfaced in future stages.
          </span>
          <span className="font-mono text-stone-400 text-[10px]">Verified Baseline</span>
        </div>
      </div>
    </div>
  );
}
