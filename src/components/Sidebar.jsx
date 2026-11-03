import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  SlidersHorizontal,
  Truck,
  Users,
  Building2,
  Cpu,
  BarChart3,
  Compass,
  Database,
  Flame,
  Activity,
  HeartPulse,
  ShieldAlert
} from 'lucide-react';
import { SYSTEM_INFO } from '../data/mockData';

export default function Sidebar({ activeNav = 'Command Centre', setActiveNav, isMobileOpen, setIsMobileOpen }) {
  const navItems = [
    { id: 'Command Centre', label: 'Command Centre', icon: LayoutDashboard },
    { id: 'Live Incident Map', label: 'Live Incident Map', icon: Compass, badge: 'GIS' },
    { id: 'Scenario Simulator', label: 'Scenario Simulator', icon: SlidersHorizontal, badge: 'SIM' },
    { id: 'Cardiac Arrest', label: 'Cardiac Arrest', icon: HeartPulse, badge: 'SIM' },
    { id: 'Ambulance Fleet', label: 'Ambulance Fleet', icon: Truck, meta: '1,353' },
    { id: 'Rescue Teams', label: 'Rescue Teams', icon: Users },
    { id: 'Hospital Network', label: 'Hospital Network', icon: Building2, meta: '339' },
    { id: 'Optimisation Results', label: 'Optimisation Results', icon: Cpu, badge: 'PuLP' },
    { id: 'Analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-graphite-950/70 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container (Frosted Glassmorphism Command Aesthetic) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#121518]/80 backdrop-blur-xl backdrop-saturate-150 text-stone-200 border-r border-white/[0.08] shadow-[4px_0_24px_rgba(0,0,0,0.5)] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Ambient Glass Reflections / Glow Spheres */}
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-burnt-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-16 w-44 h-44 bg-tealops-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-burnt-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="p-5 border-b border-white/[0.08] relative z-10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-burnt-500 to-burnt-600 flex items-center justify-center shadow-lg shadow-burnt-600/30 ring-1 ring-white/20">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-wider text-white font-mono">ERO</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-white/[0.06] text-burnt-400 border border-white/10 backdrop-blur-sm font-mono">
                  TN-ERO
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-medium truncate">
                Operations & Optimisation OS
              </p>
            </div>
          </div>

          {/* Dataset Status Pill (Frosted Glass) */}
          <div className="mt-3.5 px-3 py-1.5 rounded-lg bg-white/[0.03] backdrop-blur-md border border-white/[0.08] text-[11px] text-stone-300 flex items-center justify-between shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <span className="flex items-center gap-1.5 font-mono text-[10px]">
              <Database className="w-3 h-3 text-tealops-400" />
              <span>38 District Records</span>
            </span>
            <span className="font-mono text-tealops-400 font-semibold text-[10px]">LOADED</span>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 graphite-scroll relative z-10">
          <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider uppercase text-stone-400 font-mono">
            Navigation Areas
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  if (setIsMobileOpen) setIsMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-r from-burnt-600/90 via-burnt-500/85 to-burnt-600/90 text-white font-semibold shadow-lg shadow-burnt-950/40 border border-white/20 backdrop-blur-md'
                    : 'text-stone-300 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.08] border border-transparent backdrop-blur-xs'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-white rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                )}
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-stone-400 group-hover:text-burnt-400'
                  }`}
                />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                      isActive
                        ? 'bg-white/20 text-white border border-white/30 backdrop-blur-sm'
                        : 'bg-white/[0.05] text-burnt-300 border border-white/[0.08] backdrop-blur-xs'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {item.meta && (
                  <span
                    className={`text-[10px] font-mono ${
                      isActive ? 'text-burnt-100' : 'text-stone-400 group-hover:text-stone-200'
                    }`}
                  >
                    {item.meta}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Project Badge (Frosted Glassmorphic Panel) */}
        <div className="p-4 border-t border-white/[0.08] bg-black/20 backdrop-blur-md relative z-10">
          <div className="p-3 rounded-xl bg-white/[0.03] backdrop-blur-md border border-white/[0.08] text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2 text-stone-200 font-semibold mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-burnt-400 drop-shadow-[0_0_6px_rgba(249,115,22,0.4)]" />
              <span>Aviation / GIS Architecture</span>
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Designed for Python FastAPI, PuLP MILP solver, and Leaflet OpenStreetMap layers.
            </p>
            <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between text-[10px] text-stone-400 font-mono">
              <span>Stage 2 GIS Engine</span>
              <span>v2.0</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
