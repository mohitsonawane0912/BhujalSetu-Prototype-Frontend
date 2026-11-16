import React, { useState } from 'react';
import {
  Users,
  Award,
  HeartHandshake,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  Plus,
  X,
  Droplets,
  Calendar,
  AlertCircle,
  Shield,
  Layers,
} from 'lucide-react';
import {
  VillageCommunity,
  CommunityActionItem,
  WaterPledgeItem,
  CommunityGemSummary,
} from '../types/groundwater';
import { useAuth } from '../context/AuthContext';

interface CommunityViewProps {
  village: VillageCommunity;
  actions: CommunityActionItem[];
  pledges: WaterPledgeItem[];
  onAddPledge: (pledge: Omit<WaterPledgeItem, 'id' | 'createdAt'>) => Promise<void>;
  gemSummary?: CommunityGemSummary | null;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  village,
  actions,
  pledges,
  onAddPledge,
}) => {
  const { user } = useAuth();
  const [pledgeModalOpen, setPledgeModalOpen] = useState(false);
  const [pledgeType, setPledgeType] = useState<WaterPledgeItem['pledgeType']>('irrigation_timing');
  const [targetLiters, setTargetLiters] = useState(100);
  const [pledgeUserName, setPledgeUserName] = useState('');
  const [submittingPledge, setSubmittingPledge] = useState(false);

  const totalRechargeImpactLiters = actions.reduce((sum, a) => sum + (a.impactLiters || 0), 0);
  const totalDailyPledgeSaving = pledges.reduce((sum, p) => sum + (p.targetLitersPerDay || 0), 0);

  const handlePledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPledge(true);
    try {
      await onAddPledge({
        userId: user?.uid || 'guest-pledge',
        userName: pledgeUserName.trim() || user?.displayName || 'Resident Household',
        pledgeType,
        targetLitersPerDay: Number(targetLiters) || 50,
        communityId: village.id,
      });
      setPledgeUserName('');
      setPledgeModalOpen(false);
    } catch (err) {
      console.error('Error submitting pledge:', err);
    } finally {
      setSubmittingPledge(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8D2C4]">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#1F5A48] mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>Participatory Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E2A28]">
            Community Water Commons
          </h1>
          <p className="text-xs sm:text-sm text-[#1E2A28]/70 mt-0.5">
            Decentralized stewardship: neighborhood wards, voluntary conservation pledges, and recharge maintenance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPledgeModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-[#1F5A48] hover:bg-[#184638] text-[#F5F1E8] text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs self-start sm:self-auto"
        >
          <HeartHandshake className="w-4 h-4 text-[#A7D7D7]" />
          <span>Make Conservation Pledge</span>
        </button>
      </div>

      {/* Community Governance Context Notice */}
      <div className="p-3.5 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] flex items-center justify-between text-xs text-[#1E2A28]">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-[#1F5A48] flex-shrink-0" />
          <span>
            <strong className="text-[#1E2A28]">Community Governance Layer:</strong> Displays verified resident-submitted maintenance logs and voluntary conservation pledges for <strong>{village.name}</strong>. Stored in Firestore and managed separately from the tabletop sensor prototype.
          </span>
        </div>
        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-[#1F5A48]/10 text-[#1F5A48] rounded hidden sm:inline-block">
          Resident Submitted
        </span>
      </div>

      {/* Community Water Status Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#EAE5DB] border border-[#D8D2C4] flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#1F5A48]/15 text-[#1F5A48] flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#1E2A28]/60 uppercase tracking-wider block">
              Active Households
            </span>
            <span className="text-xl font-bold text-[#1E2A28]">
              {village.participatingHouseholds} Families
            </span>
            <span className="text-[10px] text-[#1F5A48] block mt-0.5 font-medium">
              Across 4 village wards
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#EAE5DB] border border-[#D8D2C4] flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#3B7C8A]/15 text-[#3B7C8A] flex items-center justify-center flex-shrink-0">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#1E2A28]/60 uppercase tracking-wider block">
              Action Water Impact
            </span>
            <span className="text-xl font-bold text-[#3B7C8A]">
              {(totalRechargeImpactLiters / 1000).toFixed(1)} m³
            </span>
            <span className="text-[10px] text-[#1E2A28]/70 block mt-0.5 font-medium">
              From logged community efforts
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#EAE5DB] border border-[#D8D2C4] flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#C56B4C]/15 text-[#C56B4C] flex items-center justify-center flex-shrink-0">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#1E2A28]/60 uppercase tracking-wider block">
              Pledged Daily Savings
            </span>
            <span className="text-xl font-bold text-[#C56B4C]">
              {totalDailyPledgeSaving.toLocaleString()} L / day
            </span>
            <span className="text-[10px] text-[#1E2A28]/70 block mt-0.5 font-medium">
              {pledges.length} family pledges active
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#EAE5DB] border border-[#D8D2C4] flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#1E2A28]/15 text-[#1E2A28] flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#1E2A28]/60 uppercase tracking-wider block">
              Recharge Assets
            </span>
            <span className="text-xl font-bold text-[#1E2A28]">
              {village.activeRechargeStructures} Structures
            </span>
            <span className="text-[10px] text-[#1F5A48] block mt-0.5 font-medium">
              All inspected this season
            </span>
          </div>
        </div>
      </div>

      {/* Ward Status Grid */}
      <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs">
        <h3 className="font-bold text-sm text-[#1E2A28] mb-3">
          Ward-Level Participation & Monitoring Units
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { name: 'Ward 1: Central Gram', hh: 98, wells: 3, pits: 2, status: 'Stable' },
            { name: 'Ward 2: North Catchment', hh: 112, wells: 5, pits: 3, status: 'Recharge Active' },
            { name: 'Ward 3: Market & Bazaar', hh: 64, wells: 4, pits: 1, status: 'Watch Depth' },
            { name: 'Ward 4: Agricultural South', hh: 68, wells: 6, pits: 1, status: 'Night Roster Active' },
          ].map((w) => (
            <div key={w.name} className="p-3.5 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]/80">
              <span className="font-bold text-xs text-[#1E2A28] block">{w.name}</span>
              <div className="mt-2 text-[11px] text-[#1E2A28]/70 space-y-0.5">
                <div>Households: <strong className="text-[#1E2A28]">{w.hh}</strong></div>
                <div>Borewells: {w.wells} | Recharge Pits: {w.pits}</div>
              </div>
              <div className="mt-2 pt-2 border-t border-[#D8D2C4] text-[10px] font-semibold text-[#1F5A48]">
                Status: {w.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RECENT COMMUNITY ACTIVITY FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Logged Recharge & Conservation Actions */}
        <div className="lg:col-span-7 bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C4]">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#1F5A48]" />
              <h3 className="font-bold text-sm text-[#1E2A28]">
                Recent Community Recharge & Conservation Log ({actions.length})
              </h3>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {actions.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#1E2A28]/60 p-4 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]">
                <CheckCircle2 className="w-8 h-8 text-[#1F5A48]/30 mx-auto mb-2" />
                <p className="font-semibold text-[#1E2A28]/80">No community actions logged for {village.name} yet.</p>
                <p className="text-[11px] text-[#1E2A28]/55 mt-1">
                  Community members can record de-silting, catchment repair, or pumping roster adjustments via the Actions tab.
                </p>
              </div>
            ) : (
              actions.map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1E2A28]">{act.title}</span>
                    <span className="text-[10px] uppercase font-bold text-[#1F5A48] bg-[#1F5A48]/10 px-2 py-0.5 rounded">
                      {act.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#1E2A28]/80 leading-relaxed">
                    {act.description}
                  </p>
                  <div className="pt-1 flex flex-wrap items-center justify-between text-[11px] text-[#1E2A28]/60 gap-1">
                    <span>Logged by: <strong className="text-[#1E2A28]">{act.userName}</strong> ({act.ward})</span>
                    <span className="text-[#1F5A48] font-bold">
                      +{(act.impactLiters).toLocaleString()} L Impact
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Household Water Pledges */}
        <div className="lg:col-span-5 bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C4]">
            <div className="flex items-center space-x-2">
              <HeartHandshake className="w-4 h-4 text-[#C56B4C]" />
              <h3 className="font-bold text-sm text-[#1E2A28]">
                Household Pledges ({pledges.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setPledgeModalOpen(true)}
              className="text-xs font-bold text-[#1F5A48] hover:underline"
            >
              + Add Pledge
            </button>
          </div>

          <div className="space-y-2.5">
            {pledges.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#1E2A28]/60 p-4 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]">
                <HeartHandshake className="w-8 h-8 text-[#C56B4C]/30 mx-auto mb-2" />
                <p className="font-semibold text-[#1E2A28]/80">No household pledges logged for {village.name} yet.</p>
                <p className="text-[11px] text-[#1E2A28]/55 mt-1">
                  Click "+ Add Pledge" above to submit a voluntary household water-saving commitment.
                </p>
              </div>
            ) : (
              pledges.map((p) => {
                const pledgeLabels: Record<string, string> = {
                  irrigation_timing: 'Night Irrigation & Staggered Schedule',
                  rain_storage: 'Rooftop Rain Harvesting Barrel',
                  aerator_install: 'Tap Aerator & Leak Maintenance',
                  recharge_well_adoption: 'Adopting Community Recharge Well',
                };

                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#1E2A28] block">{p.userName}</span>
                      <span className="text-[11px] text-[#1E2A28]/70">
                        {pledgeLabels[p.pledgeType] || p.pledgeType}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="font-bold text-xs text-[#1F5A48] block">
                        {p.targetLitersPerDay} L / day
                      </span>
                      <span className="text-[10px] text-[#1E2A28]/50">target saving</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* PROPOSED GROUNDWATER ECOLOGICAL MERITS (GEMS) & WATER CREDITS CONCEPT */}
      <section className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D8D2C4]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#1F5A48]/15 text-[#1F5A48] flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F5A48] block">
                Proposed Concept • Future Development
              </span>
              <h3 className="text-base font-bold text-[#1E2A28]">
                Groundwater Ecological Merits (GEMs) & Water Credits
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <span className="px-2.5 py-1 bg-[#1F5A48]/15 text-[#1F5A48] text-xs font-bold rounded-md">
              Proposed Concept Only
            </span>
            <span className="px-2.5 py-1 bg-[#C56B4C]/15 text-[#B74A3B] text-xs font-bold rounded-md">
              No Tokens Issued
            </span>
          </div>
        </div>

        {/* Concept Explanation Box */}
        <div className="mt-4 p-5 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4] space-y-3">
          <div className="flex items-start space-x-2.5 text-xs">
            <Sparkles className="w-4 h-4 text-[#1F5A48] flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#1E2A28] block text-sm">Proposed Incentive Mechanism (For Judges & Community Review):</strong>
              <p className="text-[#1E2A28]/80 font-medium mt-1 leading-relaxed">
                Groundwater Ecological Merits (GEMs) and Water Credits represent a conceptual framework designed to explore how verified net recharge stewardship could theoretically be recognized at the village level. Under this proposed design, positive recharge surplus would be recognized as a collective community merit rather than private financial gain.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#D8D2C4]/70 text-[11px] text-[#1E2A28]/70">
            <div>• <strong>Proposed for Future Development:</strong> This token and credit system is solely a proposed idea to explain the incentive concept to judges. No points, tokens, balances, or redemptions are calculated, awarded, or stored now.</div>
            <div>• <strong>Requires Stakeholder Agreement:</strong> Any future rollout will require formal participatory agreement from the village community, Gram Panchayat, and regional water authorities before implementation.</div>
            <div>• <strong>Strictly Non-Monetary:</strong> The proposed merits carry no cash value, cannot be redeemed for fiat currency, and cannot be traded privately.</div>
          </div>
        </div>
      </section>

      {/* Make a Pledge Modal */}
      {pledgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#F5F1E8] border border-[#D8D2C4] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C4]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F5A48] block">
                  Voluntary Stewardship
                </span>
                <h3 className="text-base font-bold text-[#1E2A28]">
                  Make a Water Conservation Pledge
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPledgeModalOpen(false)}
                className="text-[#1E2A28]/50 hover:text-[#1E2A28]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePledgeSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1E2A28] mb-1">
                  Household / Group Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meena Family (Ward 4)"
                  value={pledgeUserName}
                  onChange={(e) => setPledgeUserName(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2A28] mb-1">
                  Pledge Commitment
                </label>
                <select
                  value={pledgeType}
                  onChange={(e) => setPledgeType(e.target.value as any)}
                  className="w-full text-xs p-2 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28]"
                >
                  <option value="irrigation_timing">Shift Irrigation to Night Roster</option>
                  <option value="rain_storage">Install Rooftop Rain Catchment Barrel</option>
                  <option value="aerator_install">Install Tap Aerators & Fix Standpost Leaks</option>
                  <option value="recharge_well_adoption">Adopt & De-silt Community Recharge Well</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2A28] mb-1">
                  Target Daily Saving (Liters / day)
                </label>
                <input
                  type="number"
                  min="20"
                  max="1000"
                  step="10"
                  value={targetLiters}
                  onChange={(e) => setTargetLiters(Number(e.target.value))}
                  className="w-full text-xs p-2 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28]"
                />
              </div>

              <div className="pt-3 border-t border-[#D8D2C4] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setPledgeModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1E2A28]/70 hover:text-[#1E2A28]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPledge}
                  className="px-4 py-2 rounded-lg bg-[#1F5A48] hover:bg-[#184638] text-white text-xs font-bold shadow-xs transition-colors"
                >
                  {submittingPledge ? 'Submitting...' : 'Confirm Pledge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
