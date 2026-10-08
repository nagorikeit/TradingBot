import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Cpu,
  Server,
  BookOpen,
  Brain,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Clock,
  Sparkles,
  Calendar,
  Globe,
  Play,
  Check,
  ExternalLink,
  FileText,
  Filter,
  Shield,
  Eye,
  X,
  Radio,
  Youtube,
  Layers,
  FlaskConical,
  Target,
  BarChart2,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  FileCheck,
} from 'lucide-react';
import {
  fetchAgentHealth,
  fetchAgentStats,
  fetchKnowledge,
  fetchMemories,
  fetchSources,
  fetchSchedulerStatus,
  runSchedulerManualTrigger,
  executeRetrievalQuery,
  fetchStoredContent,
  fetchSourceContent,
  fetchContentAcquisitionStats,
  fetchYouTubeContent,
  fetchDocumentContent,
  fetchResearchLibrary,
  fetchResearchChunks,
  fetchResearchLibraryStats,
  extractResearchClaims,
  fetchResearchClaims,
  formalizeClaimToRule,
  fetchRuleCandidates,
  verifyRuleCandidate,
  fetchRuleEvidenceChain,
  approveRuleHumanGate,
  fetchPhase2DVerificationStatus,
  AgentBackendHealth,
  AgentStatsResponse,
  KnowledgeItem,
  AgentMemoryItem,
  RetrievalResult,
  RegisteredSource,
  SchedulerStatusResponse,
  FetchedContentItem,
  FetchStatistics,
  UnifiedResearchItem,
  ResearchLibraryStatistics,
  ContentChunk,
  ResearchClaim,
  RuleCandidate,
  RuleValidationRecord,
  RuleEvidenceChain,
} from '../services/agentBackendService';

export const AgentCommandCenter: React.FC = () => {
  const [health, setHealth] = useState<AgentBackendHealth | null>(null);
  const [stats, setStats] = useState<AgentStatsResponse | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatusResponse | null>(null);
  const [sourcesList, setSourcesList] = useState<RegisteredSource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  // Active view within Command Center
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'scheduler' | 'sources' | 'content' | 'youtubeResearch' | 'ruleVerification' | 'knowledge' | 'memory' | 'retrieval'>('overview');

  // Sub-tab data
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [memoryList, setMemoryList] = useState<AgentMemoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('Risk Management');
  const [retrievalResult, setRetrievalResult] = useState<RetrievalResult | null>(null);
  const [retrievalLoading, setRetrievalLoading] = useState<boolean>(false);

  // Phase 2D Research Claim & Rule Verification states
  const [claimsList, setClaimsList] = useState<ResearchClaim[]>([]);
  const [rulesList, setRulesList] = useState<RuleCandidate[]>([]);
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<RuleEvidenceChain | null>(null);
  const [activeRuleValidation, setActiveRuleValidation] = useState<RuleValidationRecord | null>(null);
  const [claimsLoading, setClaimsLoading] = useState<boolean>(false);
  const [verificationLoading, setVerificationLoading] = useState<string | null>(null); // ruleId being verified
  const [verificationFeedback, setVerificationFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [claimFilter, setClaimFilter] = useState<string>('ALL');
  const [humanApprovalNotes, setHumanApprovalNotes] = useState<string>('');
  const [humanApprovalTarget, setHumanApprovalTarget] = useState<RuleCandidate | null>(null);

  // Phase 2B Web Content Acquisition & Firewall states
  const [fetchedContentList, setFetchedContentList] = useState<FetchedContentItem[]>([]);
  const [fetchStats, setFetchStats] = useState<FetchStatistics | null>(null);
  const [selectedSourceForFetch, setSelectedSourceForFetch] = useState<string>('');
  const [fetchLoading, setFetchLoading] = useState<boolean>(false);
  const [fetchFeedback, setFetchFeedback] = useState<{ ok: boolean; message: string; duration?: number } | null>(null);
  const [securityStatusFilter, setSecurityStatusFilter] = useState<string>('ALL');
  const [activeContentModal, setActiveContentModal] = useState<FetchedContentItem | null>(null);

  // Phase 2C YouTube & Research Library states
  const [researchLibraryList, setResearchLibraryList] = useState<UnifiedResearchItem[]>([]);
  const [researchStats, setResearchStats] = useState<ResearchLibraryStatistics | null>(null);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState<string>('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [youtubeLoading, setYoutubeLoading] = useState<boolean>(false);
  const [youtubeFeedback, setYoutubeFeedback] = useState<{ ok: boolean; message: string; chunks?: number } | null>(null);
  const [docUrlInput, setDocUrlInput] = useState<string>('https://www.bis.org/publ/work998.htm');
  const [docNameInput, setDocNameInput] = useState<string>('BIS FX Market Liquidity Research');
  const [docLoading, setDocLoading] = useState<boolean>(false);
  const [docFeedback, setDocFeedback] = useState<{ ok: boolean; message: string; chunks?: number } | null>(null);
  const [researchTypeFilter, setResearchTypeFilter] = useState<string>('ALL');
  const [activeResearchModal, setActiveResearchModal] = useState<UnifiedResearchItem | null>(null);
  const [activeChunksModal, setActiveChunksModal] = useState<{ item: UnifiedResearchItem; chunks: ContentChunk[] } | null>(null);
  const [chunksLoading, setChunksLoading] = useState<boolean>(false);

  // Manual Trigger testing state
  const [triggerLoading, setTriggerLoading] = useState<boolean>(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const refreshAll = async () => {
    setLoading(true);
    try {
      const [
        healthData,
        statsData,
        kData,
        mData,
        sourcesData,
        schedData,
        contentData,
        contentStatsData,
        researchData,
        researchStatsData,
        claimsData,
        rulesData,
      ] = await Promise.all([
        fetchAgentHealth(),
        fetchAgentStats(),
        fetchKnowledge(),
        fetchMemories(),
        fetchSources(),
        fetchSchedulerStatus(),
        fetchStoredContent(),
        fetchContentAcquisitionStats(),
        fetchResearchLibrary(),
        fetchResearchLibraryStats(),
        fetchResearchClaims(),
        fetchRuleCandidates(),
      ]);
      setHealth(healthData);
      setStats(statsData);
      setKnowledgeList(kData.items || []);
      setMemoryList(mData.memories || []);
      setSourcesList(sourcesData.sources || []);
      if (!selectedSourceForFetch && sourcesData.sources && sourcesData.sources.length > 0) {
        setSelectedSourceForFetch(sourcesData.sources[0].id);
      }
      setSchedulerStatus(schedData.status);
      setFetchedContentList(contentData.items || []);
      setFetchStats(contentStatsData.stats || null);
      setResearchLibraryList(researchData.items || []);
      setResearchStats(researchStatsData.stats || null);
      setClaimsList(claimsData.claims || []);
      setRulesList(rulesData.rules || []);
      setLastCheckTime(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      console.error('Connection error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleManualRunTrigger = async () => {
    setTriggerLoading(true);
    setTriggerMessage(null);
    try {
      const res = await runSchedulerManualTrigger();
      setTriggerMessage(`Trigger Successful: ${res.message} (${res.durationMs}ms)`);
      // Refresh status after trigger
      const updatedStatus = await fetchSchedulerStatus();
      setSchedulerStatus(updatedStatus.status);
    } catch (err: unknown) {
      setTriggerMessage(err instanceof Error ? err.message : 'Trigger failed');
    } finally {
      setTriggerLoading(false);
    }
  };

  const handleManualFetchContent = async () => {
    if (!selectedSourceForFetch) return;
    setFetchLoading(true);
    setFetchFeedback(null);
    try {
      const res = await fetchSourceContent(selectedSourceForFetch);
      if (res.ok) {
        setFetchFeedback({
          ok: true,
          message: `Acquired content from "${res.item?.sourceName}": ${res.item?.contentLength} chars sanitized text. Security status: ${res.item?.securityStatus}.`,
          duration: res.durationMs,
        });
        await refreshAll();
        if (res.item) {
          setActiveContentModal(res.item);
        }
      } else {
        setFetchFeedback({
          ok: false,
          message: `Acquisition prevented: [${res.fetchStatus}] ${res.error || 'Blocked by firewall policy'}`,
          duration: res.durationMs,
        });
      }
    } catch (err: unknown) {
      setFetchFeedback({
        ok: false,
        message: err instanceof Error ? err.message : 'Fetch operation failed',
      });
    } finally {
      setFetchLoading(false);
    }
  };

  const handleFetchYouTube = async () => {
    if (!youtubeUrlInput) return;
    setYoutubeLoading(true);
    setYoutubeFeedback(null);
    try {
      const res = await fetchYouTubeContent(youtubeUrlInput);
      setYoutubeFeedback({
        ok: true,
        message: `Acquired YouTube content: "${res.item.title}" (${res.item.transcriptStatus}). ${res.chunksCount} logical chunks prepared.`,
        chunks: res.chunksCount,
      });
      await refreshAll();
      setActiveResearchModal(res.item);
    } catch (err: unknown) {
      setYoutubeFeedback({
        ok: false,
        message: err instanceof Error ? err.message : 'YouTube acquisition failed',
      });
    } finally {
      setYoutubeLoading(false);
    }
  };

  const handleFetchDocument = async () => {
    if (!docUrlInput) return;
    setDocLoading(true);
    setDocFeedback(null);
    try {
      const res = await fetchDocumentContent(docUrlInput, undefined, docNameInput);
      setDocFeedback({
        ok: true,
        message: `Acquired Document: "${res.item.title}" (${res.item.extractionStatus}). ${res.chunksCount} logical chunks prepared.`,
        chunks: res.chunksCount,
      });
      await refreshAll();
      setActiveResearchModal(res.item);
    } catch (err: unknown) {
      setDocFeedback({
        ok: false,
        message: err instanceof Error ? err.message : 'Document acquisition failed',
      });
    } finally {
      setDocLoading(false);
    }
  };

  const handleOpenChunks = async (item: UnifiedResearchItem) => {
    setChunksLoading(true);
    try {
      const res = await fetchResearchChunks(item.id);
      setActiveChunksModal({ item, chunks: res.chunks || [] });
    } catch {
      setActiveChunksModal({ item, chunks: item.chunks || [] });
    } finally {
      setChunksLoading(false);
    }
  };

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
                  Phase 2C: YouTube & Research Processing & Library
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Caption-First YouTube Ingestion · Safe PDF/Doc Extraction · SSRF & Prompt Injection Firewall · Logical Chunks
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
                  Connected (Phase 2C)
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Research Scheduler */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Scheduler</span>
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold font-mono text-white">
              {schedulerStatus?.config.dailyRunTime || '02:00'}
            </span>
            <span className="text-[10px] text-cyan-400 font-mono truncate">
              {schedulerStatus?.config.timezone || 'Dhaka'}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <span className={schedulerStatus?.config.enabled ? 'text-emerald-400' : 'text-slate-500'}>
              {schedulerStatus?.config.enabled ? '● ENABLED' : '○ DISABLED'}
            </span>
          </div>
        </div>

        {/* Metric 2: Trusted Sources */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Sources</span>
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-white">
              {sourcesList.length}
            </span>
            <span className="text-[10px] text-slate-400">registry</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <span className="text-emerald-400">
              {sourcesList.filter((s) => s.status === 'TRUSTED').length} Trusted
            </span>
          </div>
        </div>

        {/* Metric 3: Web Content (2B) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Web (2B)</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-white">
              {fetchedContentList.length}
            </span>
            <span className="text-[10px] text-slate-400">acquired</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <span className="text-emerald-400">
              {fetchedContentList.filter((c) => c.securityStatus === 'SAFE_DATA').length} Safe
            </span>
          </div>
        </div>

        {/* Metric 4: YouTube & Research (2C) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5 border-rose-500/20 bg-rose-950/10">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium text-rose-300">Library (2C)</span>
            <Youtube className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-white">
              {researchLibraryList.length}
            </span>
            <span className="text-[10px] text-rose-300">items</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <span className="text-rose-400">
              {researchStats?.totalChunksCount ?? 0} Chunks
            </span>
          </div>
        </div>

        {/* Metric 5: Knowledge Base */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Knowledge</span>
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-white">
              {stats?.knowledgeCount ?? '—'}
            </span>
            <span className="text-[10px] text-slate-400">curated</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <span className="text-emerald-400">
              {stats?.knowledgeStatusBreakdown?.VALIDATED ?? 0} Valid
            </span>
          </div>
        </div>

        {/* Metric 6: Agent Memory */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Memory</span>
            <Brain className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-white">
              {stats?.memoryCount ?? '—'}
            </span>
            <span className="text-[10px] text-slate-400">records</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <span className="text-cyan-400">
              {stats?.memoryCategoryBreakdown?.DECISION ?? 0} Dec
            </span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Switcher for Command Center */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-medium overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
            activeSubTab === 'overview'
              ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>System Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('scheduler')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
            activeSubTab === 'scheduler'
              ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Research Scheduler (2A)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sources')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
            activeSubTab === 'sources'
              ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Source Registry ({sourcesList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('content')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 border border-slate-700/60 ${
            activeSubTab === 'content'
              ? 'bg-slate-800 text-amber-400 font-semibold shadow-sm border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:border-slate-600'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Web Ingestion (2B)</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px]">
            {fetchedContentList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('youtubeResearch')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 border border-slate-700/60 ${
            activeSubTab === 'youtubeResearch'
              ? 'bg-slate-800 text-rose-400 font-semibold shadow-sm border-rose-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:border-slate-600'
          }`}
        >
          <Youtube className="w-3.5 h-3.5 text-rose-400" />
          <span>YouTube & Research (2C)</span>
          <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px]">
            {researchLibraryList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('ruleVerification')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 border border-emerald-500/40 ${
            activeSubTab === 'ruleVerification'
              ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm border-emerald-500'
              : 'text-slate-400 hover:text-slate-200 hover:border-slate-600'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
          <span>Rule Verification (2D)</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
            {rulesList.length} Rules / {claimsList.length} Claims
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('knowledge')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
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
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
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
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
            activeSubTab === 'retrieval'
              ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Context Retrieval</span>
        </button>
      </div>

      {/* 4. Sub-Tab Content Views */}

      {/* Sub-Tab: Phase 2A Autonomous Research Scheduler */}
      {activeSubTab === 'scheduler' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scheduler Status Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-slate-200">
                    Autonomous Schedule Configuration
                  </h3>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                    schedulerStatus?.config.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {schedulerStatus?.config.enabled ? 'ACTIVE' : 'PAUSED'}
                </span>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-400">Daily Execution Time</span>
                  <span className="text-white font-semibold">{schedulerStatus?.config.dailyRunTime || '02:00'} (24h)</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-400">Configured Timezone</span>
                  <span className="text-cyan-400">{schedulerStatus?.config.timezone || 'Asia/Dhaka'}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-400">Job Lifecycle Status</span>
                  <span className="text-emerald-400">{schedulerStatus?.config.lastStatus || 'SCHEDULED'}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-400">Single-Run Mutex Lock</span>
                  <span className={schedulerStatus?.isLocked ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
                    {schedulerStatus?.isLocked ? 'LOCKED (In Execution)' : 'UNLOCKED (Safe)'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-400">Next Scheduled Occurrence</span>
                  <span className="text-slate-300">
                    {schedulerStatus?.config.nextRunAt
                      ? new Date(schedulerStatus.config.nextRunAt).toLocaleString()
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Manual Trigger & Testing Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Play className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  Scheduler Manual Trigger Test
                </h3>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Test the scheduler’s single-run mutex lock, state transition, and execution lifecycle. In Phase 2A, manual triggers verify the lock acquisition and safety foundation without calling external scrapers or AI models.
              </p>

              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono">POST /api/agent/learning/schedule/run</span>
                  <button
                    onClick={handleManualRunTrigger}
                    disabled={triggerLoading || schedulerStatus?.isLocked}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Play className={`w-3.5 h-3.5 ${triggerLoading ? 'animate-spin' : ''}`} />
                    <span>{triggerLoading ? 'Acquiring Lock...' : 'Execute Test Run'}</span>
                  </button>
                </div>
                {triggerMessage && (
                  <div className="p-2 rounded bg-slate-900 border border-slate-700/80 text-[11px] font-mono text-cyan-300">
                    {triggerMessage}
                  </div>
                )}
              </div>

              {/* Safety Architecture Note */}
              <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-800/40 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Single-Run Mutex Guard Active</span>
                </div>
                <p className="text-cyan-200/80 text-[11px] leading-relaxed">
                  Duplicate trigger requests during active runs are rejected with code 409 (MUTEX_LOCKED), preventing parallel race conditions or duplicate sessions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab: Phase 2A Trusted Source Registry */}
      {activeSubTab === 'sources' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
            <span>Verified Source Registry (Protected against unverified web claims):</span>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-emerald-400">
                {sourcesList.filter((s) => s.status === 'TRUSTED').length} Trusted
              </span>
              <span>·</span>
              <span className="text-amber-400">
                {sourcesList.filter((s) => s.status === 'UNDER_REVIEW').length} In Review
              </span>
              <span>·</span>
              <span className="text-cyan-400">
                {sourcesList.filter((s) => s.status === 'MONITORED').length} Monitored
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {sourcesList.map((source) => (
              <div
                key={source.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {source.sourceType}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                        source.status === 'TRUSTED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : source.status === 'MONITORED'
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                          : source.status === 'UNDER_REVIEW'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {source.status}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {source.authorityLevel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400">
                      Trust Score: {(source.trustScore * 100).toFixed(0)}%
                    </span>
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${source.trustScore * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-100">{source.name}</h4>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1"
                      title="Open source URL"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] font-mono text-cyan-400 mt-0.5 truncate max-w-xl">
                    {source.url}
                  </p>
                  {source.reviewNotes && (
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {source.reviewNotes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="flex flex-wrap gap-1.5">
                    {source.categories.map((cat) => (
                      <span
                        key={cat}
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]"
                      >
                        #{cat}
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    ID: {source.id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tab: System Overview */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Health & Boundary Status */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Server className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Phase 2B Architecture Status
              </h3>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Architecture Phase</span>
                <span className="text-cyan-400 font-semibold">Phase 2B (Web Acquisition & Security Firewall)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Content Acquisition</span>
                <span className="text-emerald-400">ACTIVE ({fetchedContentList.length} items acquired)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Security Firewall Status</span>
                <span className="text-emerald-400">ARMED (Prompt injection & SSRF shielded)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Research Scheduler</span>
                <span className="text-emerald-400">ACTIVE ({schedulerStatus?.config.dailyRunTime} {schedulerStatus?.config.timezone})</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Trusted Source Registry</span>
                <span className="text-emerald-400">ACTIVE ({sourcesList.length} sources registered)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Single-Run Mutex Lock</span>
                <span className="text-emerald-400">ACTIVE (Zero duplicate execution)</span>
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
                Security & Non-Autonomous Guards (2B)
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-slate-200 font-medium">Untrusted Data Isolation Invariant</p>
                  <p className="text-slate-400 text-[11px]">Hardcoded untrusted: true. Never interpreted as agent instructions or commands</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-slate-200 font-medium">SSRF & DNS Resolution Protection</p>
                  <p className="text-slate-400 text-[11px]">Strictly blocks 127.0.0.1, private CIDRs (10/8, 172.16/12, 192.168/16), and AWS 169.254</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-slate-200 font-medium">Prompt Injection Neutralization</p>
                  <p className="text-slate-400 text-[11px]">Adversarial tokens quarantined and flagged as SUSPICIOUS_DATA</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-slate-200 font-medium">No User-Agent Rotation / Scraping Bypass</p>
                  <p className="text-slate-400 text-[11px]">Strict compliance: Zero stealth headers, zero anti-bot circumvention</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-slate-200 font-medium">Non-Autonomous Strategy Mutation</p>
                  <p className="text-slate-400 text-[11px]">External knowledge never mutates live Binance trading rules directly</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab: Phase 2B Web Content Acquisition & Untrusted Firewall */}
      {activeSubTab === 'content' && (
        <div className="space-y-6">
          {/* 1. Critical Security Boundary Alert Banner */}
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/40 text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-sm text-amber-400">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>HARD ARCHITECTURAL INVARIANT: UNTRUSTED DATA FIREWALL</span>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              All external web, research, and RSS feed content is strictly isolated as <code className="px-1 py-0.5 rounded bg-black/40 font-mono text-amber-300">untrusted: true</code>.
              External text is <strong>never</strong> treated as instructions, prompt commands, or execution directives.
              It is quarantined as passive observation data only, with SSRF filters, HTML sanitization, and adversarial injection scanners active.
            </p>
          </div>

          {/* 2. Acquisition Console: Fetch & Sanitize Tester */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  Live Web Acquisition & Security Audit Console
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Registered Sources Only
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Select Registered Target Source:
                </label>
                <select
                  value={selectedSourceForFetch}
                  onChange={(e) => setSelectedSourceForFetch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {sourcesList.map((src) => (
                    <option key={src.id} value={src.id}>
                      [{src.status}] {src.name} — ({src.sourceType}: {src.url})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:self-end">
                <button
                  onClick={handleManualFetchContent}
                  disabled={fetchLoading || !selectedSourceForFetch}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fetchLoading ? 'animate-spin' : ''}`} />
                  <span>{fetchLoading ? 'Auditing & Ingesting...' : 'Acquire & Audit Content'}</span>
                </button>
              </div>
            </div>

            {fetchFeedback && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 border ${
                  fetchFeedback.ok
                    ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {fetchFeedback.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{fetchFeedback.message}</span>
                </div>
                {fetchFeedback.duration && (
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">
                    {fetchFeedback.duration}ms
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 3. Acquired Content List & Security Firewall Inspector */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Acquired Untrusted Content Repository
                </h3>
                <p className="text-xs text-slate-400">
                  {fetchedContentList.length} items acquired · Filter by firewall evaluation status
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                {(['ALL', 'SAFE_DATA', 'SUSPICIOUS_DATA', 'BLOCKED_DATA'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setSecurityStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                      securityStatusFilter === status
                        ? 'bg-slate-800 text-white font-semibold border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {status}
                    {status === 'ALL'
                      ? ` (${fetchedContentList.length})`
                      : ` (${fetchedContentList.filter((c) => c.securityStatus === status).length})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Cards */}
            <div className="grid grid-cols-1 gap-4">
              {fetchedContentList
                .filter((item) =>
                  securityStatusFilter === 'ALL' ? true : item.securityStatus === securityStatusFilter
                )
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm hover:border-slate-700 transition-colors"
                  >
                    {/* Header Row: Badges & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Security Badge */}
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono rounded border flex items-center gap-1 ${
                            item.securityStatus === 'SAFE_DATA'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : item.securityStatus === 'SUSPICIOUS_DATA'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {item.securityStatus === 'SAFE_DATA' ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {item.securityStatus}
                        </span>

                        {/* Untrusted Invariant Tag */}
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 font-semibold">
                          ⚠️ UNTRUSTED: true
                        </span>

                        {/* Content Type */}
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {item.contentType}
                        </span>

                        {/* HTTP Status */}
                        <span className="text-[10px] font-mono text-slate-500">
                          HTTP {item.httpStatus}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                        <span>{item.contentLength} chars</span>
                        <span>·</span>
                        <span>{new Date(item.fetchedAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Title & Origin Details */}
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                        <span className="text-slate-400 font-medium">{item.sourceName}</span>
                        <span className="text-slate-600">·</span>
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-[11px] truncate max-w-md"
                        >
                          <span>{item.sourceUrl}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    </div>

                    {/* Security & Firewall Notes */}
                    {item.securityNotes && item.securityNotes.length > 0 && (
                      <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                          <Shield className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Firewall & Sanitizer Audit Log:</span>
                        </div>
                        <ul className="space-y-1 pl-4 list-disc text-[11px] text-slate-400">
                          {item.securityNotes.map((note, idx) => (
                            <li key={idx}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* RSS Feed Snippets (if present) */}
                    {item.feedItems && item.feedItems.length > 0 && (
                      <div className="space-y-2 border-t border-slate-800/60 pt-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300">
                            Parsed Feed Items ({item.feedItems.length}):
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            Sanitized & Neutralized
                          </span>
                        </div>
                        <div className="space-y-2">
                          {item.feedItems.map((feed) => (
                            <div
                              key={feed.id}
                              className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <a
                                  href={feed.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-slate-200 hover:text-cyan-400 flex items-center gap-1"
                                >
                                  <span>{feed.title}</span>
                                  <ExternalLink className="w-3 h-3 text-slate-500" />
                                </a>
                                {feed.publishedAt && (
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {new Date(feed.publishedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                {feed.summary}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sanitized Text Extract Preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Sanitized Plain Text Extract:</span>
                        <span className="text-[10px] font-mono text-slate-500">
                          SHA-256: {item.contentHash.substring(0, 16)}...
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap select-text">
                        {item.content}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      <span className="text-[11px] text-slate-500 font-mono">
                        Record ID: {item.id}
                      </span>
                      <button
                        onClick={() => setActiveContentModal(item)}
                        className="px-3 py-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/50 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect Sanitized Record</span>
                      </button>
                    </div>
                  </div>
                ))}

              {fetchedContentList.length === 0 && (
                <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl space-y-2">
                  <Globe className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">
                    No web content acquired yet
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Select any verified source from the console above and click "Acquire & Audit Content" to run live SSRF checks, prompt injection firewall scanning, and HTML sanitization.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Modal / Record Inspector */}
          {activeContentModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Untrusted Web Content Security Audit
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveContentModal(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200">
                    <strong>UNTRUSTED METADATA ENFORCEMENT:</strong> This object is marked with immutable <code className="font-mono text-amber-300">untrusted: true</code>. It cannot be used as LLM prompt directives, system context, or trading execution orders.
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Security Status:</span>
                      <span className="text-white font-semibold">{activeContentModal.securityStatus}</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Fetch Status:</span>
                      <span className="text-white font-semibold">{activeContentModal.fetchStatus} (HTTP {activeContentModal.httpStatus})</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Content Type:</span>
                      <span className="text-white font-semibold">{activeContentModal.contentType}</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Source Name:</span>
                      <span className="text-white font-semibold truncate block">{activeContentModal.sourceName}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] break-all">
                    <span className="text-slate-500 block mb-1">SHA-256 Fingerprint:</span>
                    <span className="text-cyan-400">{activeContentModal.contentHash}</span>
                  </div>

                  {activeContentModal.securityNotes && activeContentModal.securityNotes.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-300">Firewall Security Logs:</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                        {activeContentModal.securityNotes.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="font-semibold text-slate-300">Clean Extracted Text:</span>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed select-text">
                      {activeContentModal.content}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => setActiveContentModal(null)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Close Inspector
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab: Phase 2C YouTube & Research Library */}
      {activeSubTab === 'youtubeResearch' && (
        <div className="space-y-6">
          {/* 1. Security & Architectural Invariant Notice */}
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-600/40 text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-sm text-rose-400">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>PHASE 2C ARCHITECTURAL BOUNDARY: UNTRUSTED YOUTUBE & RESEARCH REPOSITORY</span>
            </div>
            <p className="text-xs text-rose-200/90 leading-relaxed">
              Video transcripts, academic papers, and PDF documents are strictly quarantined as <code className="px-1 py-0.5 rounded bg-black/40 font-mono text-rose-300">untrusted: true</code>.
              No external content directly mutates trading strategies, executes orders, or bypasses authentication/CAPTCHA. Content is sanitized through SSRF shields, prompt injection firewalls, and logically chunked for downstream <strong>Phase 2D Claim Extraction & Knowledge Comparison</strong>.
            </p>
          </div>

          {/* 2. Ingestion Consoles: YouTube & Research Documents */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Console A: YouTube Video Processor */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-semibold text-slate-200">
                    YouTube Caption Ingestion
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/60">
                  Caption-First
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    YouTube Video URL:
                  </label>
                  <input
                    type="text"
                    value={youtubeUrlInput}
                    onChange={(e) => setYoutubeUrlInput(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Accepts standard watch URLs, short links, or embed formats. No bot evasion or logins used.
                  </p>
                </div>

                <button
                  onClick={handleFetchYouTube}
                  disabled={youtubeLoading || !youtubeUrlInput}
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${youtubeLoading ? 'animate-spin' : ''}`} />
                  <span>{youtubeLoading ? 'Extracting Captions & Chunking...' : 'Ingest YouTube Transcript'}</span>
                </button>

                {youtubeFeedback && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 border ${
                      youtubeFeedback.ok
                        ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {youtubeFeedback.ok ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      )}
                      <span>{youtubeFeedback.message}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Console B: Research Paper & PDF Ingestion */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-slate-200">
                    Research Document / PDF Ingestion
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
                  SSRF Safe (Max 5MB)
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Document Title / Organization Name:
                  </label>
                  <input
                    type="text"
                    value={docNameInput}
                    onChange={(e) => setDocNameInput(e.target.value)}
                    placeholder="e.g. BIS FX Market Liquidity"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Document URL:
                  </label>
                  <input
                    type="text"
                    value={docUrlInput}
                    onChange={(e) => setDocUrlInput(e.target.value)}
                    placeholder="https://example.com/paper.pdf or .html"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <button
                  onClick={handleFetchDocument}
                  disabled={docLoading || !docUrlInput}
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${docLoading ? 'animate-spin' : ''}`} />
                  <span>{docLoading ? 'Downloading & Extracting Text...' : 'Fetch & Sanitize Document'}</span>
                </button>

                {docFeedback && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 border ${
                      docFeedback.ok
                        ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {docFeedback.ok ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      )}
                      <span>{docFeedback.message}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Research Library List & Chunks Inspector */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Processed Research & Transcripts Library
                </h3>
                <p className="text-xs text-slate-400">
                  {researchLibraryList.length} items cataloged · {researchStats?.totalChunksCount ?? 0} logical chunks prepared for Phase 2D
                </p>
              </div>

              {/* Source Type / Filter */}
              <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
                {(['ALL', 'YOUTUBE', 'RESEARCH', 'PDF', 'SAFE_DATA', 'SUSPICIOUS_DATA'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setResearchTypeFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors whitespace-nowrap ${
                      researchTypeFilter === filter
                        ? 'bg-slate-800 text-white font-semibold border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {filter}
                    {filter === 'ALL'
                      ? ` (${researchLibraryList.length})`
                      : filter === 'SAFE_DATA' || filter === 'SUSPICIOUS_DATA'
                      ? ` (${researchLibraryList.filter((r) => r.securityStatus === filter).length})`
                      : ` (${researchLibraryList.filter((r) => r.sourceType === filter).length})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Research Cards */}
            <div className="grid grid-cols-1 gap-4">
              {researchLibraryList
                .filter((item) => {
                  if (researchTypeFilter === 'ALL') return true;
                  if (researchTypeFilter === 'SAFE_DATA' || researchTypeFilter === 'SUSPICIOUS_DATA') {
                    return item.securityStatus === researchTypeFilter;
                  }
                  return item.sourceType === researchTypeFilter;
                })
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm hover:border-slate-700 transition-colors"
                  >
                    {/* Header Row: Badges & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono rounded font-semibold flex items-center gap-1 ${
                            item.sourceType === 'YOUTUBE'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          }`}
                        >
                          {item.sourceType === 'YOUTUBE' ? <Youtube className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                          {item.sourceType}
                        </span>

                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                            item.securityStatus === 'SAFE_DATA'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {item.securityStatus}
                        </span>

                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30">
                          {item.chunks.length} Chunks
                        </span>

                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          untrusted: true
                        </span>

                        {item.transcriptStatus !== 'NOT_APPLICABLE' && (
                          <span className="text-[10px] font-mono text-slate-400">
                            Transcript: {item.transcriptStatus}
                          </span>
                        )}

                        {item.extractionStatus !== 'NOT_APPLICABLE' && (
                          <span className="text-[10px] font-mono text-slate-400">
                            Extraction: {item.extractionStatus}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-slate-500">
                        {new Date(item.fetchedAt).toLocaleString()}
                      </div>
                    </div>

                    {/* Title and metadata */}
                    <div>
                      <h4 className="text-sm font-semibold text-white tracking-tight">{item.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="text-slate-300 font-medium">{item.authorOrChannel}</span>
                        {item.publishedAt && (
                          <>
                            <span>·</span>
                            <span>Published: {new Date(item.publishedAt).toLocaleDateString()}</span>
                          </>
                        )}
                        <span>·</span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-rose-400 hover:underline flex items-center gap-1 font-mono text-[11px] truncate max-w-md"
                        >
                          <span>{item.url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    </div>

                    {/* Firewall Audit Log */}
                    {item.firewallLog && item.firewallLog.length > 0 && (
                      <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                          <Shield className="w-3.5 h-3.5 text-rose-400" />
                          <span>Firewall & Sanitizer Audit Log:</span>
                        </div>
                        <ul className="space-y-1 pl-4 list-disc text-[11px] text-slate-400">
                          {item.firewallLog.map((log, idx) => (
                            <li key={idx}>{log}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Sanitized Text Extract Preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Sanitized Transcript / Document Text:</span>
                        <span className="text-[10px] font-mono text-slate-500">
                          SHA-256: {item.contentHash.substring(0, 16)}... ({item.textLength} chars)
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap select-text">
                        {item.text}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                      <span className="text-[11px] text-slate-500 font-mono">
                        Record ID: {item.id}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenChunks(item)}
                          disabled={chunksLoading}
                          className="px-3 py-1 text-[11px] font-medium text-purple-300 hover:text-purple-200 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/50 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Layers className="w-3 h-3 text-purple-400" />
                          <span>View Chunks ({item.chunks.length})</span>
                        </button>
                        <button
                          onClick={() => setActiveResearchModal(item)}
                          className="px-3 py-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/50 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect Record</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {researchLibraryList.length === 0 && (
                <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl space-y-2">
                  <Youtube className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">
                    No research or video content processed yet
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Enter a public YouTube URL or research document link above to extract transcripts, apply the security firewall, and prepare logical chunks for Phase 2D.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Modal: Full Research Record Inspector */}
          {activeResearchModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Untrusted Research Record Security Audit
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveResearchModal(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200">
                    <strong>UNTRUSTED ISOLATION ACTIVE:</strong> This item is permanently tagged with <code className="font-mono text-rose-300">untrusted: true</code>. It cannot be used as LLM prompt directives, system prompts, or trading execution rules.
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Source Type:</span>
                      <span className="text-white font-semibold">{activeResearchModal.sourceType}</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Security Status:</span>
                      <span className="text-white font-semibold">{activeResearchModal.securityStatus}</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Author / Channel:</span>
                      <span className="text-white font-semibold truncate block">{activeResearchModal.authorOrChannel}</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Logical Chunks:</span>
                      <span className="text-purple-300 font-semibold">{activeResearchModal.chunks.length} Chunks</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] break-all">
                    <span className="text-slate-500 block mb-1">SHA-256 Content Fingerprint:</span>
                    <span className="text-cyan-400">{activeResearchModal.contentHash}</span>
                  </div>

                  {activeResearchModal.firewallLog && activeResearchModal.firewallLog.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-300">Firewall Security Logs:</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                        {activeResearchModal.firewallLog.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="font-semibold text-slate-300">Extracted & Sanitized Text:</span>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed select-text">
                      {activeResearchModal.text}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-800 flex justify-between items-center">
                  <button
                    onClick={() => {
                      const item = activeResearchModal;
                      setActiveResearchModal(null);
                      handleOpenChunks(item);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/60 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>View Logical Chunks</span>
                  </button>
                  <button
                    onClick={() => setActiveResearchModal(null)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Close Inspector
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Logical Chunks Inspector (Prepared for Phase 2D) */}
          {activeChunksModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        Phase 2D Prepared Logical Chunks
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate max-w-md">
                        {activeChunksModal.item.title}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveChunksModal(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-200">
                    <strong>PREPARED FOR PHASE 2D:</strong> These atomic chunks preserve context, source citations, and timestamps for Claim Extraction & Knowledge Comparison.
                  </div>

                  <div className="space-y-3">
                    {activeChunksModal.chunks.map((chunk, idx) => (
                      <div
                        key={chunk.chunkId || idx}
                        className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-purple-400 font-semibold">
                            Chunk #{chunk.chunkIndex + 1} of {chunk.totalChunks}
                          </span>
                          <span className="text-slate-500">
                            {chunk.charCount} characters · Hash: {chunk.contentHash.substring(0, 10)}...
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                          {chunk.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => setActiveChunksModal(null)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Close Chunks Inspector
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PHASE 2D: RESEARCH CLAIM EXTRACTION + RULE DISCOVERY + AUTOMATED VERIFICATION ENGINE */}
      {activeSubTab === 'ruleVerification' && (
        <div className="space-y-6">
          {/* Header & Autonomous Extraction Trigger */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/40 border border-emerald-500/30 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    PHASE 2D
                  </span>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-emerald-400" />
                    <span>Research Claim Extraction + Automated Verification Engine</span>
                  </h3>
                </div>
                <p className="text-xs text-slate-400 max-w-2xl">
                  <strong>Core Invariant:</strong> Research evidence ≠ Trading proof. External claims remain <code>untrusted</code> until evaluated through Historical Backtest, Out-of-Sample (OOS) testing, Walk-Forward stability, and Controlled Human Promotion.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    setClaimsLoading(true);
                    try {
                      const res = await extractResearchClaims();
                      setClaimsList(await (await fetchResearchClaims()).claims);
                      setVerificationFeedback({
                        ok: true,
                        message: `Extracted ${res.extractedCount} new claims from stored Phase 2C chunks. Total claims: ${res.totalClaims}.`,
                      });
                    } catch (e: unknown) {
                      setVerificationFeedback({
                        ok: false,
                        message: e instanceof Error ? e.message : 'Claim extraction failed',
                      });
                    } finally {
                      setClaimsLoading(false);
                    }
                  }}
                  disabled={claimsLoading}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${claimsLoading ? 'animate-spin' : ''}`} />
                  <span>{claimsLoading ? 'Scanning Chunks...' : 'Scan & Extract Claims'}</span>
                </button>

                <button
                  onClick={refreshAll}
                  className="p-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700"
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {verificationFeedback && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
                  verificationFeedback.ok
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}
              >
                <span>{verificationFeedback.message}</span>
                <button
                  onClick={() => setVerificationFeedback(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Total Claims</span>
                <p className="text-lg font-bold text-white font-mono mt-0.5">{claimsList.length}</p>
                <span className="text-[10px] text-emerald-400">
                  {claimsList.filter((c) => c.testability === 'TESTABLE').length} Testable
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Rule Candidates</span>
                <p className="text-lg font-bold text-cyan-400 font-mono mt-0.5">{rulesList.length}</p>
                <span className="text-[10px] text-slate-400">Machine Formalized</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Trusted Candidates</span>
                <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                  {rulesList.filter((r) => r.status === 'TRUSTED_CANDIDATE').length}
                </p>
                <span className="text-[10px] text-emerald-300">Statistically Verified</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Human Approved</span>
                <p className="text-lg font-bold text-purple-400 font-mono mt-0.5">
                  {rulesList.filter((r) => r.status === 'APPROVED').length}
                </p>
                <span className="text-[10px] text-purple-300">Safety Gate Passed</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Rejected / Failed</span>
                <p className="text-lg font-bold text-rose-400 font-mono mt-0.5">
                  {rulesList.filter((r) => r.status === 'REJECTED' || r.status === 'CONTRADICTED').length}
                </p>
                <span className="text-[10px] text-rose-400">Post-Mortem Logged</span>
              </div>
            </div>
          </div>

          {/* Section 1: Formalized Rule Candidates Workbench */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  <span>Rule Candidates & Automated Verification Workbench</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Each rule candidate undergoes In-Sample (70%) backtest, Out-of-Sample (30%) frozen test, and Walk-Forward stability checks before reaching Trusted Candidate status.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {rulesList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No rule candidates currently available. Scan research chunks above to extract testable claims.
                </div>
              ) : (
                rulesList.map((rule) => {
                  const isTrusted = rule.status === 'TRUSTED_CANDIDATE';
                  const isApproved = rule.status === 'APPROVED';
                  const isRejected = rule.status === 'REJECTED';
                  const isHypothesis = rule.status === 'HYPOTHESIS';

                  return (
                    <div
                      key={rule.ruleId}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                                rule.direction === 'CALL'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {rule.direction}
                            </span>
                            <h5 className="font-semibold text-white text-xs">{rule.name}</h5>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                              v{rule.version}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-mono rounded font-semibold border ${
                                isApproved
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                  : isTrusted
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : isRejected
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : isHypothesis
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              }`}
                            >
                              STATUS: {rule.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{rule.description}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <button
                            onClick={async () => {
                              try {
                                const ev = await fetchRuleEvidenceChain(rule.ruleId);
                                setActiveEvidenceModal(ev.evidenceChain);
                              } catch (e: unknown) {
                                alert(e instanceof Error ? e.message : 'Error fetching evidence');
                              }
                            }}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Evidence Chain</span>
                          </button>

                          <button
                            onClick={async () => {
                              setVerificationLoading(rule.ruleId);
                              try {
                                const res = await verifyRuleCandidate(rule.ruleId);
                                setActiveRuleValidation(res.record);
                                await refreshAll();
                                setVerificationFeedback({
                                  ok: true,
                                  message: res.message,
                                });
                              } catch (e: unknown) {
                                setVerificationFeedback({
                                  ok: false,
                                  message: e instanceof Error ? e.message : 'Verification failed',
                                });
                              } finally {
                                setVerificationLoading(null);
                              }
                            }}
                            disabled={verificationLoading === rule.ruleId}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                          >
                            <BarChart2 className={`w-3.5 h-3.5 ${verificationLoading === rule.ruleId ? 'animate-spin' : ''}`} />
                            <span>{verificationLoading === rule.ruleId ? 'Running Verification...' : 'Run Full Verification'}</span>
                          </button>

                          {isTrusted && !isApproved && (
                            <button
                              onClick={() => {
                                setHumanApprovalTarget(rule);
                                setHumanApprovalNotes('Evidence chain and out-of-sample metrics verified by human supervisor.');
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                              <span>Human Safety Gate</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Rule Conditions Badges */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap text-[11px]">
                        <span className="text-slate-400 font-mono">Formalized Conditions:</span>
                        {rule.conditions.map((c, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono"
                          >
                            {c.description}
                          </span>
                        ))}
                        <span className="text-slate-400 font-mono ml-auto">
                          TF: {rule.timeframe} · Expiry: {rule.expiryCandles} candles
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 2: Research Claims Discovery List */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>Extracted Research Claims ({claimsList.length})</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Claims extracted from Phase 2C YouTube transcripts, BIS Research PDFs, and Articles. Only TESTABLE claims can be formalized into rules.
                </p>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                {['ALL', 'TESTABLE', 'NOT_TESTABLE', 'INSUFFICIENT_DATA'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setClaimFilter(f)}
                    className={`px-2.5 py-1 rounded-lg font-mono transition-colors ${
                      claimFilter === f
                        ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {claimsList
                .filter((c) => (claimFilter === 'ALL' ? true : c.testability === claimFilter))
                .map((claim) => {
                  const isTestable = claim.testability === 'TESTABLE';
                  const isFormalized = claim.status === 'FORMALIZED';

                  return (
                    <div
                      key={claim.claimId}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              isTestable
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {claim.testability}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-300 border border-slate-800">
                            {claim.claimType}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Source: {claim.evidenceReferences.authorOrChannel}
                          </span>
                        </div>

                        {/* Formalize button */}
                        {isTestable && !isFormalized && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await formalizeClaimToRule(claim.claimId);
                                await refreshAll();
                                setVerificationFeedback({
                                  ok: true,
                                  message: res.message,
                                });
                              } catch (e: unknown) {
                                setVerificationFeedback({
                                  ok: false,
                                  message: e instanceof Error ? e.message : 'Formalization failed',
                                });
                              }
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <FlaskConical className="w-3 h-3" />
                            <span>Formalize to Rule</span>
                          </button>
                        )}
                        {isFormalized && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                            FORMALIZED ({claim.ruleCandidateId?.substring(0, 10)}...)
                          </span>
                        )}
                      </div>

                      <p className="text-slate-200 font-mono text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                        "{claim.claimText}"
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                        <span>Classification Reason: {claim.testabilityReason || 'Standard extraction'}</span>
                        <span className="text-slate-500">
                          {new Date(claim.extractedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Modal: Rule Validation Report */}
          {activeRuleValidation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h4 className="font-semibold text-white text-xs">
                        Automated Verification Results: {activeRuleValidation.ruleId}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Verdict: {activeRuleValidation.verdict} · Evidence Score: {activeRuleValidation.evidenceScore}/100
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveRuleValidation(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
                  {/* Status Banner */}
                  <div
                    className={`p-3 rounded-xl border ${
                      activeRuleValidation.verdict === 'TRUSTED_CANDIDATE'
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                        : activeRuleValidation.verdict === 'REJECTED'
                        ? 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                        : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-200'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      <span>Validation Verdict: {activeRuleValidation.verdict}</span>
                    </div>
                    <p className="text-[11px] mt-1">{activeRuleValidation.statusNotes}</p>
                  </div>

                  {/* IS vs OOS Metrics Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono uppercase text-cyan-400 font-semibold">
                        In-Sample Backtest (70% Data)
                      </span>
                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Win Rate:</span>
                          <span className="text-white font-bold">{activeRuleValidation.inSampleMetrics.winRate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Trades (Wins / Losses):</span>
                          <span className="text-white">
                            {activeRuleValidation.inSampleMetrics.wins} / {activeRuleValidation.inSampleMetrics.losses}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Profit Factor:</span>
                          <span className="text-white">{activeRuleValidation.inSampleMetrics.profitFactor}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Expectancy:</span>
                          <span className="text-white">{activeRuleValidation.inSampleMetrics.expectancy}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Wilson 95% CI:</span>
                          <span className="text-slate-300">
                            [{activeRuleValidation.inSampleMetrics.confidenceInterval.lower}% - {activeRuleValidation.inSampleMetrics.confidenceInterval.upper}%]
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono uppercase text-emerald-400 font-semibold">
                        Out-of-Sample Test (30% Frozen)
                      </span>
                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">OOS Win Rate:</span>
                          <span className="text-emerald-400 font-bold">{activeRuleValidation.outOfSampleMetrics.winRate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Trades (Wins / Losses):</span>
                          <span className="text-white">
                            {activeRuleValidation.outOfSampleMetrics.wins} / {activeRuleValidation.outOfSampleMetrics.losses}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">OOS Retention Ratio:</span>
                          <span className="text-emerald-300 font-bold">
                            {(activeRuleValidation.oosRetentionRatio * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Max Drawdown:</span>
                          <span className="text-white">{activeRuleValidation.outOfSampleMetrics.maxDrawdown}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Wilson 95% CI:</span>
                          <span className="text-slate-300">
                            [{activeRuleValidation.outOfSampleMetrics.confidenceInterval.lower}% - {activeRuleValidation.outOfSampleMetrics.confidenceInterval.upper}%]
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Walk-Forward Test Windows */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-purple-400 font-semibold">
                        Walk-Forward Stability Windows
                      </span>
                      <span className="text-[10px] font-mono text-purple-300">
                        Consistency: {activeRuleValidation.walkForwardConsistencyScore}%
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                      {activeRuleValidation.walkForwardResults.map((wf) => (
                        <div
                          key={wf.windowIndex}
                          className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1"
                        >
                          <div className="flex justify-between text-slate-400 text-[10px]">
                            <span>Window #{wf.windowIndex}</span>
                            <span className={wf.consistent ? 'text-emerald-400' : 'text-rose-400'}>
                              {wf.consistent ? 'CONSISTENT' : 'DEGRADED'}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Train: {wf.trainWinRate}%</span>
                            <span className="font-semibold text-white">Test: {wf.testWinRate}%</span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {wf.tradesInTest} validation trades
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Post-Mortem & Learning */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-amber-400 font-semibold">
                      Post-Mortem & Agent Learning Memory
                    </span>
                    <div className="text-slate-300 text-[11px] space-y-1">
                      <p>
                        <strong>Overfitting Risk:</strong>{' '}
                        {activeRuleValidation.postMortem.overfittingDetected ? (
                          <span className="text-rose-400 font-semibold">DETECTED (&gt;25% OOS drop)</span>
                        ) : (
                          <span className="text-emerald-400">LOW (Edge preserved in out-of-sample data)</span>
                        )}
                      </p>
                      <p>
                        <strong>Weakest Market Regime:</strong>{' '}
                        <span className="font-mono text-amber-300">
                          {activeRuleValidation.postMortem.weakestRegime || 'None'}
                        </span>
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-400 text-[10px]">
                        {activeRuleValidation.postMortem.recommendedAdjustments.map((adj, i) => (
                          <li key={i}>{adj}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950">
                  <button
                    onClick={() => setActiveRuleValidation(null)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Rule Evidence Chain Inspector */}
          {activeEvidenceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-cyan-400" />
                    <div>
                      <h4 className="font-semibold text-white text-xs">
                        Audit Evidence Chain: {activeEvidenceModal.rule.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Rule ID: {activeEvidenceModal.rule.ruleId} · Status: {activeEvidenceModal.rule.status}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveEvidenceModal(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
                  {/* Step 1: Source */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400">
                      <span>STEP 1: UNTRUSTED EXTERNAL SOURCE</span>
                      <span className="text-amber-400 border border-amber-500/30 px-1 rounded">
                        untrusted: true
                      </span>
                    </div>
                    <p className="text-white font-medium">{activeEvidenceModal.source?.title || 'Unknown Source'}</p>
                    <p className="text-slate-400 text-[11px] font-mono truncate">{activeEvidenceModal.source?.url}</p>
                  </div>

                  {/* Step 2: Extracted Claim */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-purple-400">
                      <span>STEP 2: RESEARCH CLAIM</span>
                      <span>Type: {activeEvidenceModal.claim.claimType}</span>
                    </div>
                    <p className="text-slate-200 font-mono text-[11px] bg-slate-900 p-2 rounded">
                      "{activeEvidenceModal.claim.claimText}"
                    </p>
                  </div>

                  {/* Step 3: Formalized Rule */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase">
                      STEP 3: FORMALIZED TESTABLE CANDIDATE
                    </span>
                    <p className="text-white font-medium">{activeEvidenceModal.rule.name}</p>
                    <div className="flex gap-2 flex-wrap text-[11px] font-mono text-slate-300 pt-1">
                      {activeEvidenceModal.rule.conditions.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {c.description}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Step 4: Verification Validation */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-amber-400 uppercase">
                      STEP 4: EMPIRICAL VERIFICATION PROOF
                    </span>
                    {activeEvidenceModal.validation ? (
                      <div className="space-y-1 text-slate-300 font-mono text-[11px] pt-1">
                        <div>Evidence Score: {activeEvidenceModal.validation.evidenceScore}/100</div>
                        <div>OOS Win Rate: {activeEvidenceModal.validation.outOfSampleMetrics.winRate}%</div>
                        <div>Walk-Forward Consistency: {activeEvidenceModal.validation.walkForwardConsistencyScore}%</div>
                      </div>
                    ) : (
                      <p className="text-slate-500 italic text-[11px]">
                        Pending automated verification. Click "Run Full Verification" on the workbench.
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950">
                  <button
                    onClick={() => setActiveEvidenceModal(null)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
                  >
                    Close Evidence Chain
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Human Safety Gate Approval */}
          {humanApprovalTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
              <div className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-purple-950/40">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-purple-400" />
                    <div>
                      <h4 className="font-semibold text-white text-xs">Human Safety Gate Promotion</h4>
                      <p className="text-[10px] text-purple-300 font-mono">
                        Rule: {humanApprovalTarget.name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setHumanApprovalTarget(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs">
                    <strong>CRITICAL SAFETY INVARIANT:</strong> AI models and automated backtesters cannot unilaterally promote rules to production. This explicit human approval verifies evidence integrity and authorizes controlled production readiness.
                  </div>

                  <div className="space-y-2">
                    <label className="text-slate-300 font-semibold text-xs">Supervisor Review Notes:</label>
                    <textarea
                      value={humanApprovalNotes}
                      onChange={(e) => setHumanApprovalNotes(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950">
                  <button
                    onClick={() => setHumanApprovalTarget(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await approveRuleHumanGate(humanApprovalTarget.ruleId, humanApprovalNotes);
                        await refreshAll();
                        setVerificationFeedback({
                          ok: true,
                          message: res.message,
                        });
                        setHumanApprovalTarget(null);
                      } catch (e: unknown) {
                        alert(e instanceof Error ? e.message : 'Approval failed');
                      }
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Human Promotion</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab: Knowledge Base */}
      {activeSubTab === 'knowledge' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Curated domain knowledge items:</span>
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

      {/* Sub-Tab: Agent Memory */}
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

                {/* AI Reasoning */}
                {mem.reasoning && (
                  <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-800/40 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Reasoning / Hypothesis:</span>
                    </div>
                    <p className="text-cyan-200/90 text-[11px] leading-relaxed">{mem.reasoning}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tab: Context Retrieval Test */}
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

          {retrievalResult && (
            <div className="space-y-4 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-cyan-400">{retrievalResult.querySummary}</span>
                <span className="text-slate-500 font-mono">
                  Matches: {retrievalResult.totalMatches}
                </span>
              </div>

              <div className="space-y-2">
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Existing System Protection Footer */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>
            Existing TradingBot features (Binance WebSockets, 10-Pair Scanner, Backtest, Evaluator, Rules) remain 100% active and preserved.
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Phase 2C Complete
        </span>
      </div>
    </div>
  );
};
