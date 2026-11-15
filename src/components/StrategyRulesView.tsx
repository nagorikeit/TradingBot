import React, { useEffect, useState } from 'react';
import {
  Sliders,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Lock,
  Calendar,
  Brain,
  RefreshCw,
} from 'lucide-react';
import { TRADING_PROFILE_LIST, TradingProfileId, getTradingProfile } from '../strategy/tradingProfiles';
import { tradingProfileService } from '../services/tradingProfileService';
import { agentLearningService } from '../services/agentLearningService';
import { LearnedStrategyRule, ProfileLearningSummary, ReviewWindowDays } from '../types/learningTypes';

export const StrategyRulesView: React.FC = () => {
  const [activeProfileId, setActiveProfileId] = useState<TradingProfileId>(() =>
    tradingProfileService.getActiveProfileId()
  );
  const [profileRules, setProfileRules] = useState<LearnedStrategyRule[]>(() =>
    agentLearningService.getRulesByProfile(tradingProfileService.getActiveProfileId())
  );
  const [profileSummary, setProfileSummary] = useState<ProfileLearningSummary>(() =>
    agentLearningService.getProfileSummary(tradingProfileService.getActiveProfileId())
  );
  const [auditFeedbackBn, setAuditFeedbackBn] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const syncData = (profileId: TradingProfileId) => {
      setProfileRules(agentLearningService.getRulesByProfile(profileId));
      setProfileSummary(agentLearningService.getProfileSummary(profileId));
    };

    const unsubProfile = tradingProfileService.subscribe((id) => {
      setActiveProfileId(id);
      syncData(id);
      setAuditFeedbackBn(null);
    });

    const unsubLearning = agentLearningService.subscribe(() => {
      syncData(tradingProfileService.getActiveProfileId());
    });

    return () => {
      unsubProfile();
      unsubLearning();
    };
  }, []);

  const activeProfile = getTradingProfile(activeProfileId);

  const handleCycleChange = (days: ReviewWindowDays) => {
    agentLearningService.setReviewWindow(activeProfileId, days);
    setAuditFeedbackBn({
      ok: true,
      msg: `${activeProfile.shortLabel}: ${days} দিন সাইকেল নির্ধারিত হয়েছে।`,
    });
    setTimeout(() => setAuditFeedbackBn(null), 4000);
  };

  const handleManualCohortAudit = () => {
    const res = agentLearningService.runCohortAudit(activeProfileId, true);
    setAuditFeedbackBn({ ok: res.executed, msg: res.reasonBn });
    setTimeout(() => setAuditFeedbackBn(null), 6000);
  };

  return (
    <div className="space-y-5">
      {/* Header + Single-Line Platform Buttons */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-white">স্ট্র্যাটেজি ও রুলস</h2>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
            {activeProfile.shortLabel} · {activeProfile.defaultTimeframeLabel}
          </span>
        </div>

        {/* ALL 5 Platform Buttons Strictly in ONE Horizontal Line */}
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-thin">
          {TRADING_PROFILE_LIST.map((profile) => {
            const isSelected = profile.id === activeProfileId;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => tradingProfileService.setActiveProfile(profile.id)}
                className={`flex-1 min-w-fit px-3.5 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span>{profile.shortLabel}</span>
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rules Breakdown Grid for Active Platform */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Bullish (CALL / BUY) Rules */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
                {activeProfile.buyLabel}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{activeProfile.shortLabel}</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {activeProfile.rules.map((rule) => (
              <div key={rule.title} className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 space-y-0.5">
                <span className="font-mono font-bold text-emerald-300">{rule.title}</span>
                <p className="text-slate-300">{rule.bullCondition}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bearish (PUT / SELL) Rules */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs sm:text-sm font-bold text-rose-400 font-mono">
                {activeProfile.sellLabel}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{activeProfile.shortLabel}</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {activeProfile.rules.map((rule) => (
              <div key={rule.title} className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 space-y-0.5">
                <span className="font-mono font-bold text-rose-300">{rule.title}</span>
                <p className="text-slate-300">{rule.bearCondition}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cohort Learning & Single-Line Review Cycle Bar */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-cyan-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
              {activeProfile.shortLabel} লার্নিং সাইকেল
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
              <Lock className="w-3 h-3" />
              রুল লকড
            </span>
          </div>

          {/* Single-Line Cycle + Audit Controls */}
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
            <button
              type="button"
              onClick={() => handleCycleChange(7)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                profileSummary.policy.reviewWindowDays === 7
                  ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              ৭ দিন
            </button>
            <button
              type="button"
              onClick={() => handleCycleChange(30)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                profileSummary.policy.reviewWindowDays === 30
                  ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              ৩০ দিন
            </button>
            <button
              type="button"
              onClick={handleManualCohortAudit}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>অডিট</span>
            </button>
          </div>
        </div>

        {auditFeedbackBn && (
          <div
            className={`p-2.5 rounded-lg border text-xs ${
              auditFeedbackBn.ok
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            }`}
          >
            {auditFeedbackBn.msg}
          </div>
        )}

        {/* Essential Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">সিগন্যাল লগ</span>
            <span className="text-sm font-bold text-white font-mono tabular-nums">
              {profileSummary.cohortSignalsCount} / {profileSummary.policy.minSignalsRequired}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">সময় বাকি</span>
            <span className="text-sm font-bold text-cyan-300 font-mono tabular-nums flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {profileSummary.daysRemaining} দিন
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Win Rate</span>
            <span className="text-sm font-bold text-emerald-400 font-mono tabular-nums">
              {profileSummary.cohortSignalsCount > 0 ? `${profileSummary.cohortWinRate}%` : '--'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">অ্যাক্টিভ রুল</span>
            <span className="text-sm font-bold text-white font-mono tabular-nums">
              {profileRules.length} টি
            </span>
          </div>
        </div>

        {/* Isolated Active Learned Rules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {profileRules.map((rule) => (
            <div key={rule.ruleId} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold text-cyan-300">{rule.recommendedDirection}</span>
                <span className="font-mono text-[11px] text-emerald-300">
                  {Math.round(rule.confidenceWeight * 100)}%
                </span>
              </div>
              <div className="font-bold text-white leading-snug">{rule.titleBn}</div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                <span>ট্রেড: {rule.totalTrades}</span>
                <span>উইন: {rule.winRate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
