import React, { useEffect } from 'react';
import {
  X,
  MapPin,
  Ambulance,
  Building2,
  Clock,
  AlertTriangle,
  HeartPulse,
  Compass,
  CheckCircle2,
  Cpu,
  FlaskConical,
  Database
} from 'lucide-react';

export default function IncidentDetailModal({ incident, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!incident) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 bg-slate-900 text-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-400">
                {incident.id}
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <FlaskConical className="w-3 h-3 text-amber-400" />
                SIMULATED SCENARIO
              </span>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  incident.severity === 'CRITICAL'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : incident.severity === 'HIGH'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}
              >
                {incident.severity} Priority
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">{incident.type}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{incident.subType}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Geolocation Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">
              Test Incident Geolocation (Illustrative Scenario)
            </span>
            <div className="flex items-start gap-2 text-slate-800">
              <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{incident.location}</p>
                <p className="text-slate-500 mt-0.5">
                  District: {incident.district} • Synthetic test coordinates for routing model
                </p>
              </div>
            </div>
          </div>

          {/* Unit & Hospital Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Assigned Unit */}
            <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 text-xs">
              <div className="flex items-center gap-1.5 text-blue-800 font-semibold mb-1">
                <Ambulance className="w-4 h-4 text-blue-600" />
                <span>Assigned Fleet Unit (Simulated)</span>
              </div>
              <div className="font-mono text-sm font-bold text-slate-900 mt-1">
                {incident.assignedUnit}
              </div>
              <p className="text-slate-500 text-[11px]">{incident.unitType}</p>
              <div className="mt-2 pt-2 border-t border-blue-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-600">Status: {incident.status}</span>
                <span className="font-bold text-blue-700 font-mono">ETA: {incident.eta}</span>
              </div>
            </div>

            {/* Destination Center */}
            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-800 font-semibold mb-1">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Destination Hospital (Mapped Facility)</span>
              </div>
              <div className="font-semibold text-xs text-slate-900 mt-1 line-clamp-2">
                {incident.targetHospital}
              </div>
              <div className="mt-2 pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 font-medium">● Mapped Facility Record</span>
                <span className="text-slate-500 font-mono">339 Facilities Pool</span>
              </div>
            </div>
          </div>

          {/* Stage 2 Optimization Engine Note */}
          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-2 text-slate-900 font-semibold mb-1">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>Stage 2 Algorithmic Optimization Target</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              This record is a synthetic benchmark scenario. In Stage 2, the multi-objective optimization algorithm will dynamically compute shortest-path transit using the 2,391 settlement coordinates and 339 mapped hospital facilities.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            {incident.loggedTime}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-xs"
          >
            Close Incident File
          </button>
        </div>
      </div>
    </div>
  );
}
