import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Sliders,
  TrendingUp,
  Download,
  Plus,
  HelpCircle,
  FileText,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  LearnedStrategyRule,
  TradeMistakeReflection,
  LearningCategory,
  LearningHubStats,
} from '../types/learningTypes';
import { agentLearningService } from '../services/agentLearningService';

export const BengaliKnowledgeHub: React.FC = () => {
  const [rules, setRules] = useState<LearnedStrategyRule[]>(() => agentLearningService.getRules());
  const [reflections, setReflections] = useState<TradeMistakeReflection[]>(() =>
    agentLearningService.getReflections()
  );
  const [stats, setStats] = useState<LearningHubStats>(() => agentLearningService.getStats());
  const [activeTab, setActiveTab] = useState<'rules' | 'reflections' | 'simulate'>('rules');
  const [selectedCategory, setSelectedCategory] = useState<LearningCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [simulatedSymbol, setSimulatedSymbol] = useState<string>('EUR/USD OTC');
  const [simulatedDirection, setSimulatedDirection] = useState<'CALL' | 'PUT'>('CALL');
  const [simulatedNote, setSimulatedNote] = useState<string>('');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = agentLearningService.subscribe(() => {
      setRules(agentLearningService.getRules());
      setReflections(agentLearningService.getReflections());
      setStats(agentLearningService.getStats());
    });
    return unsub;
  }, []);

  const handleSimulateLoss = (ruleId?: string) => {
    const rule = ruleId ? agentLearningService.getRuleById(ruleId) : undefined;
    const res = agentLearningService.recordOutcome(
      simulatedSymbol,
      simulatedDirection,
      'LOSS',
      rule?.titleBn,
      simulatedNote || undefined
    );

    setNotificationMsg(
      `⚠️ ভুল রেকর্ড করা হয়েছে! এআই কৌশলটি পর্যালোচনা করে সতর্কতা নোট যুক্ত করেছে এবং কনফিডেন্স ৫% হ্রাস করেছে।`
    );
    setTimeout(() => setNotificationMsg(null), 6000);
    setActiveTab('reflections');
  };

  const handleSimulateWin = (ruleId?: string) => {
    const rule = ruleId ? agentLearningService.getRuleById(ruleId) : undefined;
    agentLearningService.recordOutcome(
      simulatedSymbol,
      simulatedDirection,
      'WIN',
      rule?.titleBn
    );

    setNotificationMsg(`✅ ট্রেডটি সফল (WIN) হিসেবে যাচাই হয়েছে! কনফিডেন্স স্কোর বৃদ্ধি পেয়েছে।`);
    setTimeout(() => setNotificationMsg(null), 5000);
  };

  const handleExport = () => {
    const dataStr = agentLearningService.exportKnowledgeAsJson();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tradepulse_ai_bengali_playbook_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredRules = rules.filter((r) => {
    const matchCategory = selectedCategory === 'ALL' || r.category === selectedCategory;
    const matchSearch =
      !searchQuery.trim() ||
      r.titleBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.summaryBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.conditionsBn.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Top Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  AI Knowledge Hub & Self-Learning Playbook
                </h1>
                <span className="text-xs text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                  বাংলা ডায়েরি
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                এআই এজেন্ট এখানে তার সমস্ত টেকনিক্যাল কৌশল, চার্ট পড়ার নিয়মাবলি এবং অতীতের ভুল থেকে শেখা অভিজ্ঞতা বাংলায় সংরক্ষণ করে।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
              title="প্লেবুক ব্যাকআপ হিসেবে ডাউনলোড করুন"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>ডাউনলোড (JSON)</span>
            </button>
            <button
              onClick={() => agentLearningService.resetToDefaults()}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 rounded-lg flex items-center gap-1.5 transition-colors"
              title="ডিফল্ট নিয়মে রিসেট করুন"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>রিসেট</span>
            </button>
          </div>
        </div>

        {/* Global Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-lg">
            <span className="text-[11px] text-slate-400 block">সংরক্ষিত কৌশল</span>
            <span className="text-base font-bold text-white font-mono tabular-nums">
              {stats.totalRules} টি
            </span>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-lg">
            <span className="text-[11px] text-slate-400 block">সামগ্রিক সফলতার হার</span>
            <span className="text-base font-bold text-emerald-400 font-mono tabular-nums">
              {stats.overallWinRate}%
            </span>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-lg">
            <span className="text-[11px] text-slate-400 block">ভুল থেকে অর্জিত শিক্ষা</span>
            <span className="text-base font-bold text-amber-400 font-mono tabular-nums">
              {stats.totalReflections} বার
            </span>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-lg">
            <span className="text-[11px] text-slate-400 block">সংশোধিত কৌশল</span>
            <span className="text-base font-bold text-cyan-400 font-mono tabular-nums">
              {stats.revisedRules} টি
            </span>
          </div>
        </div>
      </div>

      {/* Floating Notification Alert */}
      {notificationMsg && (
        <div className="p-3 bg-cyan-950/70 border border-cyan-500/50 rounded-xl text-cyan-200 text-xs flex items-center justify-between shadow-lg animate-fadeIn">
          <span>{notificationMsg}</span>
          <button
            onClick={() => setNotificationMsg(null)}
            className="text-cyan-400 hover:text-white font-bold text-xs ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>কৌশল ও নিয়মাবলি ({rules.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reflections')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'reflections'
                ? 'bg-slate-800 text-amber-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>ভুল বিশ্লেষণ ও পোস্ট-মর্টেম ({reflections.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('simulate')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'simulate'
                ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>সেলফ-লার্নিং টেস্ট ল্যাব</span>
          </button>
        </div>
      </div>

      {/* TAB 1: RULES & STRATEGIES */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { id: 'ALL', label: 'সকল কৌশল' },
                  { id: 'CANDLESTICK', label: 'ক্যান্ডেলস্টিক' },
                  { id: 'INDICATOR', label: 'ইন্ডিকেটর' },
                  { id: 'SUPPORT_RESISTANCE', label: 'সাপোর্ট/রেজিস্ট্যান্স' },
                  { id: 'OTC_TRAP', label: 'ওটিসি ট্র্যাপ ফিল্টার' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/40'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="বাংলায় কৌশল খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Rules Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRules.map((rule) => (
              <div
                key={rule.ruleId}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-md flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
              >
                <div>
                  {/* Top Bar with Category, Direction & Confidence */}
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-cyan-400">
                        {rule.category === 'CANDLESTICK' && 'ক্যান্ডেলস্টিক'}
                        {rule.category === 'INDICATOR' && 'ইন্ডিকেটর'}
                        {rule.category === 'SUPPORT_RESISTANCE' && 'সাপোর্ট/রেজিস্ট্যান্স'}
                        {rule.category === 'OTC_TRAP' && 'ওটিসি স্পেশাল'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-mono font-bold ${
                          rule.recommendedDirection === 'CALL'
                            ? 'text-emerald-400'
                            : rule.recommendedDirection === 'PUT'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {rule.recommendedDirection === 'CALL' && 'CALL (UP)'}
                        {rule.recommendedDirection === 'PUT' && 'PUT (DOWN)'}
                        {rule.recommendedDirection === 'WAIT' && 'WAIT (অপেক্ষা)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">কনফিডেন্স:</span>
                      <span className="font-mono text-cyan-300 font-bold tabular-nums">
                        {Math.round(rule.confidenceWeight * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <h3 className="text-sm font-bold text-white mt-2 leading-snug">{rule.titleBn}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{rule.summaryBn}</p>

                  {/* Step-by-Step Conditions */}
                  <div className="mt-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-300 block">
                      প্রবেশের শর্তাবলি (Entry Conditions):
                    </span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {rule.conditionsBn.map((cond, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                          <span>{cond}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Cautionary Notes / Mistakes Learned */}
                  {rule.cautionaryNotesBn.length > 0 && (
                    <div className="mt-3 bg-amber-950/20 border border-amber-500/30 p-2.5 rounded-lg space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>ভুল থেকে শেখা সতর্কতা (Lessons Learned):</span>
                      </div>
                      <ul className="text-[11px] text-amber-200/80 space-y-0.5">
                        {rule.cautionaryNotesBn.map((note, nIdx) => (
                          <li key={nIdx}>• {note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Footer with Performance Stats & Learning Action */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                    <span>ট্রেড: {rule.totalTrades}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-400">উইন: {rule.winRate}%</span>
                    {rule.learnedFromFailureCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-400">সংশোধিত: {rule.learnedFromFailureCount} বার</span>
                      </>
                    )}
                  </div>

                  {/* Interactive Quick Feedback Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleSimulateWin(rule.ruleId)}
                      className="px-2 py-1 text-[11px] bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-600/40 text-emerald-300 rounded transition-colors"
                      title="এই কৌশলে জয় হয়েছে চিহ্নিত করুন"
                    >
                      + Win
                    </button>
                    <button
                      onClick={() => handleSimulateLoss(rule.ruleId)}
                      className="px-2 py-1 text-[11px] bg-rose-950/40 hover:bg-rose-900/60 border border-rose-600/40 text-rose-300 rounded transition-colors"
                      title="এই কৌশলে ভুল হয়েছে চিহ্নিত করে সেলফ-লার্নিং সক্রিয় করুন"
                    >
                      - Loss (শিক্ষা)
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredRules.length === 0 && (
            <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">এই ফিল্টারে কোনো সংরক্ষিত কৌশল পাওয়া যায়নি।</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MISTAKE REFLECTIONS DIARY */}
      {activeTab === 'reflections' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              <span>এআই সেলফ-লার্নিং হিস্ট্রি ও ভুল সংশোধন ডায়েরি</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              যখনই কোনো লাইভ ট্রেড বা সিগন্যাল প্রত্যাশা অনুযায়ী কাজ করেনি, এআই নিজে সেই ভুলটির কারণ বিশ্লেষণ করেছে এবং পরবর্তীতে একই ভুল না করার জন্য কৌশল সংশোধন করেছে।
            </p>
          </div>

          <div className="space-y-3">
            {reflections.map((ref) => (
              <div
                key={ref.reflectionId}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white font-mono">{ref.symbol}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        ref.direction === 'CALL' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {ref.direction} ({ref.suggestedExpiry})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-400">{ref.expectedPatternBn}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                    <span className="text-rose-400 bg-rose-950/40 border border-rose-800/40 px-1.5 py-0.5 rounded">
                      ফলাফল: লস (ভুল)
                    </span>
                    <span>{new Date(ref.timestamp).toLocaleTimeString('bn-BD')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-rose-950/20 border border-rose-800/30 p-3 rounded-lg">
                    <span className="font-semibold text-rose-300 block mb-1">
                      ভুলের কারণ (Why it failed):
                    </span>
                    <p className="text-slate-300 leading-relaxed">{ref.failureReasonBn}</p>
                    <span className="text-[10px] text-slate-500 mt-2 block font-mono">
                      মার্কেট অবস্থা: {ref.marketConditionBn}
                    </span>
                  </div>

                  <div className="bg-cyan-950/20 border border-cyan-800/30 p-3 rounded-lg">
                    <span className="font-semibold text-cyan-300 block mb-1">
                      এআই-এর গৃহীত সংশোধন (Corrective Action):
                    </span>
                    <p className="text-slate-300 leading-relaxed">{ref.correctiveActionBn}</p>
                    <span className="text-[10px] text-cyan-400/80 mt-2 block font-mono">
                      কনফিডেন্স পেনাল্টি: -{ref.confidencePenaltyPercent}%
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {reflections.length === 0 && (
              <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs text-slate-400">এখনো কোনো ভুলের রেকর্ড নেই। সমস্ত ট্রেড নিখুঁতভাবে চলছে।</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SELF-LEARNING TEST LAB */}
      {activeTab === 'simulate' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">সেলফ-লার্নিং টেস্ট ল্যাব (Interactive Learning Sandbox)</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            এখানে আপনি যেকোনো ট্রেডের ফলাফল (Win অথবা Loss) এআই-কে জানিয়ে টেস্ট করতে পারেন। এআই সাথে সাথে সেই তথ্য বিশ্লেষণ করে বাংলায় পোস্ট-মর্টেম কারণ তৈরি করবে এবং সংশ্লিষ্ট কৌশলের ওপর সতর্কতা ও কনফিডেন্স পরিবর্তন করবে।
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">অ্যাসেট সিম্বল</label>
              <select
                value={simulatedSymbol}
                onChange={(e) => setSimulatedSymbol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="EUR/USD OTC">EUR/USD OTC</option>
                <option value="AUD/CHF OTC">AUD/CHF OTC</option>
                <option value="BTC/USDT">BTC/USDT</option>
                <option value="GBP/USD OTC">GBP/USD OTC</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">সিগন্যাল দিক</label>
              <select
                value={simulatedDirection}
                onChange={(e) => setSimulatedDirection(e.target.value as 'CALL' | 'PUT')}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="CALL">CALL (UP)</option>
                <option value="PUT">PUT (DOWN)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">কাস্টম পর্যবেক্ষণ নোট (ঐচ্ছিক)</label>
              <input
                type="text"
                placeholder="যেমন: নিউজ স্পাইকে সাপোর্ট ভেঙেছে..."
                value={simulatedNote}
                onChange={(e) => setSimulatedNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handleSimulateWin()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>সফল ট্রেড সাবমিট করুন (Record Win)</span>
            </button>

            <button
              onClick={() => handleSimulateLoss()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>ভুল ট্রেড সাবমিট করুন (Trigger AI Self-Learning)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
