import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Menu,
  Shield,
  Clock,
  Radio,
  X,
  Database,
  SlidersHorizontal,
  Compass,
  AlertTriangle
} from 'lucide-react';
import { SYSTEM_INFO } from '../data/mockData';

export default function TopNav({ activeNav, searchQuery, setSearchQuery, onToggleMobileMenu }) {
  const [timeStr, setTimeStr] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Kolkata'
        }) + ' IST'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const alerts = [
    {
      id: 1,
      title: 'Active Scenario Alpha: NH-45 Highway',
      desc: 'Tambaram corridor model loaded for shortest-path optimization',
      time: 'T-00m',
      type: 'critical'
    },
    {
      id: 2,
      title: 'Dataset Verification: 339 Hospital Nodes',
      desc: 'All tertiary and district medical centers indexed for reception',
      time: 'Verified',
      type: 'info'
    },
    {
      id: 3,
      title: 'Geospatial Settlement Retained: 2,391 Points',
      desc: 'Coordinates prepared for spatial cluster allocation',
      time: 'Retained',
      type: 'info'
    }
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-md border-b border-ivory-border shadow-xs">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Left: Mobile Toggle & Page Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-ivory-200 lg:hidden focus:outline-none"
            aria-label="Toggle navigation sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight font-sans">
                {activeNav}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-ivory-200 text-stone-700 border border-ivory-border">
                PALS COMMAND CONSOLE
              </span>
            </div>
            <p className="text-[11px] text-stone-500 hidden md:block">
              {SYSTEM_INFO.title} • {SYSTEM_INFO.jurisdiction}
            </p>
          </div>
        </div>

        {/* Center: Search Field */}
        <div className="hidden lg:flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fleet units (1,353), mapped hospitals (339), districts..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-ivory-50 border border-ivory-border rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-burnt-500/20 focus:border-burnt-600 transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Technical Readout, Notifications, User */}
        <div className="flex items-center gap-3">
          {/* Dual Clock Readout (Aviation Style) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-ivory-200 border border-ivory-border text-xs font-mono font-bold text-stone-800">
            <Clock className="w-3.5 h-3.5 text-burnt-600" />
            <span>{timeStr || '12:00:00 IST'}</span>
          </div>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-ivory-200 transition-colors focus:outline-none"
              aria-label="Simulation Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-burnt-600 rounded-full" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-graphite-900 text-stone-200 rounded-xl shadow-xl border border-graphite-border z-50 overflow-hidden animate-in fade-in duration-100">
                <div className="p-3 bg-graphite-950 border-b border-graphite-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white uppercase tracking-wider font-mono">
                      Operations Notifications
                    </span>
                    <span className="px-1.5 py-0.2 bg-burnt-600/30 text-burnt-300 text-[10px] font-bold rounded">
                      3 Active
                    </span>
                  </div>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-stone-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="divide-y divide-graphite-border max-h-72 overflow-y-auto graphite-scroll">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="p-3 hover:bg-graphite-850 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                            alert.type === 'critical' ? 'bg-critical-500' : 'bg-tealops-500'
                          }`}
                        />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-white">{alert.title}</p>
                          <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">{alert.desc}</p>
                          <span className="text-[10px] text-stone-500 mt-1 block font-mono">{alert.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Operations Officer Badge */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-ivory-border">
            <div className="w-8 h-8 rounded-lg bg-graphite-900 text-burnt-400 flex items-center justify-center font-bold font-mono text-xs border border-graphite-border shadow-xs">
              P1
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-bold text-stone-900">Dr. A. Raman</div>
              <div className="text-[10px] text-stone-500 font-mono">Operations Controller</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
