import React from 'react';
import {
  Users,
  ShieldCheck,
  MapPin,
  PhoneCall,
  Activity,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import { RESCUE_TEAMS } from '../data/mockData';

export default function RescueTeamsView() {
  return (
    <div className="space-y-5">
      {/* Overview Banner */}
      <div className="bg-graphite-900 border border-graphite-border rounded-xl p-5 text-stone-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-tealops-700 text-white shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Specialized Medical Triage & Rapid Rescue Formations
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Regional disaster response task forces trained for highway mass-casualty extrication, chemical trauma, and rural floods.
            </p>
          </div>
        </div>
      </div>

      {/* Task Forces Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {RESCUE_TEAMS.map((team) => (
          <div
            key={team.id}
            className="bg-white border border-ivory-border rounded-xl p-5 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-tealops-700 uppercase">
                    {team.id} • {team.zone}
                  </span>
                  <h3 className="text-sm font-bold text-stone-900 mt-0.5">{team.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>{team.district}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-operational-50 text-operational-700 border border-operational-200">
                  {team.status}
                </span>
              </div>

              <div className="mt-3.5 space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border">
                  <span className="text-stone-500 block text-[11px]">Commanding Lead Officer:</span>
                  <span className="font-semibold text-stone-800">{team.leadOfficer}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border">
                  <span className="text-stone-500 block text-[11px]">Core Operational Speciality:</span>
                  <span className="font-medium text-stone-800">{team.speciality}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-ivory-50 border border-ivory-border">
                  <span className="text-stone-500 block text-[11px]">Deployable Equipment:</span>
                  <span className="text-stone-700 text-[11px] leading-relaxed">{team.equipmentDeployable}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-ivory-border flex items-center justify-between text-xs text-stone-600">
              <span className="font-mono text-stone-500">Personnel: {team.membersCount} Specialists</span>
              <button className="px-3 py-1 text-xs font-semibold rounded bg-burnt-50 text-burnt-700 border border-burnt-200 hover:bg-burnt-100 transition-colors">
                Alert Formation
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

