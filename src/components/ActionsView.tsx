import React, { useState } from 'react';
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
} from 'lucide-react';
import { ActionRecommendation, ActionPriority, ActionStatus, CommunityActionItem } from '../types/groundwater';
import { useAuth } from '../context/AuthContext';

interface ActionsViewProps {
  recommendations: ActionRecommendation[];
  onUpdateStatus: (id: string, newStatus: ActionStatus) => void;
  onAddCommunityAction: (action: Omit<CommunityActionItem, 'id' | 'createdAt'>) => Promise<void>;
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

      {/* INTELLIGENT RULE-BASED ADVISOR PANEL (NOT A CHATBOT) */}
      <section className="bg-[#1E2A28] text-[#F5F1E8] rounded-2xl p-6 sm:p-7 shadow-md border border-[#2B3B38] relative overflow-hidden">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#1F5A48] text-[#A7D7D7] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-wider text-[#A7D7D7] uppercase">
                Aquifer Advisory Engine
              </span>
              <h2 className="text-lg font-bold text-[#F5F1E8]">
                Rule & Trend-Based Advisory
              </h2>
            </div>
          </div>

          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#2B3B38] text-[10px] text-[#D9C6A4] font-medium border border-[#3E524D]">
            <span>Deterministic Rule Evaluation • Not Blackbox ML</span>
          </div>
        </div>

        {/* Primary Advisory Quote */}
        <div className="mt-4 p-4 rounded-xl bg-[#2B3B38]/80 border border-[#3E524D]">
          <p className="text-base sm:text-lg font-medium text-[#F5F1E8] leading-relaxed italic">
            “Groundwater level has declined faster than the recent baseline while extraction remains elevated. Consider reducing non-essential extraction and prioritizing recharge after the next rainfall event.”
          </p>

          <div className="mt-4 pt-3 border-t border-[#3E524D] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs text-[#A7D7D7]">
              <span>Key Observation: 18.4m depth (-0.6m shift) & extraction ratio 1.42×</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRecForDetail(recommendations[0])}
              className="px-3 py-1.5 rounded bg-[#1F5A48] hover:bg-[#256d57] text-[#F5F1E8] text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#A7D7D7]" />
              <span>Why am I seeing this? (Inspect Sensors)</span>
            </button>
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
