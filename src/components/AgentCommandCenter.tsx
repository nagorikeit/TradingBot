import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Cpu,
  Server,
  BookOpen,
  Brain,
  History,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  fetchAgentHealth,
  fetchAgentStats,
  fetchKnowledge,
  fetchMemories,
  executeRetrievalQuery,
  AgentBackendHealth,
  AgentStatsResponse,
  KnowledgeItem,
  AgentMemoryItem,
  RetrievalResult,
} from '../services/agentBackendService';

export const AgentCommandCenter: React.FC = () => {
  const [health, setHealth] = useState<AgentBackendHealth | null>(null);
  const [stats, setStats] = useState<AgentStatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  // Active view within Command Center
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'knowledge' | 'memory' | 'retrieval'>('overview');

  // Sub-tab data
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [memoryList, setMemoryList] = useState<AgentMemoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('Risk Management');
  const [retrievalResult, setRetrievalResult] = useState<RetrievalResult | null>(null);
  const [retrievalLoading, setRetrievalLoading] = useState<boolean>(false);

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthData, statsData, kData, mData] = await Promise.all([
        fetchAgentHealth(),
        fetchAgentStats(),
        fetchKnowledge(),
        fetchMemories(),
      ]);
      setHealth(healthData);
      setStats(statsData);
      setKnowledgeList(kData.items || []);
      setMemoryList(mData.memories || []);
      setLastCheckTime(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleTestRetrieval = async () => {
    setRetrievalLoading(true);
    try {
      const res = await executeRetrievalQuery({
        query: searchQuery,
        limit: 4,
      });
      if (res.ok) {
        setRetrievalResult(res.result);
      }
    } catch (err: unknown) {
      console.error('Retrieval error:', err);
    } finally {
      setRetrievalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  AI Agent Command Center
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Phase 1: Knowledge & Memory System
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Grounding AI Trading Agent on Classical Knowledge, Memory, and Fact-Segregated Learning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Backend Status:</span>
              {loading && !stats ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Checking...
                </span>
              ) : health?.ok ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected (Phase 1)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  <AlertTriangle className="w-3 h-3" />
                  Disconnected
                </span>
              )}
            </div>

            <button
              onClick={refreshAll}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh State</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Knowledge Base Items */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Knowledge Base</span>
            <BookOpen className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {stats?.knowledgeCount ?? '—'}
            </span>
            <span className="text-[11px] text-slate-400">curated items</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <span className="text-emerald-400">{stats?.knowledgeStatusBreakdown?.VALIDATED ?? 0} Validated</span>
            <span>·</span>
            <span className="text-amber-400">{stats?.knowledgeStatusBreakdown?.HYPOTHESIS ?? 0} Hypotheses</span>
          </div>
        </div>

        {/* Metric 2: Agent Memories */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Agent Memories</span>
            <Brain className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {stats?.memoryCount ?? '—'}
            </span>
            <span className="text-[11px] text-slate-400">stored experiences</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <span className="text-cyan-400">{stats?.memoryCategoryBreakdown?.DECISION ?? 0} Decision</span>
            <span>·</span>
            <span className="text-rose-400">{stats?.memoryCategoryBreakdown?.MISTAKE ?? 0} Mistake</span>
            <span>·</span>
            <span className="text-emerald-400">{stats?.memoryCategoryBreakdown?.SUCCESS_PATTERN ?? 0} Win</span>
          </div>
        </div>

        {/* Metric 3: Market Memory Patterns */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Market Patterns</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {stats?.marketMemoryCount ?? '—'}
            </span>
            <span className="text-[11px] text-slate-400">behavior records</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            Multi-timeframe empirical tracking
          </div>
        </div>

        {/* Metric 4: Daily Learning & Review */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Learning & Review</span>
            <History className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {stats?.learningSessionCount ?? '—'}
            </span>
            <span className="text-[11px] text-slate-400">sessions logged</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <span className="text-cyan-400">Pending Approvals:</span>
            <span className="font-bold text-white">{stats?.pendingProposalsCount ?? 0}</span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Switcher for Command Center */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-medium">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'overview'
              ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>System Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('knowledge')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'knowledge'
              ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Knowledge Base ({knowledgeList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('memory')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'memory'
              ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Agent Memory ({memoryList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('retrieval')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'retrieval'
              ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Context Retrieval Test</span>
        </button>
      </div>

      {/* 4. Sub-Tab Content Views */}

      {/* Sub-Tab 1: System Overview */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Health & Boundary Status */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Server className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Phase 1 Architecture Status
              </h3>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Architecture Phase</span>
                <span className="text-cyan-400 font-semibold">Phase 1 (Knowledge & Memory)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Service</span>
                <span className="text-emerald-400">{health?.service || '—'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Fact vs Reasoning Segregation</span>
                <span className="text-emerald-400">ENFORCED (Boolean Flag)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Content Hash Deduplication</span>
                <span className="text-emerald-400">ACTIVE (SHA-256)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Last Verified</span>
                <span className="text-slate-300">{lastCheckTime || '—'}</span>
              </div>
            </div>
          </div>

          {/* Security & Immutability Rules */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Security & Non-Autonomous Guards
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-slate-200 font-medium">Zero Credentials in Knowledge Base</p>
                  <p className="text-slate-400 text-[11px]">Strict regex sanitation rejects any secret insertion</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-slate-200 font-medium">Non-Autonomous Strategy Mutation</p>
                  <p className="text-slate-400 text-[11px]">Knowledge items never alter production rules without human approval</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-slate-200 font-medium">Epistemic Status Filtering</p>
                  <p className="text-slate-400 text-[11px]">Unverified claims tagged as HYPOTHESIS; never assumed as absolute truth</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-slate-200 font-medium">Zero Client-Exposed API Keys</p>
                  <p className="text-slate-400 text-[11px]">All AI and broker endpoints strictly proxy through backend</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Knowledge Base */}
      {activeSubTab === 'knowledge' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Showing curated knowledge items ingested into the system:</span>
            <span className="font-mono">{knowledgeList.length} items</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {knowledgeList.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {item.sourceType}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                        item.status === 'VALIDATED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : item.status === 'HYPOTHESIS'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      v{item.version}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {item.sourceName}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{item.title}</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {item.content}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]">
                    <span>Topic: {item.topic}</span>
                    <span>·</span>
                    <span>Hash: {item.contentHash.substring(0, 8)}...</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Memory Stream */}
      {activeSubTab === 'memory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Agent Memory Stream (Decision, Mistake, Win, Improvement):</span>
            <span className="font-mono">{memoryList.length} records</span>
          </div>

          <div className="space-y-3">
            {memoryList.map((mem) => (
              <div
                key={mem.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                        mem.category === 'DECISION'
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                          : mem.category === 'MISTAKE'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : mem.category === 'SUCCESS_PATTERN'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {mem.category}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {mem.symbol ? `${mem.symbol} ${mem.timeframe}` : mem.market}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(mem.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Context & Observation (Fact) */}
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Observed Fact:</span>
                  </div>
                  <p className="text-slate-300 font-mono text-[11px]">{mem.observation}</p>
                </div>

                {/* Decision */}
                <div className="text-xs">
                  <span className="text-slate-400 font-medium">Decision/Action: </span>
                  <span className="text-white font-medium">{mem.decision}</span>
                </div>

                {/* AI Reasoning (Explicitly segregated) */}
                {mem.reasoning && (
                  <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-800/40 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Reasoning / Hypothesis:</span>
                    </div>
                    <p className="text-cyan-200/90 text-[11px] leading-relaxed">{mem.reasoning}</p>
                  </div>
                )}

                {/* Outcome */}
                {mem.outcome && (
                  <div className="text-xs text-slate-400">
                    <span className="font-medium text-slate-300">Observed Outcome: </span>
                    <span className="text-slate-300">{mem.outcome}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Context Retrieval Test */}
      {activeSubTab === 'retrieval' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Context-Aware Retrieval Abstraction Test
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Vector & Multi-Attribute Ready
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Test querying the Knowledge Base and Agent Memory given market context, technical setup, or trading concept.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. Risk Management, Resistance, Breakout, RSI, BTCUSDT"
              className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleTestRetrieval}
              disabled={retrievalLoading}
              className="px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Search className={`w-3.5 h-3.5 ${retrievalLoading ? 'animate-spin' : ''}`} />
              <span>Query System</span>
            </button>
          </div>

          {/* Retrieval Results */}
          {retrievalResult && (
            <div className="space-y-4 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-cyan-400">{retrievalResult.querySummary}</span>
                <span className="text-slate-500 font-mono">
                  Matches: {retrievalResult.totalMatches}
                </span>
              </div>

              {/* Matched Knowledge */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Matched Knowledge ({retrievalResult.relevantKnowledge.length})</span>
                </h4>
                {retrievalResult.relevantKnowledge.map((k) => (
                  <div
                    key={k.id}
                    className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{k.title}</span>
                      <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                        {k.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px]">{k.summary}</p>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Source: {k.sourceName} · Topic: {k.topic}
                    </div>
                  </div>
                ))}
              </div>

              {/* Matched Memories */}
              {retrievalResult.relevantMemories.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Matched Memories ({retrievalResult.relevantMemories.length})</span>
                  </h4>
                  {retrievalResult.relevantMemories.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-cyan-300">
                          [{m.category}] {m.symbol || m.market}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Confidence: {(m.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] font-mono">{m.observation}</p>
                      <p className="text-slate-400 text-[11px]">Action: {m.decision}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Existing System Protection Footer */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>
            Existing TradingBot features (Binance WebSockets, 10-Pair Scanner, Backtest, Evaluator, Rules) remain 100% active and untouched.
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Phase 1 Foundation Complete
        </span>
      </div>
    </div>
  );
};
