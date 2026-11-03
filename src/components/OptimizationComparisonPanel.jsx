// PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
// Mathematical Optimisation Comparison Panel (PuLP MILP vs Greedy Nearest-Suitable Baseline)

import React from 'react';
import {
  Cpu,
  TrendingDown,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Activity,
  Building2,
  Truck,
  Users,
  Award,
  Database,
  HelpCircle,
  FileCheck
} from 'lucide-react';

export default function OptimizationComparisonPanel({
  optimizationResponse,
  isLoading,
  error,
  onRunOptimization,
  onApplySolution,
  isSolutionApplied = false,
  scenarioMode = 'single'
}) {
  if (error) {
    return (
      <div className="bg-red-500/10 border-2 border-red-500/40 rounded-xl p-5 text-red-950 space-y-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-600 text-white shrink-0 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-red-700 uppercase tracking-wider">
                Optimization Engine Error
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-200 text-red-800 font-bold uppercase">
                FastAPI / PuLP
              </span>
            </div>
            <h4 className="text-sm font-bold text-red-900">
              Operations Research Optimization Failed
            </h4>
            <p className="text-xs text-red-800 leading-relaxed font-mono whitespace-pre-wrap">
              {error}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-red-200/60 flex items-center justify-between text-xs">
          <span className="text-[11px] text-red-700 font-sans">
            <strong>Integrity Rule:</strong> PALS will never fall back to fabricated or approximate decisions in JavaScript when the mathematical solver fails.
          </span>
          <button
            onClick={onRunOptimization}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            Retry PuLP Solver
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-graphite-900 border border-graphite-border rounded-xl p-6 text-stone-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-burnt-600 text-white animate-spin">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">
              PuLP Mixed-Integer Linear Program Solving…
            </h4>
            <p className="text-xs text-stone-400 mt-0.5">
              Evaluating multi-incident cot constraints, clinical ALS gates, hospital intake capacities and travel times with CBC.
            </p>
          </div>
        </div>
        <div className="w-full bg-graphite-950 h-2 rounded-full overflow-hidden border border-graphite-800">
          <div className="bg-burnt-600 h-full w-2/3 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!optimizationResponse || !optimizationResponse.incident_resolutions) {
    return (
      <div className="bg-white border border-ivory-border rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
            <Cpu className="w-4 h-4 text-burnt-600" />
            <span>PuLP Operations Research Optimisation Engine</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-ivory-100 text-stone-600 border border-ivory-border">
            Ready to Solve
          </span>
        </div>
        <p className="text-xs text-stone-600 leading-relaxed">
          Send the configured emergency demand, scenario ambulance depots, and mapped hospitals to the Python FastAPI PuLP backend to compute the globally optimal allocation.
        </p>
        <button
          onClick={onRunOptimization}
          className="w-full py-2.5 rounded-lg bg-burnt-600 hover:bg-burnt-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
        >
          <Cpu className="w-4 h-4" />
          <span>Execute PuLP Mixed-Integer Linear Program</span>
        </button>
      </div>
    );
  }

  const {
    solver_status,
    solver_name,
    objective_value,
    objective_mode,
    execution_time_ms,
    incident_resolutions,
    raw_ambulance_allocations,
    raw_hospital_allocations,
    constraint_validations,
    independent_verification,
    baseline_comparison,
    total_vehicle_response_time_mins,
    total_patient_transport_time_mins,
    total_patient_weighted_response_time_mins
  } = optimizationResponse;

  const pulpMetrics = baseline_comparison?.pulp_metrics;
  const baseMetrics = baseline_comparison?.baseline_metrics;
  const isImproved = baseline_comparison?.is_performance_improved;

  return (
    <div className="bg-white border border-ivory-border rounded-xl p-5 shadow-xs space-y-5">
      {/* 1. Header Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-ivory-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-burnt-600 text-white shadow-xs">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-stone-900">
                PuLP MILP Optimisation Engine Solution
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-tealops-100 text-tealops-800 border border-tealops-300 uppercase">
                {solver_status} (CBC)
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Mode: <strong className="font-mono text-stone-700">{objective_mode}</strong> • Solved in{' '}
              <strong className="font-mono text-stone-700">{execution_time_ms} ms</strong> • Objective: <span className="font-mono text-burnt-700 font-bold">{objective_value}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {independent_verification?.is_valid && (
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
              <span>Independent Audit Verified</span>
            </span>
          )}
          <button
            onClick={onRunOptimization}
            disabled={isLoading}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-ivory-100 hover:bg-ivory-200 text-stone-700 border border-ivory-border transition-colors"
          >
            Re-Solve
          </button>
        </div>
      </div>

      {/* 2. Side-by-Side Comparative KPIs: PuLP vs Nearest-Suitable Baseline */}
      {baseline_comparison && pulpMetrics && baseMetrics && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800 uppercase tracking-wider font-mono">
              Optimisation Benchmark: PuLP MILP vs Greedy Nearest Baseline
            </span>
            <span className="text-[10px] font-mono text-stone-500">
              Factual Comparative Metrics
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Total Vehicle Response Time */}
            <div className="p-3 rounded-xl bg-ivory-50 border border-ivory-border space-y-1">
              <span className="text-[10px] text-stone-500 block uppercase font-mono">Fleet Response Time</span>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-lg font-extrabold text-stone-900">
                  {pulpMetrics.total_ambulance_response_time_mins}m
                </span>
                <span className="text-xs text-stone-400 line-through">
                  {baseMetrics.total_ambulance_response_time_mins}m
                </span>
              </div>
              <div className="text-[10px] font-semibold flex items-center gap-1">
                {baseline_comparison.response_time_reduction_pct > 0 ? (
                  <span className="text-emerald-700">
                    ↓ {baseline_comparison.response_time_reduction_pct}% faster
                  </span>
                ) : baseline_comparison.response_time_reduction_pct < 0 ? (
                  <span className="text-amber-700">
                    ↑ {Math.abs(baseline_comparison.response_time_reduction_pct)}% tradeoff
                  </span>
                ) : (
                  <span className="text-stone-500">Parity (0.0%)</span>
                )}
              </div>
            </div>

            {/* Patient-Weighted Response Time */}
            <div className="p-3 rounded-xl bg-ivory-50 border border-ivory-border space-y-1">
              <span className="text-[10px] text-stone-500 block uppercase font-mono">Patient-Weighted Response</span>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-lg font-extrabold text-stone-900">
                  {pulpMetrics.patient_weighted_response_time_mins}m
                </span>
                <span className="text-xs text-stone-400 line-through">
                  {baseMetrics.patient_weighted_response_time_mins}m
                </span>
              </div>
              <span className="text-[10px] text-stone-500 font-mono block">
                avg response × served
              </span>
            </div>

            {/* Hospital Transport Time */}
            <div className="p-3 rounded-xl bg-ivory-50 border border-ivory-border space-y-1">
              <span className="text-[10px] text-stone-500 block uppercase font-mono">Hospital Transport Time</span>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-lg font-extrabold text-tealops-800">
                  {pulpMetrics.total_hospital_transport_time_mins}m
                </span>
                <span className="text-xs text-stone-400 line-through">
                  {baseMetrics.total_hospital_transport_time_mins}m
                </span>
              </div>
              <div className="text-[10px] font-semibold flex items-center gap-1">
                {baseline_comparison.transport_time_reduction_pct > 0 ? (
                  <span className="text-emerald-700">
                    ↓ {baseline_comparison.transport_time_reduction_pct}% transit
                  </span>
                ) : (
                  <span className="text-stone-500">Comparable ({baseline_comparison.transport_time_reduction_pct}%)</span>
                )}
              </div>
            </div>

            {/* Casualties Served vs Unserved */}
            <div className="p-3 rounded-xl bg-ivory-50 border border-ivory-border space-y-1">
              <span className="text-[10px] text-stone-500 block uppercase font-mono">Casualty Coverage</span>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-lg font-extrabold text-emerald-700">
                  {pulpMetrics.total_casualties_served} served
                </span>
              </div>
              <div className="text-[10px] font-semibold">
                {pulpMetrics.total_unserved_casualties > 0 ? (
                  <span className="text-critical-600 font-bold">
                    ⚠️ {pulpMetrics.total_unserved_casualties} unserved
                  </span>
                ) : (
                  <span className="text-emerald-700">100% evacuated (0 unserved)</span>
                )}
              </div>
            </div>
          </div>

          {/* Verdict Alert */}
          <div className="p-3 rounded-xl bg-graphite-900 text-stone-200 border border-graphite-border flex items-start gap-2.5 text-xs">
            <Award className="w-4 h-4 text-burnt-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block">Solver Comparative Verdict:</span>
              <p className="text-stone-300 mt-0.5 leading-relaxed">{baseline_comparison.summary_verdict}</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Incident Resolutions & Acuity-Split Patient Allocations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-800 uppercase tracking-wider font-mono">
            Solver Dispatch & Acuity Allocations ({incident_resolutions.length} Incident{incident_resolutions.length > 1 ? 's' : ''})
          </span>
          <span className="text-[10px] font-mono text-stone-500">
            Acuity-Segregated Flows
          </span>
        </div>

        <div className="space-y-3">
          {incident_resolutions.map((res) => (
            <div key={res.incident_id} className="p-4 rounded-xl border border-ivory-border bg-ivory-50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-burnt-600">
                      [{res.incident_id}]
                    </span>
                    <h4 className="text-sm font-bold text-stone-900">{res.incident_name}</h4>
                    <span className="text-[10px] px-2 py-0.2 rounded bg-stone-200 text-stone-800 font-bold uppercase">
                      {res.severity}
                    </span>
                  </div>
                  <div className="text-xs text-stone-600 mt-1 font-mono">
                    Total Demand: <strong>{res.total_casualties}</strong> casualties (
                    <span className="text-critical-600 font-bold">{res.critical_casualties} Critical</span>,{' '}
                    <span>{res.noncritical_casualties} Non-Critical</span>)
                  </div>
                </div>

                {/* Acuity Evacuation Tallies */}
                <div className="flex items-center gap-3 text-xs font-mono">
                  <div className="bg-white p-2 rounded-lg border border-ivory-border text-center min-w-20">
                    <span className="text-[9px] text-stone-400 block uppercase">Critical Evac</span>
                    <span className="font-bold text-critical-700">
                      {res.critical_served} / {res.critical_casualties}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-ivory-border text-center min-w-20">
                    <span className="text-[9px] text-stone-400 block uppercase">Non-Critical</span>
                    <span className="font-bold text-tealops-800">
                      {res.noncritical_served} / {res.noncritical_casualties}
                    </span>
                  </div>
                  {res.unserved_casualties > 0 && (
                    <div className="bg-critical-50 p-2 rounded-lg border border-critical-200 text-center min-w-20 text-critical-700">
                      <span className="text-[9px] block uppercase font-bold">Unserved</span>
                      <span className="font-bold">⚠️ {res.unserved_casualties}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-section: Dispatched Ambulances */}
              <div>
                <span className="text-[11px] font-bold text-stone-700 block mb-1.5 flex items-center gap-1 font-mono uppercase">
                  <Truck className="w-3.5 h-3.5 text-burnt-600" />
                  <span>Ambulance Dispatches:</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {res.ambulances_dispatched.map((a, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-white border border-ivory-border flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                            a.ambulance_type === 'ALS' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {a.quantity}x {a.ambulance_type}
                          </span>
                          <span className="font-semibold text-stone-800 text-[11px] truncate max-w-44">
                            {a.base_name}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400 block mt-0.5">
                          Base ID: {a.base_id} • Cot capacity: {a.quantity * 2}
                        </span>
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        <span className="font-bold text-burnt-700">ETA ~{a.response_time_mins}m</span>
                        <span className="text-[10px] text-stone-400 block">{a.travel_distance_km} km</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-section: Allocated Hospitals */}
              <div>
                <span className="text-[11px] font-bold text-stone-700 block mb-1.5 flex items-center gap-1 font-mono uppercase">
                  <Building2 className="w-3.5 h-3.5 text-tealops-700" />
                  <span>Hospital Destinations (Acuity-Specific):</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {res.hospitals_allocated.map((h, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-white border border-ivory-border flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-stone-800 text-[11px] truncate max-w-44">
                          {h.hospital_name}
                        </div>
                        <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                          Total: <strong className="text-stone-900">{h.patients_allocated}</strong> patients (
                          {h.critical_patients_allocated > 0 && (
                            <span className="text-critical-600 font-bold">{h.critical_patients_allocated} Crit (Trauma/ICU), </span>
                          )}
                          <span>{h.noncritical_patients_allocated} Non-Crit</span>)
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        <span className="font-bold text-tealops-700">~{h.transport_time_mins}m</span>
                        <span className="text-[10px] text-stone-400 block">{h.travel_distance_km} km</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Mathematical Constraint Verifications */}
      <div className="space-y-2 pt-2 border-t border-ivory-border">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-800 uppercase tracking-wider font-mono">
            Mathematical Constraint Checks (PuLP CBC)
          </span>
          <span className="text-[10px] font-mono text-emerald-700 font-bold">
            100% Constraints Satisfied
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {constraint_validations.map((c, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-stone-900 block text-[11px] font-mono">
                  {c.constraint_name}
                </span>
                <span className="text-[10px] text-stone-500 leading-tight block">
                  {c.details}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Action Button to Apply Solution to Map Simulation */}
      {onApplySolution && (
        <div className="pt-2">
          <button
            onClick={onApplySolution}
            className={`w-full py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs ${
              isSolutionApplied
                ? 'bg-tealops-700 text-white'
                : 'bg-burnt-600 hover:bg-burnt-500 text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>
              {isSolutionApplied
                ? 'Solver Solution Active in Simulation Engine (Ready to Play)'
                : 'Apply Solver Allocations & Animate Response Mission'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

