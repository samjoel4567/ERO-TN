// PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
// Mathematical Optimisation Benchmark Analytics View (Connected to FastAPI + PuLP Backend)

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  TrendingDown,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Zap,
  Activity,
  Layers,
  BarChart2,
  AlertTriangle,
  Play
} from 'lucide-react';
import { PRESET_INCIDENT_LOCATIONS } from '../data/scenarioData';
import {
  executePulpOptimization,
  buildOptimizationPayload,
  checkBackendHealth
} from '../services/optimizationService';
import OptimizationComparisonPanel from './OptimizationComparisonPanel';

export default function OptimisationResultsView({ onNavigateToSimulator }) {
  const [selectedPresetId, setSelectedPresetId] = useState('HOTSPOT-01');
  const [isContentionMode, setIsContentionMode] = useState(false);
  const [objectiveMode, setObjectiveMode] = useState('weighted_sum');
  const [optimizationResponse, setOptimizationResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);

  // Check backend health on mount
  useEffect(() => {
    async function checkHealth() {
      const health = await checkBackendHealth();
      setBackendHealth(health);
    }
    checkHealth();
  }, []);

  const handleRunOptimization = async () => {
    setIsLoading(true);
    setError(null);

    let incidentsToSolve = [];
    if (isContentionMode) {
      incidentsToSolve = [
        PRESET_INCIDENT_LOCATIONS[0], // HOTSPOT-01 Tambaram
        PRESET_INCIDENT_LOCATIONS[3]  // HOTSPOT-04 Katpadi Railway
      ];
    } else {
      const preset = PRESET_INCIDENT_LOCATIONS.find((p) => p.id === selectedPresetId) || PRESET_INCIDENT_LOCATIONS[0];
      incidentsToSolve = [preset];
    }

    const payload = buildOptimizationPayload({
      incidents: incidentsToSolve,
      objectiveMode,
      alpha: 1.0,
      beta: 1.0,
      M: 10000.0,
      allowUnservedPenalty: true,
      enforceStrictAls: true
    });

    const result = await executePulpOptimization(payload);

    if (result.success) {
      setOptimizationResponse(result.data);
    } else {
      setError(result.error);
      setOptimizationResponse(null);
    }

    setIsLoading(false);
  };

  // Run automatically on first load
  useEffect(() => {
    handleRunOptimization();
  }, [selectedPresetId, isContentionMode, objectiveMode]);

  return (
    <div className="space-y-6">
      {/* 1. Top Banner */}
      <div className="bg-graphite-900 border border-graphite-border rounded-xl p-5 text-stone-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-burnt-600 text-white shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Mathematical Operations Research Optimisation Engine
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-tealops-800 text-tealops-200 border border-tealops-700 font-bold uppercase">
                  FastAPI + PuLP MILP (CBC)
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Exact Mixed-Integer Linear Programming allocating emergency ambulances and clinical beds across Tamil Nadu.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="font-mono text-xs text-stone-300 bg-graphite-950 px-3 py-1.5 rounded-lg border border-graphite-border">
              <span>Backend Status: </span>
              {backendHealth?.isOnline ? (
                <span className="text-emerald-400 font-bold">ONLINE (:8000)</span>
              ) : (
                <span className="text-amber-400 font-bold">CONNECTING...</span>
              )}
            </div>

            {optimizationResponse && (
              <div className="font-mono text-xs text-stone-300 bg-graphite-950 px-3 py-1.5 rounded-lg border border-graphite-border">
                <span>Solve Latency: </span>
                <span className="text-emerald-400 font-bold">{optimizationResponse.execution_time_ms} ms</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Interactive Scenario Controls Bar */}
      <div className="bg-white border border-ivory-border rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-ivory-border">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-800 font-mono">
            Scenario Preset & Objective Configuration
          </span>
          <span className="text-[10px] font-mono text-stone-500">
            Real-Time PuLP Model Execution
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-stone-600 mr-1">Scenario:</span>
            {PRESET_INCIDENT_LOCATIONS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setIsContentionMode(false);
                  setSelectedPresetId(preset.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                  !isContentionMode && selectedPresetId === preset.id
                    ? 'bg-burnt-600 text-white border-burnt-500 shadow-xs'
                    : 'bg-ivory-50 text-stone-700 border-ivory-border hover:bg-ivory-100'
                }`}
              >
                {preset.id}
              </button>
            ))}

            {/* Contention Preset */}
            <button
              onClick={() => setIsContentionMode(true)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1.5 ${
                isContentionMode
                  ? 'bg-critical-700 text-white border-critical-600 shadow-xs'
                  : 'bg-critical-50 text-critical-800 border-critical-200 hover:bg-critical-100'
              }`}
            >
              <span>⚡ Two-Incident Contention (01 + 04)</span>
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-600">Mode:</span>
            <div className="flex rounded-lg border border-ivory-border overflow-hidden text-xs font-mono">
              <button
                onClick={() => setObjectiveMode('weighted_sum')}
                className={`px-3 py-1 font-bold ${
                  objectiveMode === 'weighted_sum'
                    ? 'bg-stone-900 text-white'
                    : 'bg-ivory-50 text-stone-600 hover:bg-ivory-100'
                }`}
              >
                Weighted-Sum
              </button>
              <button
                onClick={() => setObjectiveMode('lexicographic')}
                className={`px-3 py-1 font-bold ${
                  objectiveMode === 'lexicographic'
                    ? 'bg-stone-900 text-white'
                    : 'bg-ivory-50 text-stone-600 hover:bg-ivory-100'
                }`}
              >
                Lexicographic
              </button>
            </div>

            <button
              onClick={handleRunOptimization}
              disabled={isLoading}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-burnt-600 hover:bg-burnt-500 text-white transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isLoading ? 'Solving...' : 'Re-Run Solver'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Detailed PuLP Comparison Panel */}
      <OptimizationComparisonPanel
        optimizationResponse={optimizationResponse}
        isLoading={isLoading}
        error={error}
        onRunOptimization={handleRunOptimization}
        scenarioMode={isContentionMode ? 'contention' : 'single'}
      />

      {/* 4. Provenance Notices & Transparency */}
      {optimizationResponse?.data_provenance_notices && (
        <div className="p-4 rounded-xl bg-ivory-50 border border-ivory-border space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-800 font-mono block">
            Data Provenance & Assumption Disclosures
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {optimizationResponse.data_provenance_notices.map((notice, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-white border border-ivory-border">
                <div className="flex items-center gap-1.5 font-bold text-stone-800 font-mono text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${notice.is_verified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>{notice.label}</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                  {notice.statement}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
