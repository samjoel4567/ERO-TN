import React from 'react';
import {
  ShieldAlert,
  Flame,
  Radio,
  Clock,
  Navigation,
  Activity,
  AlertTriangle,
  FlaskConical,
  Ambulance,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { SIMULATED_DISPATCH_BENCHMARK } from '../data/mockData';

export default function EmergencyStatusPanel({ onSelectIncidentById }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Emergency Response Optimization Pipeline (Simulation Interface)
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                Simulated Model
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Illustrative workflow evaluating triage stages and dispatch coordination for Stage 2
            </p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[11px]">
            <span>Simulation Pipeline: Standby</span>
          </div>
        </div>
      </div>

      {/* Benchmark Scenario Banner (Clearly marked as simulated, NO fake live emergency claims) */}
      <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-50 to-transparent border border-amber-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500 text-white shadow-xs shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                Active Benchmark Test Scenario: NH-45 Highway Model
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                SYNTHETIC TEST
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-0.5 leading-snug">
              Tambaram Bypass corridor scenario generated to evaluate shortest-path routing and multi-facility allocation under simulated congestion. <strong className="text-amber-800">Not a live 108 emergency call.</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white shadow-xs">
            Benchmark Scenario
          </span>
        </div>
      </div>

      {/* 4-Stage Response Lifecycle Visualizer */}
      <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>PALS Response Optimization Architecture (Planned Lifecycle)</span>
          <span className="font-mono text-[10px] text-slate-400">Target: &lt; 10m Golden Hour Transit</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold font-mono shrink-0">
              01
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">Incident Ingestion</div>
              <div className="text-[10px] text-slate-500 font-mono">Scenario Coordinates</div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold font-mono shrink-0">
              02
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">Dynamic Triage</div>
              <div className="text-[10px] text-slate-500 font-mono">Severity Matrix</div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-amber-200 bg-amber-50/30 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold font-mono shrink-0">
              03
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">Optimized Dispatch</div>
              <div className="text-[10px] text-amber-700 font-mono">Stage 2 Engine Target</div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold font-mono shrink-0">
              04
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">Facility Handover</div>
              <div className="text-[10px] text-slate-500 font-mono">339 Mapped Centers</div>
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Benchmark Queue Cards */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {SIMULATED_DISPATCH_BENCHMARK.map((pipe) => {
          return (
            <div
              key={pipe.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-mono font-semibold text-slate-600">{pipe.id}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                  {pipe.status}
                </span>
              </div>

              <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">
                {pipe.title}
              </h4>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {pipe.location}
              </p>

              <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1 font-mono text-slate-700">
                  <Ambulance className="w-3.5 h-3.5 text-blue-600" />
                  <span className="truncate max-w-[120px]">{pipe.unit}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  {pipe.testObjective}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
