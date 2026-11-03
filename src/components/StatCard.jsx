import React from 'react';
import {
  Truck,
  Building2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Database,
  FlaskConical,
  ShieldCheck
} from 'lucide-react';

export default function StatCard({
  title,
  value,
  change,
  status,
  details,
  isVerified,
  isSimulated,
  unitLabel = 'units'
}) {
  // Status indicator colors strictly applied per guidelines:
  // teal: available resources and successful operations
  // red: critical emergencies
  // amber: warnings and delays
  // green: safe/available status
  // burnt: primary actions / operational highlight
  const statusStyles = {
    teal: {
      border: 'border-l-tealops-600',
      iconBg: 'bg-tealops-50 text-tealops-700',
      dotColor: 'bg-tealops-600',
      Icon: ShieldCheck
    },
    burnt: {
      border: 'border-l-burnt-600',
      iconBg: 'bg-burnt-50 text-burnt-700',
      dotColor: 'bg-burnt-600',
      Icon: Truck
    },
    red: {
      border: 'border-l-critical-600',
      iconBg: 'bg-critical-50 text-critical-700',
      dotColor: 'bg-critical-600',
      Icon: AlertCircle
    },
    amber: {
      border: 'border-l-caution-600',
      iconBg: 'bg-caution-50 text-caution-700',
      dotColor: 'bg-caution-600',
      Icon: AlertTriangle
    },
    green: {
      border: 'border-l-operational-600',
      iconBg: 'bg-operational-50 text-operational-700',
      dotColor: 'bg-operational-600',
      Icon: CheckCircle2
    }
  };

  const currentStyle = statusStyles[status] || statusStyles.burnt;
  const StatusIcon = currentStyle.Icon;

  return (
    <div
      className={`bg-white rounded-xl p-4 sm:p-5 border border-ivory-border border-l-4 ${currentStyle.border} shadow-xs hover:border-ivory-borderDark transition-colors relative overflow-hidden`}
    >
      {/* Top row: Label & Provenance Badge */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 font-mono block">
            {title}
          </span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight font-mono">
              {value}
            </span>
            <span className="text-xs text-stone-500 font-medium">{unitLabel}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className={`p-2 rounded-lg ${currentStyle.iconBg}`}>
            <StatusIcon className="w-4 h-4" />
          </div>
          {isVerified && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-ivory-200 text-stone-700 border border-ivory-border font-mono uppercase">
              <Database className="w-2.5 h-2.5 text-stone-600" />
              Verified
            </span>
          )}
          {isSimulated && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-burnt-50 text-burnt-700 border border-burnt-200 font-mono uppercase">
              <FlaskConical className="w-2.5 h-2.5 text-burnt-600" />
              Simulated
            </span>
          )}
        </div>
      </div>

      {/* Bottom row: Context Details */}
      <div className="mt-3 pt-2.5 border-t border-ivory-border/70 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
          <span className={`w-1.5 h-1.5 rounded-full ${currentStyle.dotColor}`} />
          <span>{change}</span>
        </div>
        {details && (
          <p className="text-[11px] text-stone-500 leading-snug truncate mt-0.5">
            {details}
          </p>
        )}
      </div>
    </div>
  );
}
