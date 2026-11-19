import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Sparkles,
  Info,
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  X,
  SlidersHorizontal,
  Layers,
  HelpCircle,
  AlertTriangle,
  ShieldAlert,
  CloudRain,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Waves,
  Activity,
  Calendar,
  Compass,
} from 'lucide-react';
import { ActionRecommendation, ActionPriority, ActionStatus, CommunityActionItem } from '../types/groundwater';
import { useAuth } from '../context/AuthContext';
import { BhujalSetuApi, AiAdvisorData, AdviceLevel } from '../services/api';

interface ActionsViewProps {
  recommendations: ActionRecommendation[];
  onUpdateStatus: (id: string, newStatus: ActionStatus) => void;
  onAddCommunityAction: (action: Omit<CommunityActionItem, 'id' | 'createdAt' | 'communityId'>) => Promise<void>;
}

export const ActionsView: React.FC<ActionsViewProps> = ({
  recommendations,
  onUpdateStatus,
  onAddCommunityAction,
}) => {
  const { user } = useAuth();
  const [selectedRecForDetail, setSelectedRecForDetail] = useState<ActionRecommendation | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | ActionPriority>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ActionStatus>('ALL');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Advisor state
  const [advisorData, setAdvisorData] = useState<AiAdvisorData | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(true);
  const [advisorError, setAdvisorError] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);

  const fetchAdvisor = async () => {
    setAdvisorLoading(true);
    setAdvisorError(null);
    try {
      const data = await BhujalSetuApi.getAiAdvisor(user?.communityId);
      setAdvisorData(data);
    } catch (err: any) {
      setAdvisorError(err.message || 'Failed to load AI Advisor intelligence.');
    } finally {
      setAdvisorLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisor();
  }, [user?.communityId]);

  // New action form state
  const [actionTitle, setActionTitle] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionWard, setActionWard] = useState('Ward 2 (Northern Catchment)');
  const [actionType, setActionType] = useState<CommunityActionItem['actionType']>('recharge_pit_clearing');
  const [actionImpactLiters, setActionImpactLiters] = useState(15000);

  const filteredRecs = recommendations.filter((r) => {
    if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    return true;
  });

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTitle.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddCommunityAction({
        userId: user?.uid || 'community-guest',
        userName: user?.displayName || 'Community Member',
        userEmail: user?.email || undefined,
        actionType,
        title: actionTitle,
        description: actionDesc,
        ward: actionWard,
        impactLiters: Number(actionImpactLiters) || 0,
        status: 'in_progress',
      });
      // Reset form
      setActionTitle('');
      setActionDesc('');
      setIsLogModalOpen(false);
    } catch (err) {
      console.error('Error logging action:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8D2C4]">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#1F5A48] mb-1">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Participatory Intervention</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E2A28]">
            Groundwater Action Layer
          </h1>
          <p className="text-xs sm:text-sm text-[#1E2A28]/70 mt-0.5">
            Converting hydrological monitoring data into timely, coordinated community management.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsLogModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-[#1F5A48] hover:bg-[#184638] text-[#F5F1E8] text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Log Community Action</span>
        </button>
      </div>

      {/* 1. DYNAMIC AI GROUNDWATER ADVISOR PANEL (4 LEVELS FROM PITCH DECK SLIDE 12) */}
      <section className="bg-[#1E2A28] text-[#F5F1E8] rounded-2xl p-6 sm:p-7 shadow-md border border-[#2B3B38] relative overflow-hidden">
        {/* Header with Title and Level Badge */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1F5A48] text-[#A7D7D7] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold tracking-wider text-[#A7D7D7] uppercase">
                  AI Groundwater Advisor
                </span>
                <span className="text-[10px] text-[#D9C6A4] font-medium bg-[#2B3B38] px-2 py-0.5 rounded border border-[#3E524D]">
                  {advisorData?.synthesisSource === 'gemini' ? 'Gemini 2.5 Hydrological Synthesis' : 'Hydrological Rule Engine'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#F5F1E8] mt-0.5">
                Participatory Hydrological Decision Layer
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Advice Level Badge */}
            {advisorLoading ? (
              <span className="px-3 py-1 rounded bg-[#2B3B38] text-xs font-bold text-[#D9C6A4] flex items-center space-x-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#A7D7D7]" />
                <span>Evaluating Evidence...</span>
              </span>
            ) : advisorData?.level === 'NORMAL_USE' ? (
              <span className="px-3 py-1 rounded-full bg-[#1F5A48] text-[#A7D7D7] border border-[#2B7A60] text-xs font-extrabold flex items-center space-x-1.5 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#A7D7D7]" />
                <span>NORMAL USE</span>
              </span>
            ) : advisorData?.level === 'CONSERVE_WATER' ? (
              <span className="px-3 py-1 rounded-full bg-[#C56B4C]/25 text-[#F5D0A9] border border-[#C56B4C] text-xs font-extrabold flex items-center space-x-1.5 shadow-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-[#C56B4C]" />
                <span>CONSERVE WATER</span>
              </span>
            ) : advisorData?.level === 'CRITICAL_CONSERVATION' ? (
              <span className="px-3 py-1 rounded-full bg-[#B74A3B] text-white border border-[#E06A5A] text-xs font-extrabold flex items-center space-x-1.5 shadow-xs animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5 text-white" />
                <span>CRITICAL CONSERVATION</span>
              </span>
            ) : advisorData?.level === 'PREPARE_RECHARGE' ? (
              <span className="px-3 py-1 rounded-full bg-[#3B7C8A] text-white border border-[#5BA1B0] text-xs font-extrabold flex items-center space-x-1.5 shadow-xs">
                <CloudRain className="w-3.5 h-3.5 text-[#A7E8D7]" />
                <span>PREPARE RECHARGE</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-[#2B3B38] text-[#D9C6A4] border border-[#3E524D] text-xs font-extrabold flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-[#D9C6A4]" />
                <span>WAITING FOR DATA</span>
              </span>
            )}

            <button
              type="button"
              onClick={fetchAdvisor}
              disabled={advisorLoading}
              title="Refresh AI Advisor Intelligence"
              className="p-1.5 rounded-lg bg-[#2B3B38] hover:bg-[#3E524D] text-[#A7D7D7] transition-colors border border-[#3E524D]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${advisorLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Advisor Output */}
        <div className="mt-4 p-5 rounded-xl bg-[#2B3B38]/90 border border-[#3E524D]">
          {advisorLoading ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-[#A7D7D7] animate-spin" />
              <p className="text-xs text-[#F5F1E8]/70">
                Reviewing measured data and advisor status...
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-base sm:text-lg font-bold text-[#F5F1E8] flex items-center space-x-2">
                <span>{advisorData?.headline}</span>
              </h3>

              <p className="mt-2 text-sm sm:text-base text-[#F5F1E8]/90 leading-relaxed">
                {advisorData?.explanation}
              </p>

              {/* Priority Recommended Action Box */}
              <div className="mt-4 p-3.5 rounded-lg bg-[#1F5A48]/30 border border-[#2B7A60]/40 flex items-start space-x-3">
                <div className="w-6 h-6 rounded-md bg-[#1F5A48] text-[#A7D7D7] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#A7D7D7] block">
                    Recommended Community Intervention:
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-[#F5F1E8] mt-0.5">
                    {advisorData?.recommendedAction}
                  </p>
                </div>
              </div>

              {advisorData?.nextReviewAt && (
                <p className="mt-3 text-[11px] text-[#D9C6A4]/80">
                  Daily decision from the rolling last 24 hours. Next review: {new Date(advisorData.nextReviewAt).toLocaleString()}.
                </p>
              )}

              {/* Evidence Toggle Button */}
              <div className="mt-4 pt-3 border-t border-[#3E524D] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2 text-xs text-[#D9C6A4]">
                  <span>Inputs: Hardware telemetry • Open-Meteo Weather • IMD Agro-Climatic rules</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEvidence(!showEvidence)}
                  className="px-3 py-1.5 rounded bg-[#1F5A48] hover:bg-[#256d57] text-[#F5F1E8] text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                >
                  <Activity className="w-3.5 h-3.5 text-[#A7D7D7]" />
                  <span>{showEvidence ? 'Hide Evidence Breakdown' : 'Examine Evidence Breakdown'}</span>
                  {showEvidence ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                </button>
              </div>

              {/* Detailed Evidence Breakdown Grid */}
              {showEvidence && advisorData?.evidence && (
                <div className="mt-4 pt-4 border-t border-[#3E524D] space-y-3 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Evidence 1: Node Telemetry */}
                    <div className="p-3 rounded-lg bg-[#1E2A28] border border-[#3E524D]">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-[#A7D7D7] flex items-center">
                          <Activity className="w-3 h-3 mr-1" /> Node Telemetry
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          advisorData.evidence.nodeTelemetry.status === 'measured'
                            ? 'bg-[#1F5A48] text-[#A7D7D7]'
                            : advisorData.evidence.nodeTelemetry.status === 'stale'
                            ? 'bg-[#C56B4C]/30 text-[#F5D0A9]'
                            : 'bg-[#2B3B38] text-[#D9C6A4]'
                        }`}>
                          {advisorData.evidence.nodeTelemetry.status}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-[#F5F1E8]/85">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#A7D7D7] font-semibold">Node 1 (Recharge):</span>
                            <span className="text-[10px] font-medium text-[#D9C6A4]">
                              {advisorData.evidence.nodeTelemetry.node1Freshness || (advisorData.evidence.nodeTelemetry.rechargeFlowLpm !== null ? 'Live' : 'Missing')}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#F5F1E8]/70">
                            Latest: {advisorData.evidence.nodeTelemetry.rechargeFlowLpm !== null ? `${advisorData.evidence.nodeTelemetry.rechargeFlowLpm.toFixed(2)} L/min` : 'No reading'} • 24h avg: {advisorData.evidence.nodeTelemetry.averageRechargeFlowLpm !== null ? `${advisorData.evidence.nodeTelemetry.averageRechargeFlowLpm.toFixed(2)} L/min` : 'No samples'} • Tank: {advisorData.evidence.nodeTelemetry.tankLevelCm !== null ? `${advisorData.evidence.nodeTelemetry.tankLevelCm.toFixed(1)} cm` : 'No ultrasonic'}
                          </p>
                        </div>

                        <div className="pt-1 border-t border-[#3E524D]/50">
                          <div className="flex items-center justify-between">
                            <span className="text-[#A7D7D7] font-semibold">Node 2 (Extraction):</span>
                            <span className="text-[10px] font-medium text-[#D9C6A4]">
                              {advisorData.evidence.nodeTelemetry.node2Freshness || (advisorData.evidence.nodeTelemetry.extractionFlowLpm !== null ? 'Live' : 'Missing')}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#F5F1E8]/70">
                            Latest: {advisorData.evidence.nodeTelemetry.extractionFlowLpm !== null ? `${advisorData.evidence.nodeTelemetry.extractionFlowLpm.toFixed(2)} L/min` : 'No reading'} • 24h avg: {advisorData.evidence.nodeTelemetry.averageExtractionFlowLpm !== null ? `${advisorData.evidence.nodeTelemetry.averageExtractionFlowLpm.toFixed(2)} L/min` : 'No samples'} • Total: {advisorData.evidence.nodeTelemetry.extractionTotalLiters !== null ? `${advisorData.evidence.nodeTelemetry.extractionTotalLiters.toFixed(2)} L` : '0 L'}
                          </p>
                        </div>
                      </div>

                      {advisorData.evidence.nodeTelemetry.limitationNote && (
                        <p className="mt-2 text-[10px] text-[#F5D0A9] bg-[#C56B4C]/15 p-1 rounded border border-[#C56B4C]/30">
                          {advisorData.evidence.nodeTelemetry.limitationNote}
                        </p>
                      )}

                      <div className="mt-2 text-[10px] text-[#D9C6A4]/70 pt-1.5 border-t border-[#3E524D]/60">
                        Window: {advisorData.evidence.nodeTelemetry.windowDuration} • Samples: {advisorData.evidence.nodeTelemetry.sampleCount}
                      </div>
                    </div>

                    {/* Evidence 2: Weather Forecast */}
                    <div className="p-3 rounded-lg bg-[#1E2A28] border border-[#3E524D]">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-[#A7D7D7] flex items-center">
                          <CloudRain className="w-3 h-3 mr-1" /> Weather Forecast
                        </span>
                        <span className="text-[10px] text-[#D9C6A4] px-1.5 py-0.5 rounded bg-[#2B3B38]">
                          {advisorData.evidence.weather.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#F5F1E8]/80">
                        {advisorData.evidence.weather.summary}
                      </p>
                      <div className="mt-2 text-[10px] text-[#D9C6A4]/70 pt-1.5 border-t border-[#3E524D]/60">
                        Source: {advisorData.evidence.weather.source}<br />
                        Location: {advisorData.evidence.weather.location}
                      </div>
                    </div>

                    {/* Evidence 3: Seasonal Context */}
                    <div className="p-3 rounded-lg bg-[#1E2A28] border border-[#3E524D]">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-[#A7D7D7] flex items-center">
                          <Calendar className="w-3 h-3 mr-1" /> Seasonal Context
                        </span>
                        <span className="text-[10px] text-[#D9C6A4] px-1.5 py-0.5 rounded bg-[#2B3B38]">
                          IMD Calendar
                        </span>
                      </div>
                      <p className="text-[11px] text-[#F5F1E8]/80">
                        <strong>{advisorData.evidence.seasonal.seasonName}</strong> ({advisorData.evidence.seasonal.calendarPeriod})
                      </p>
                      <p className="text-[10px] text-[#F5F1E8]/70 mt-1">
                        {advisorData.evidence.seasonal.guidance}
                      </p>
                      <div className="mt-2 text-[10px] text-[#D9C6A4]/70 pt-1.5 border-t border-[#3E524D]/60">
                        Rule: {advisorData.evidence.seasonal.ruleSource}
                      </div>
                    </div>

                    {/* Evidence 4: Groundwater Depth Limitation Note */}
                    <div className="p-3 rounded-lg bg-[#1E2A28] border border-[#3E524D]">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-[#A7D7D7] flex items-center">
                          <Waves className="w-3 h-3 mr-1" /> Deep Aquifer Depth
                        </span>
                        <span className="text-[10px] text-[#C56B4C] px-1.5 py-0.5 rounded bg-[#2B3B38]">
                          UNMEASURED
                        </span>
                      </div>
                      <p className="text-[11px] text-[#F5F1E8]/80">
                        {advisorData.evidence.groundwater.limitationNote}
                      </p>
                      <div className="mt-2 text-[10px] text-[#D9C6A4]/70 pt-1.5 border-t border-[#3E524D]/60">
                        Source: Tabletop HC-SR04 ultrasonic sensor measures reservoir water level, not deep borewell tables.
                      </div>
                    </div>
                  </div>

                  {/* Anomaly Detection Status Banner */}
                  <div className="p-3 rounded-lg bg-[#1E2A28] border border-[#3E524D] flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong className="text-xs text-[#A7D7D7]">Extraction Anomaly Baseline Status:</strong>{' '}
                      <span className="text-xs text-[#F5F1E8]/85">
                        {advisorData.evidence.anomaly.detected
                          ? `Anomaly active: ${advisorData.evidence.anomaly.reason}`
                          : advisorData.evidence.anomaly.baselineLpm
                          ? `Normal extraction operating baseline established (${advisorData.evidence.anomaly.baselineLpm.toFixed(2)} L/min)`
                          : 'Awaiting 10 active pumping samples to establish statistical baseline'}
                      </span>
                    </div>
                    {advisorData.evidence.anomaly.detected && (
                      <span className="px-2 py-0.5 rounded bg-[#B74A3B] text-white font-bold text-[10px]">
                        ANOMALY DETECTED
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Data Quality & Limitation Disclaimer */}
        <div className="mt-3 px-3 py-2 rounded-lg bg-[#2B3B38]/50 border border-[#3E524D]/60 flex items-center space-x-2 text-[10px] text-[#D9C6A4]">
          <Info className="w-3.5 h-3.5 text-[#A7D7D7] flex-shrink-0" />
          <span>{advisorData?.dataQualityNote || 'Tabletop prototype sensors measure bench flow and reservoir level only.'}</span>
        </div>
      </section>

      {/* 2. STATIC PARTICIPATORY GUIDELINES (CLEARLY SEPARATE EDUCATIONAL REFERENCE) */}
      <section className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-2xl p-5 shadow-xs">
        <div className="flex items-start justify-between flex-wrap gap-2 pb-3 border-b border-[#D8D2C4]">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1E2A28]/60">
                Community Playbook
              </span>
              <span className="text-[10px] font-bold text-[#1F5A48] bg-[#1F5A48]/10 px-2 py-0.5 rounded">
                Static Reference Guidelines
              </span>
            </div>
            <h3 className="text-base font-bold text-[#1E2A28] mt-0.5">
              Standard Village Groundwater Stewardship Framework
            </h3>
          </div>
          <span className="text-[10px] text-[#1E2A28]/60 italic max-w-xs text-right">
            General operational guidelines for village water security committees (Pani Samiti).
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#1E2A28]/80">
          <div className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]">
            <strong className="block text-[#1E2A28] font-bold mb-1">Rotational Tubewell Shifts</strong>
            <p className="text-[11px] text-[#1E2A28]/70">
              Maintain synchronized pumping schedules among clustered agricultural borewells to minimize localized drawdown cones.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]">
            <strong className="block text-[#1E2A28] font-bold mb-1">Pre-Monsoon Filter Clearing</strong>
            <p className="text-[11px] text-[#1E2A28]/70">
              Clear sand and gravel filtration beds in community percolation pits prior to seasonal rain runoff pulses.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]">
            <strong className="block text-[#1E2A28] font-bold mb-1">Night Leak Inspection</strong>
            <p className="text-[11px] text-[#1E2A28]/70">
              Perform periodic night-time flow checks when domestic and agricultural drawdowns are paused to verify pipeline integrity.
            </p>
          </div>
        </div>
      </section>

      {/* Filter and Status Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#1E2A28]/60 mr-1 flex items-center">
            <Filter className="w-3.5 h-3.5 mr-1" /> Priority:
          </span>
          {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriorityFilter(p)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                priorityFilter === p
                  ? 'bg-[#1F5A48] text-[#F5F1E8]'
                  : 'bg-[#EAE5DB] text-[#1E2A28] hover:bg-[#DCD6CA]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#1E2A28]/60 mr-1">Status:</span>
          {(['ALL', 'OPEN', 'IN_PROGRESS', 'COMPLETED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                statusFilter === s
                  ? 'bg-[#3B7C8A] text-[#F5F1E8]'
                  : 'bg-[#EAE5DB] text-[#1E2A28] hover:bg-[#DCD6CA]'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations Cards Grid */}
      <div className="space-y-4">
        {filteredRecs.map((rec) => {
          const isHigh = rec.priority === 'HIGH';
          const isCompleted = rec.status === 'COMPLETED';
          const isInProgress = rec.status === 'IN_PROGRESS';

          return (
            <div
              key={rec.id}
              className={`p-5 rounded-xl border transition-all ${
                isCompleted
                  ? 'bg-[#EAE5DB]/60 border-[#D8D2C4] opacity-80'
                  : 'bg-[#EAE5DB] border-[#D8D2C4] shadow-xs hover:border-[#1F5A48]/50'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isHigh
                          ? 'bg-[#B74A3B] text-white'
                          : rec.priority === 'MEDIUM'
                          ? 'bg-[#C56B4C] text-white'
                          : 'bg-[#1F5A48] text-white'
                      }`}
                    >
                      Priority {rec.priority}
                    </span>
                    <span className="text-xs font-semibold text-[#1E2A28]/60 bg-[#D9C6A4]/30 px-2 py-0.5 rounded">
                      {rec.category}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                        isCompleted
                          ? 'bg-[#1F5A48]/20 text-[#1F5A48]'
                          : isInProgress
                          ? 'bg-[#3B7C8A]/20 text-[#3B7C8A]'
                          : 'bg-[#C56B4C]/20 text-[#C56B4C]'
                      }`}
                    >
                      {rec.status.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-[#1E2A28]/50 ml-auto">
                      {rec.dateGenerated}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#1E2A28]">
                    {rec.title}
                  </h3>

                  {/* Why this appeared */}
                  <div className="p-3 rounded-md bg-[#F5F1E8] border border-[#D8D2C4]/70 text-xs">
                    <span className="font-bold text-[#1E2A28] block mb-0.5">
                      Why this recommendation appeared:
                    </span>
                    <p className="text-[#1E2A28]/80 leading-relaxed">
                      {rec.whyAppeared}
                    </p>
                  </div>

                  {/* Suggested action */}
                  <div className="text-xs text-[#1E2A28]/90">
                    <span className="font-bold text-[#1F5A48]">Suggested Action: </span>
                    <span>{rec.suggestedAction}</span>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#D8D2C4]">
                  <button
                    type="button"
                    onClick={() => setSelectedRecForDetail(rec)}
                    className="text-xs font-semibold text-[#3B7C8A] hover:underline flex items-center space-x-1"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>View Supporting Metrics</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {rec.status !== 'COMPLETED' ? (
                      <>
                        {rec.status === 'OPEN' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(rec.id, 'IN_PROGRESS')}
                            className="px-3 py-1.5 rounded-md bg-[#3B7C8A] hover:bg-[#2f636e] text-white text-xs font-semibold transition-colors"
                          >
                            Mark In Progress
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(rec.id, 'COMPLETED')}
                          className="px-3 py-1.5 rounded-md bg-[#1F5A48] hover:bg-[#184638] text-white text-xs font-semibold transition-colors flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resolve</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(rec.id, 'OPEN')}
                        className="px-2.5 py-1 text-xs text-[#1E2A28]/60 hover:text-[#1E2A28] underline"
                      >
                        Re-open
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* "Why am I seeing this?" Supporting Measurements Modal */}
      {selectedRecForDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#F5F1E8] border border-[#D8D2C4] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-[#D8D2C4]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F5A48] block">
                  Rule Evaluation Audit
                </span>
                <h3 className="text-base font-bold text-[#1E2A28] mt-0.5">
                  Supporting Sensor Metrics
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecForDetail(null)}
                className="text-[#1E2A28]/50 hover:text-[#1E2A28] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4]">
                <h4 className="font-bold text-xs text-[#1E2A28]">
                  Recommendation: {selectedRecForDetail.title}
                </h4>
                <p className="text-xs text-[#1E2A28]/80 mt-1">
                  {selectedRecForDetail.whyAppeared}
                </p>
              </div>

              <div className="text-xs font-bold uppercase tracking-wider text-[#1E2A28]/70 pt-2">
                Quantitative Triggers:
              </div>

              <div className="space-y-2">
                {selectedRecForDetail.supportingMetrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-white/70 border border-[#D8D2C4] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#1E2A28] block">
                        {metric.label}
                      </span>
                      <span className="text-[11px] text-[#1E2A28]/60">
                        {metric.threshold}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-[#B74A3B]">
                        {metric.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 rounded-lg bg-[#1F5A48]/10 border border-[#1F5A48]/30 text-[11px] text-[#1E2A28]/80 leading-relaxed">
                <strong>Methodology:</strong> This recommendation is generated from deterministic comparative threshold rules between water extraction and recharge rates. It does not use blackbox forecasting.
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-[#D8D2C4] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecForDetail(null)}
                className="px-4 py-2 rounded-lg bg-[#1F5A48] text-white text-xs font-bold"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "Log Community Action" Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#F5F1E8] border border-[#D8D2C4] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C4]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F5A48] block">
                  Participatory Ledger
                </span>
                <h3 className="text-base font-bold text-[#1E2A28]">
                  Log a Community Action
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="text-[#1E2A28]/50 hover:text-[#1E2A28]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAction} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1E2A28] mb-1">
                  Action Type
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full text-xs p-2 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28]"
                >
                  <option value="recharge_pit_clearing">Recharge Pit & Silt Basin De-Silting</option>
                  <option value="borewell_scheduling">Borewell Pumping Schedule Adjustment</option>
                  <option value="rainwater_harvest_check">Rooftop Filter Inspection & Clean</option>
                  <option value="leak_repair">Standpost / Distribution Pipe Leak Repair</option>
                  <option value="greywater_recycling">Household Greywater Soak Pit Setup</option>
                  <option value="recharge_well_monitoring">Recharge Well Dip & Filter Check</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2A28] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ward 3 Percolation Pit De-Silting"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2A28] mb-1">
                  Ward or Cluster
                </label>
                <input
                  type="text"
                  required
                  value={actionWard}
                  onChange={(e) => setActionWard(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2A28] mb-1">
                  Estimated Water Impact (Liters)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={actionImpactLiters}
                  onChange={(e) => setActionImpactLiters(Number(e.target.value))}
                  className="w-full text-xs p-2 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2A28] mb-1">
                  Description / Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe what was completed or mobilized..."
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28]"
                />
              </div>

              <div className="pt-3 border-t border-[#D8D2C4] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1E2A28]/70 hover:text-[#1E2A28]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#1F5A48] hover:bg-[#184638] text-white text-xs font-bold shadow-xs transition-colors"
                >
                  {isSubmitting ? 'Submitting...' : 'Log Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
