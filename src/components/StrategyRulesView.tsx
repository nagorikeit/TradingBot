import React, { useEffect, useState } from 'react';
import {
  Sliders,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  Layers,
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
      msg: `${activeProfile.shortLabel} রুল আপডেট সাইকেল ${days} দিন নির্ধারণ করা হয়েছে।`,
    });
    setTimeout(() => setAuditFeedbackBn(null), 5000);
  };

  const handleManualCohortAudit = () => {
    const res = agentLearningService.runCohortAudit(activeProfileId, true);
    setAuditFeedbackBn({ ok: res.executed, msg: res.reasonBn });
    setTimeout(() => setAuditFeedbackBn(null), 7000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Profile Selector */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                মাল্টি-প্ল্যাটফর্ম স্ট্র্যাটেজি ও রুল প্রোফাইল
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              স্ক্যান করার সময় শুধুমাত্র সিলেক্ট করা প্রোফাইলের নিজস্ব রুলগুলোই প্রয়োগ হয়। প্রতিটি সিগন্যাল লগে জমা হয় এবং ৭ বা ৩০ দিনের কোহর্ট বিশ্লেষণ শেষে রুল নিরাপদভাবে আপডেট হয়।
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap self-start sm:self-center">
            অ্যাক্টিভ: {activeProfile.shortLabel}
          </span>
        </div>

        {/* 5 Platform Profile Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {TRADING_PROFILE_LIST.map((profile) => {
            const isSelected = profile.id === activeProfileId;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => tradingProfileService.setActiveProfile(profile.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-emerald-950/50 border-emerald-500/70 shadow-sm'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <span className={`text-xs font-bold ${isSelected ? 'text-emerald-300' : 'text-white'}`}>
                    {profile.labelBn}
                  </span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </div>
                <div className="text-[11px] text-slate-400 truncate">{profile.platformsExample}</div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                  <span className={isSelected ? 'text-cyan-300' : 'text-slate-500'}>
                    {profile.defaultTimeframeLabel}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                    {profile.outputMode === 'BINARY_EXPIRY' ? 'CALL/PUT' : 'SL/TP'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Profile Quick Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 text-[11px] block mb-1">প্ল্যাটফর্ম বৈশিষ্ট্য</span>
            <span className="text-slate-200 leading-relaxed">{activeProfile.summaryBn}</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 text-[11px] block mb-1">নো-ট্রেড / সতর্কতা ফিল্টার</span>
            <span className="text-amber-200 leading-relaxed">{activeProfile.noTradeFilterBn}</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 text-[11px] block mb-1">সিগন্যাল আউটপুট ফরম্যাট</span>
            <span className="text-cyan-300 font-semibold block">{activeProfile.suggestedTargetText}</span>
            <span className="text-[11px] text-slate-400 mt-1 block">{activeProfile.aiFocusBn}</span>
          </div>
        </div>
      </div>

      {/* Rules Breakdown Grid for Active Platform */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bullish (CALL / BUY) Rules */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-emerald-400 font-mono">
                {activeProfile.buyLabel} শর্তাবলি (৫টি রুল)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{activeProfile.shortLabel}</span>
          </div>

          <div className="space-y-3 text-xs">
            {activeProfile.rules.map((rule) => (
              <div key={rule.title} className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
                <span className="font-mono font-bold text-emerald-300">{rule.title}</span>
                <p className="text-slate-300">{rule.bullCondition}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bearish (PUT / SELL) Rules */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-rose-400" />
              <h3 className="text-sm font-bold text-rose-400 font-mono">
                {activeProfile.sellLabel} শর্তাবলি (৫টি রুল)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{activeProfile.shortLabel}</span>
          </div>

          <div className="space-y-3 text-xs">
            {activeProfile.rules.map((rule) => (
              <div key={rule.title} className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
                <span className="font-mono font-bold text-rose-300">{rule.title}</span>
                <p className="text-slate-300">{rule.bearCondition}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Isolated Per-Profile Slow Evolution & 7d / 30d Cohort Rule Lock Panel */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">
                {activeProfile.shortLabel} — কোহর্ট লার্নিং ও রুল আপডেট সাইকেল
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-500/30">
                <Lock className="w-3 h-3" />
                রুল লকড (স্থিতিশীল)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              ১টি ক্যান্ডেল বিপরীত হলেই রুল পরিবর্তন হয় না। প্রতিটি সিগন্যাল এই প্রোফাইলের নিজস্ব লগে সংরক্ষিত হয় এবং নির্বাচিত সময়সীমা ও ন্যূনতম সিগন্যাল পূর্ণ হলে তবেই রুল আপডেট হয়।
            </p>
          </div>

          {/* 7-Day / 30-Day Cadence Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => handleCycleChange(7)}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  profileSummary.policy.reviewWindowDays === 7
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ৭ দিন (Weekly)
              </button>
              <button
                type="button"
                onClick={() => handleCycleChange(30)}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  profileSummary.policy.reviewWindowDays === 30
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ৩০ দিন (Monthly)
              </button>
            </div>

            <button
              type="button"
              onClick={handleManualCohortAudit}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 whitespace-nowrap"
              title="কমপক্ষে ১০টি সিগন্যাল জমা থাকলে নিরাপদ কোহর্ট পর্যালোচনা চালান"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>কোহর্ট অডিট</span>
            </button>
          </div>
        </div>

        {auditFeedbackBn && (
          <div
            className={`p-3 rounded-lg border text-xs ${
              auditFeedbackBn.ok
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            }`}
          >
            {auditFeedbackBn.msg}
          </div>
        )}

        {/* Progress & Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">চলতি সাইকেল সিগন্যাল</span>
            <span className="text-sm font-bold text-white font-mono tabular-nums">
              {profileSummary.cohortSignalsCount} / {profileSummary.policy.minSignalsRequired} টি
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">সাইকেল বাকি</span>
            <span className="text-sm font-bold text-cyan-300 font-mono tabular-nums flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {profileSummary.daysRemaining} দিন
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">চলতি কোহর্ট Win Rate</span>
            <span className="text-sm font-bold text-emerald-400 font-mono tabular-nums">
              {profileSummary.cohortSignalsCount > 0 ? `${profileSummary.cohortWinRate}%` : 'ডেটা জমছে'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">আইসোলেটেড অ্যাক্টিভ রুল</span>
            <span className="text-sm font-bold text-white font-mono tabular-nums">
              {profileRules.length} টি ({activeProfile.shortLabel})
            </span>
          </div>
        </div>

        {/* Sample Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{profileSummary.policy.lastCohortVerdictBn}</span>
            <span className="font-mono text-cyan-300">{profileSummary.sampleProgressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${profileSummary.sampleProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Selected Profile's Own Learned Rules Only */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {profileRules.map((rule) => (
            <div key={rule.ruleId} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold text-cyan-300">{rule.recommendedDirection}</span>
                <span className="font-mono text-[11px] text-emerald-300">
                  ওয়েট: {Math.round(rule.confidenceWeight * 100)}%
                </span>
              </div>
              <div className="font-bold text-white leading-snug">{rule.titleBn}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{rule.summaryBn}</p>
              {rule.cautionaryNotesBn[0] && (
                <div className="text-[11px] text-amber-200/80 bg-amber-950/20 border border-amber-500/20 p-2 rounded">
                  সতর্কতা: {rule.cautionaryNotesBn[0]}
                </div>
              )}
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
                <span>মোট ট্রেড: {rule.totalTrades}</span>
                <span>উইন: {rule.winRate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring Tiers & No-Force WAIT Discipline */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>স্কোরিং থ্রেশহোল্ড ও নো-ফোর্স WAIT নীতি</span>
        </h3>
        <p className="text-xs text-slate-400">
          সকল প্রোফাইলেই কমপক্ষে ৪/৫ রুল কনফার্মেশন ছাড়া সিগন্যাল তৈরি হয় না, যাতে অস্থির মার্কেটে ভুল এন্ট্রি এড়ানো যায়।
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-lg border border-emerald-900/60 bg-emerald-950/15">
            <span className="font-mono font-bold text-emerald-400 block text-sm">5 / 5 — STRONG</span>
            <span className="text-slate-300 text-[11px] mt-1 block">
              সবগুলো ৫টি রুল মিলে গেছে। সর্বোচ্চ কনফার্মেশন ({activeProfile.buyLabel} / {activeProfile.sellLabel})।
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-amber-900/60 bg-amber-950/15">
            <span className="font-mono font-bold text-amber-300 block text-sm">4 / 5 — QUALIFIED</span>
            <span className="text-slate-300 text-[11px] mt-1 block">
              ৪টি মূল শর্ত মিলেছে; ট্রেডের জন্য গ্রহণযোগ্য সেটআপ।
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/50">
            <span className="font-mono font-bold text-slate-300 block text-sm flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              ≤ 3 / 5 — WAIT / NO SIGNAL
            </span>
            <span className="text-slate-400 text-[11px] mt-1 block">
              পর্যাপ্ত কনফ্লুয়েন্স নেই। নিরাপদ থাকার জন্য স্বয়ংক্রিয়ভাবে WAIT মোডে রাখা হয়েছে।
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
