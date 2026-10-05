import React from 'react';
import { SignalStatistics } from '../strategy/signalEvaluator';
import { Award, CheckCircle, XCircle, MinusCircle, Clock } from 'lucide-react';

interface StatsSummaryBarProps {
  stats: SignalStatistics;
}

export const StatsSummaryBar: React.FC<StatsSummaryBarProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {/* Win Rate */}
      <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>Win Rate</span>
          <Award className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-2">
          <span
            className={`text-2xl font-bold font-mono tabular-nums ${
              stats.winRate >= 60 ? 'text-emerald-400' : stats.winRate >= 50 ? 'text-amber-400' : 'text-slate-300'
            }`}
          >
            {stats.winRate}%
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            {stats.resolved} resolved trades
          </span>
        </div>
      </div>

      {/* Total Signals */}
      <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>Total Signals</span>
          <span className="text-slate-500 font-mono text-xs">ALL</span>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold font-mono text-white tabular-nums">
            {stats.total}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">Generated rule alerts</span>
        </div>
      </div>

      {/* Wins */}
      <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>Wins</span>
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {stats.wins}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">Profitable signals</span>
        </div>
      </div>

      {/* Losses */}
      <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>Losses</span>
          <XCircle className="w-4 h-4 text-rose-400" />
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
            {stats.losses}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">Unfavorable moves</span>
        </div>
      </div>

      {/* Pending / Draws */}
      <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg flex flex-col justify-between col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>Pending / Draws</span>
          <Clock className="w-4 h-4 text-amber-400" />
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {stats.pending}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ {stats.draws} draw</span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-0.5">Awaiting candle close</span>
        </div>
      </div>
    </div>
  );
};
