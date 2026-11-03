import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Truck,
  Building2,
  Activity,
  Milestone
} from 'lucide-react';

export default function SimulationController({
  activeIncident,
  onSimulationUpdate,
  onSimulationReset
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100%
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 1x, 2x, 5x, 10x
  const [currentPhase, setCurrentPhase] = useState('Idle');
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  const waypoints = activeIncident?.routeWaypoints || [];

  // 4 Core Event Milestones along the emergency response timeline
  const EVENT_MILESTONES = [
    { id: 'dispatch', label: 'Dispatch', time: 'T+00m', percent: 0, phase: 'Phase 1: Unit Dispatched — In Transit' },
    { id: 'arrival', label: 'Scene Arrival', time: 'T+08m', percent: 33, phase: 'Phase 2: On Scene — Paramedic Triage & Extrication' },
    { id: 'evacuation', label: 'Evacuation', time: 'T+14m', percent: 58, phase: 'Phase 3: Evacuation Transit — En Route to Tertiary Hospital' },
    { id: 'handover', label: 'Handover', time: 'T+24m', percent: 100, phase: 'Phase 4: Hospital Intake & Emergency Ward Handover' }
  ];

  // Interpolate position along waypoints given progress (0 to 100)
  const interpolatePosition = (prog, pts) => {
    if (!pts || pts.length < 2) return null;
    const totalSegments = pts.length - 1;
    const progressFrac = Math.min(Math.max(prog / 100, 0), 1);
    const overallSegment = progressFrac * totalSegments;
    const segIndex = Math.min(Math.floor(overallSegment), totalSegments - 1);
    const segFrac = overallSegment - segIndex;

    const p1 = pts[segIndex];
    const p2 = pts[segIndex + 1];

    const lat = p1[0] + (p2[0] - p1[0]) * segFrac;
    const lng = p1[1] + (p2[1] - p1[1]) * segFrac;

    // Collect all points traveled up to this position
    const traveled = pts.slice(0, segIndex + 1);
    traveled.push([lat, lng]);

    return { pos: { lat, lng }, traveled };
  };

  const getPhaseForProgress = (pct) => {
    if (pct >= 100) return 'Phase 4: Hospital Intake & Emergency Ward Handover — Complete';
    if (pct >= 58) return 'Phase 3: Evacuation Transit — En Route to Tertiary Hospital';
    if (pct >= 33) return 'Phase 2: On Scene — Paramedic Triage & Extrication';
    if (pct > 0) return 'Phase 1: Unit Dispatched — In Transit to Incident';
    return 'Idle — Ready for Simulation Trigger';
  };

  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      return;
    }

    const durationMs = 24000 / speedMultiplier; // 24 seconds wall clock representing 24 simulation minutes

    const tick = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      setProgress((prev) => {
        const next = prev + (delta / durationMs) * 100;

        if (next >= 100) {
          setIsPlaying(false);
          setCurrentPhase('Completed — Emergency Handover Finished');
          return 100;
        }

        setCurrentPhase(getPhaseForProgress(next));
        return next;
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speedMultiplier]);

  // Push telemetry update to map
  useEffect(() => {
    if (waypoints.length >= 2) {
      const { pos, traveled } = interpolatePosition(progress, waypoints) || {};
      if (onSimulationUpdate) {
        onSimulationUpdate({
          isPlaying,
          progress,
          currentVehiclePos: pos,
          traveledWaypoints: traveled,
          phase: currentPhase
        });
      }
    }
  }, [progress, isPlaying, currentPhase]);

  const handlePlayPause = () => {
    if (progress >= 100) {
      setProgress(0);
      setCurrentPhase(getPhaseForProgress(0));
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentPhase('Idle — Ready for Simulation Trigger');
    if (onSimulationReset) onSimulationReset();
  };

  const handleJumpToMilestone = (milestone) => {
    setIsPlaying(false);
    setProgress(milestone.percent);
    setCurrentPhase(milestone.phase);
  };

  const handleScrubberClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = Math.min(Math.max((clickX / rect.width) * 100, 0), 100);
    setProgress(newProgress);
    setCurrentPhase(getPhaseForProgress(newProgress));
  };

  // Convert progress (0-100) to simulated minutes (0 to 24 mins)
  const elapsedMinutes = Math.floor((progress / 100) * 24);
  const elapsedSeconds = Math.floor((((progress / 100) * 24) % 1) * 60);
  const timeFormatted = `${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSeconds).padStart(2, '0')}`;

  return (
    <div className="bg-graphite-900 border border-graphite-border rounded-xl p-4 text-stone-200 shadow-md space-y-3">
      {/* 1. Explicit Transparency Notice: Stage 2 Controls vs Pending Engine */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-graphite-950/80 border border-graphite-800 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="font-mono font-bold text-amber-300 uppercase tracking-wide">
            PRE-SIMULATION TIMELINE CONTROLS
          </span>
          <span className="text-stone-400">
            • Route waypoint interpolation active for visual evaluation. <strong>Autonomous multi-agent simulation engine pending Stage 3.</strong>
          </span>
        </div>
        <span className="font-mono text-[10px] text-stone-400">
          Target Scenario: {activeIncident?.id || 'SCEN-2026-01'}
        </span>
      </div>

      {/* 2. Top row: Status & Timeline Readout */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-graphite-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-burnt-600/20 text-burnt-400 border border-burnt-600/30">
            <Activity className={`w-4 h-4 ${isPlaying ? 'animate-pulse text-burnt-400' : 'text-stone-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-burnt-400 font-mono">
                Event-Driven Response Sequence
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-graphite-800 text-stone-300 border border-graphite-700">
                {progress >= 100 ? 'Sequence Ended' : isPlaying ? 'Playback Active' : 'Paused / Standby'}
              </span>
            </div>
            <p className="text-xs text-stone-300 mt-0.5 font-medium">
              {currentPhase}
            </p>
          </div>
        </div>

        {/* Elapsed Simulated Time */}
        <div className="flex items-center gap-3">
          <div className="bg-graphite-950 px-3.5 py-1.5 rounded-lg border border-graphite-border flex items-center gap-2 font-mono shadow-xs">
            <Clock className="w-3.5 h-3.5 text-burnt-400" />
            <span className="text-xs text-stone-400">Current Sim Time:</span>
            <span className="text-sm font-extrabold text-white tracking-wider">T+{timeFormatted}</span>
            <span className="text-[10px] text-stone-400">/ 24:00m</span>
          </div>
        </div>
      </div>

      {/* 3. Interactive Progress Timeline Scrubber with Event Milestone Anchors */}
      <div className="space-y-2">
        {/* Event Milestone Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {EVENT_MILESTONES.map((m) => {
            const isReached = progress >= m.percent;
            return (
              <button
                key={m.id}
                onClick={() => handleJumpToMilestone(m)}
                className={`p-1.5 rounded-lg border text-left transition-all ${
                  isReached
                    ? 'bg-graphite-800/90 border-burnt-500/50 text-white'
                    : 'bg-graphite-950/60 border-graphite-800 text-stone-400 hover:text-stone-300'
                }`}
                title={`Jump to ${m.label} (${m.time})`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-burnt-400 font-bold">{m.time}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${isReached ? 'bg-burnt-400' : 'bg-stone-600'}`} />
                </div>
                <div className="text-xs font-semibold truncate mt-0.5">{m.label}</div>
              </button>
            );
          })}
        </div>

        {/* Clickable Progress Bar */}
        <div
          onClick={handleScrubberClick}
          className="relative w-full h-3 bg-graphite-950 rounded-full overflow-hidden border border-graphite-border cursor-pointer group"
          title="Click to seek along simulation timeline"
        >
          <div
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-burnt-600 via-burnt-500 to-amber-500 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
          {/* Milestone markers */}
          <div className="absolute top-0 bottom-0 left-[33%] w-0.5 bg-stone-500 z-10" title="Milestone: Arrival (33%)" />
          <div className="absolute top-0 bottom-0 left-[58%] w-0.5 bg-stone-500 z-10" title="Milestone: Evacuation (58%)" />
        </div>
      </div>

      {/* 4. Playback Controls & Speed Multipliers */}
      <div className="pt-2 border-t border-graphite-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Play / Pause Button */}
          <button
            onClick={handlePlayPause}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-xs ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                : 'bg-burnt-600 hover:bg-burnt-500 text-white shadow-burnt-600/20'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{progress > 0 && progress < 100 ? 'Resume' : 'Play Dispatch'}</span>
              </>
            )}
          </button>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-graphite-800 hover:bg-graphite-750 text-stone-300 border border-graphite-border flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Speed Selector (1x, 2x, 5x, 10x) */}
        <div className="flex items-center gap-1 bg-graphite-950 p-1 rounded-lg border border-graphite-border text-xs font-mono">
          <span className="text-[10px] text-stone-400 px-2 font-sans">Speed:</span>
          {[1, 2, 5, 10].map((multiplier) => (
            <button
              key={multiplier}
              onClick={() => setSpeedMultiplier(multiplier)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
                speedMultiplier === multiplier
                  ? 'bg-burnt-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              {multiplier}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
