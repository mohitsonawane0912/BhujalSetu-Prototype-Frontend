import React, { useState, useEffect } from 'react';
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
  Building2,
  Edit2,
} from 'lucide-react';
import {
  VillageCommunity,
  CommunityActionItem,
  WaterPledgeItem,
  CommunityGemSummary,
} from '../types/groundwater';
import { useAuth } from '../context/AuthContext';
import { BhujalSetuApi } from '../services/api';

interface CommunityViewProps {
  village: VillageCommunity;
  actions: CommunityActionItem[];
  pledges: WaterPledgeItem[];
  onAddPledge: (pledge: Omit<WaterPledgeItem, 'id' | 'createdAt'>) => Promise<void>;
  gemSummary?: CommunityGemSummary | null;
  onVillageUpdate?: (updatedVillage: VillageCommunity) => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  village,
  actions,
  pledges,
  onAddPledge,
  onVillageUpdate,
}) => {
  const { user } = useAuth();
  const [pledgeModalOpen, setPledgeModalOpen] = useState(false);
  const [pledgeType, setPledgeType] = useState<WaterPledgeItem['pledgeType']>('irrigation_timing');
  const [targetLiters, setTargetLiters] = useState(100);
  const [pledgeUserName, setPledgeUserName] = useState('');
  const [submittingPledge, setSubmittingPledge] = useState(false);

  // Community State & Identity Configuration
  const [currentVillageState, setCurrentVillageState] = useState<VillageCommunity>(village);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [editName, setEditName] = useState(village.name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);

  // Community Location Configuration
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editLat, setEditLat] = useState(village.latitude != null ? String(village.latitude) : '');
  const [editLon, setEditLon] = useState(village.longitude != null ? String(village.longitude) : '');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSuccess, setLocationSuccess] = useState<string | null>(null);

  useEffect(() => {
    setCurrentVillageState(village);
    if (village.name) setEditName(village.name);
    if (village.latitude != null) setEditLat(String(village.latitude));
    if (village.longitude != null) setEditLon(String(village.longitude));
  }, [village]);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(null);
    setSavingName(true);
    try {
      const trimmed = editName.trim();
      if (!trimmed || trimmed.length < 2 || trimmed.length > 128) {
        throw new Error('Community name must be between 2 and 128 characters.');
      }
      const res = await BhujalSetuApi.updateCommunityName(trimmed);
      const updatedCommunity: VillageCommunity = {
        ...currentVillageState,
        name: trimmed,
        ...(res.community?.district ? { district: res.community.district } : {}),
        ...(res.community?.state ? { state: res.community.state } : {}),
      };
      setCurrentVillageState(updatedCommunity);
      onVillageUpdate?.(updatedCommunity);
      setNameSuccess(`Community name successfully changed to "${trimmed}".`);
      setNameModalOpen(false);
    } catch (err: any) {
      setNameError(err.message || 'Failed to update community name.');
    } finally {
      setSavingName(false);
    }
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocationError(null);
    setLocationSuccess(null);
    setSavingLocation(true);
    try {
      const lat = Number(editLat.trim());
      const lon = Number(editLon.trim());
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error('Latitude must be a valid number between -90 and 90 degrees.');
      }
      if (isNaN(lon) || lon < -180 || lon > 180) {
        throw new Error('Longitude must be a valid number between -180 and 180 degrees.');
      }
      await BhujalSetuApi.updateCommunityLocation(lat, lon);
      const updatedCommunity: VillageCommunity = {
        ...currentVillageState,
        latitude: lat,
        longitude: lon,
      };
      setCurrentVillageState(updatedCommunity);
      onVillageUpdate?.(updatedCommunity);
      setLocationSuccess(`Coordinates updated (${lat.toFixed(4)}°, ${lon.toFixed(4)}°). Open-Meteo weather forecasts will now resolve.`);
      setLocationModalOpen(false);
    } catch (err: any) {
      setLocationError(err.message || 'Failed to update community coordinates.');
    } finally {
      setSavingLocation(false);
    }
  };

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
            <strong className="text-[#1E2A28]">Community Governance Layer:</strong> Displays verified resident-submitted maintenance logs and voluntary conservation pledges for <strong>{currentVillageState.name}</strong>. Stored in PostgreSQL and managed separately from the tabletop sensor prototype.
          </span>
        </div>
        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-[#1F5A48]/10 text-[#1F5A48] rounded hidden sm:inline-block">
          Resident Submitted
        </span>
      </div>

      {/* Community Identity & Name Settings */}
      <div className="p-4 rounded-xl bg-[#EAE5DB] border border-[#D8D2C4] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#1F5A48]/15 text-[#1F5A48] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-[#1E2A28]">
                  {currentVillageState.name}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#1F5A48]/10 text-[#1F5A48]">
                  Verified Community
                </span>
              </div>
              <p className="text-xs text-[#1E2A28]/70 mt-1">
                Community ID: <code className="font-mono bg-[#E0DACE] px-1 py-0.5 rounded text-[11px]">{currentVillageState.id}</code>
                {currentVillageState.district ? ` • District: ${currentVillageState.district}` : ''}
                {currentVillageState.state ? ` • State: ${currentVillageState.state}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setNameModalOpen(true);
              setEditName(currentVillageState.name);
              setNameError(null);
            }}
            className="px-3.5 py-1.5 rounded-lg border border-[#D8D2C4] hover:bg-[#DCD6CA] text-xs font-bold text-[#1E2A28] flex items-center space-x-1.5 transition-colors self-start sm:self-center flex-shrink-0"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#1F5A48]" />
            <span>Change Community Name</span>
          </button>
        </div>

        {nameSuccess && (
          <div className="mt-3 p-2.5 rounded-lg bg-[#1F5A48]/10 border border-[#1F5A48]/25 text-xs text-[#1F5A48] flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{nameSuccess}</span>
          </div>
        )}
      </div>

      {/* Geographic Location & Weather Settings */}
      <div className="p-4 rounded-xl bg-[#EAE5DB] border border-[#D8D2C4] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#1F5A48]/15 text-[#1F5A48] flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-[#1E2A28]">
                  Geographic Location & Weather Forecast Settings
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  currentVillageState.latitude != null && currentVillageState.longitude != null
                    ? 'bg-[#1F5A48]/10 text-[#1F5A48]'
                    : 'bg-[#C56B4C]/15 text-[#C56B4C]'
                }`}>
                  {currentVillageState.latitude != null && currentVillageState.longitude != null ? 'Configured' : 'Unconfigured'}
                </span>
              </div>
              <p className="text-xs text-[#1E2A28]/70 mt-1">
                {currentVillageState.latitude != null && currentVillageState.longitude != null
                  ? `Stored Coordinates: ${currentVillageState.latitude.toFixed(4)}° N, ${currentVillageState.longitude.toFixed(4)}° E. Sourced strictly from PostgreSQL to query the Open-Meteo Weather API.`
                  : 'Coordinates are not configured. The AI Advisor keeps weather status as unconfigured and never fabricates forecasts for guessed locations.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setLocationModalOpen(true);
              setEditLat(currentVillageState.latitude != null ? String(currentVillageState.latitude) : '');
              setEditLon(currentVillageState.longitude != null ? String(currentVillageState.longitude) : '');
              setLocationError(null);
            }}
            className="px-3.5 py-1.5 rounded-lg border border-[#D8D2C4] hover:bg-[#DCD6CA] text-xs font-bold text-[#1E2A28] flex items-center space-x-1.5 transition-colors self-start sm:self-center flex-shrink-0"
          >
            <MapPin className="w-3.5 h-3.5 text-[#1F5A48]" />
            <span>{currentVillageState.latitude != null ? 'Update Coordinates' : 'Configure Coordinates'}</span>
          </button>
        </div>

        {locationSuccess && (
          <div className="mt-3 p-2.5 rounded-lg bg-[#1F5A48]/10 border border-[#1F5A48]/25 text-xs text-[#1F5A48] flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{locationSuccess}</span>
          </div>
        )}
      </div>

      {/* Community Water Status Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#EAE5DB] border border-[#D8D2C4] flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#1F5A48]/15 text-[#1F5A48] flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#1E2A28]/60 uppercase tracking-wider block">
              Active Pledges
            </span>
            <span className="text-xl font-bold text-[#1E2A28]">
              {pledges.length} Households
            </span>
            <span className="text-[10px] text-[#1F5A48] block mt-0.5 font-medium">
              Voluntary community commitments
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
              From {actions.length} logged community effort(s)
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
              {pledges.length} family pledge(s) active
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
              Survey Pending
            </span>
            <span className="text-[10px] text-[#C56B4C] block mt-0.5 font-medium">
              Structures awaiting physical survey
            </span>
          </div>
        </div>
      </div>

      {/* Ward Status Grid */}
      <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold text-sm text-[#1E2A28]">
            Ward Governance Structure & Stewardship Zones
          </h3>
          <span className="px-2 py-0.5 rounded bg-[#1F5A48]/10 text-[#1F5A48] font-bold uppercase text-[10px] tracking-wider">
            Zoning Framework • Field Survey Pending
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { name: 'Ward 1: Central Gram', focus: 'Domestic supply monitoring', status: 'Zoned' },
            { name: 'Ward 2: North Catchment', focus: 'Recharge pit & runoff capture', status: 'Zoned' },
            { name: 'Ward 3: Market & Bazaar', focus: 'Commercial extraction checks', status: 'Zoned' },
            { name: 'Ward 4: Agricultural South', focus: 'Irrigation & night roster', status: 'Zoned' },
          ].map((w) => (
            <div key={w.name} className="p-3.5 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]/80">
              <span className="font-bold text-xs text-[#1E2A28] block">{w.name}</span>
              <div className="mt-2 text-[11px] text-[#1E2A28]/70 space-y-0.5">
                <div>Focus: <strong className="text-[#1E2A28]">{w.focus}</strong></div>
                <div>Sensor Status: Tabletop bench prototype</div>
              </div>
              <div className="mt-2 pt-2 border-t border-[#D8D2C4] text-[10px] font-semibold text-[#1F5A48]">
                Framework: {w.status}
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

      {/* PROTOTYPE WATER CREDITS & INCENTIVE CONCEPT */}
      <section className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D8D2C4]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#1F5A48]/15 text-[#1F5A48] flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F5A48] block">
                Prototype Active in Water Balance Ledger
              </span>
              <h3 className="text-base font-bold text-[#1E2A28]">
                Prototype Water Credits & Community Stewardship
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <span className="px-2.5 py-1 bg-[#1F5A48]/15 text-[#1F5A48] text-xs font-bold rounded-md">
              Prototype Active
            </span>
            <span className="px-2.5 py-1 bg-[#3B7C8A]/15 text-[#3B7C8A] text-xs font-bold rounded-md">
              1 Credit = 1 Net Litre
            </span>
          </div>
        </div>

        {/* Concept Explanation Box */}
        <div className="mt-4 p-5 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4] space-y-3">
          <div className="flex items-start space-x-2.5 text-xs">
            <Sparkles className="w-4 h-4 text-[#1F5A48] flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#1E2A28] block text-sm">Tabletop Water Credits Feature:</strong>
              <p className="text-[#1E2A28]/80 font-medium mt-1 leading-relaxed">
                The Water Credits feature is actively implemented in the Water Balance dashboard. It audits completed daily periods from authenticated ESP32 Node 1 and Node 2 measured flow telemetry, calculating 1 Water Credit per net litre of recharge surplus. Deficits are recorded transparently and never decrement previously earned credits.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#D8D2C4]/70 text-[11px] text-[#1E2A28]/70">
            <div>• <strong>Prototype Points:</strong> Credits are prototype recognition points comparing tabletop measured flows. They carry no fiat cash value and cannot be exchanged for monetary rewards.</div>
            <div>• <strong>Audit Safeguards:</strong> Calculations are strictly server-side, requiring at least 75% valid daily sensor coverage without interpolating across gaps.</div>
            <div>• <strong>View Live Ledger:</strong> Navigate to the <strong>Water Balance</strong> tab to view current available credits, daily breakdown, and auditable history.</div>
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
      {/* Community Name Change Modal */}
      {nameModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1E2A28]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#F5F1E8] border border-[#D8D2C4] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C4]">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-[#1F5A48]" />
                <h3 className="font-extrabold text-base text-[#1E2A28]">
                  Change Community Name
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNameModalOpen(false)}
                className="text-[#1E2A28]/60 hover:text-[#1E2A28] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#1E2A28]/80 leading-relaxed">
              Update the community name displayed on your dashboard, telemetry logs, and community governance commons. Stored securely in PostgreSQL.
            </p>

            {nameError && (
              <div className="p-3 bg-[#B74A3B]/10 border border-[#B74A3B]/30 rounded-lg text-xs text-[#B74A3B] flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{nameError}</span>
              </div>
            )}

            <form onSubmit={handleNameSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1E2A28] mb-1">
                  Community Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={128}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Rampur Smart Watershed"
                  className="w-full text-xs p-2 rounded-lg bg-white border border-[#D8D2C4] text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                />
                <span className="text-[10px] text-[#1E2A28]/60 mt-0.5 block">
                  Must be between 2 and 128 characters.
                </span>
              </div>

              <div className="pt-3 border-t border-[#D8D2C4] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setNameModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1E2A28]/70 hover:text-[#1E2A28]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingName || !editName.trim()}
                  className="px-4 py-2 rounded-lg bg-[#1F5A48] hover:bg-[#184638] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  {savingName ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Geographic Location Configuration Modal */}
      {locationModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1E2A28]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#F5F1E8] border border-[#D8D2C4] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C4]">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-[#1F5A48]" />
                <h3 className="font-extrabold text-base text-[#1E2A28]">
                  Community Geographic Location
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLocationModalOpen(false)}
                className="text-[#1E2A28]/60 hover:text-[#1E2A28] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#1E2A28]/80 leading-relaxed">
              Coordinates are stored in PostgreSQL and used by the AI Advisor to fetch live Open-Meteo precipitation forecasts. Both coordinates must be provided together.
            </p>

            {locationError && (
              <div className="p-3 bg-[#B74A3B]/10 border border-[#B74A3B]/30 rounded-lg text-xs text-[#B74A3B] flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{locationError}</span>
              </div>
            )}

            <form onSubmit={handleLocationSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1E2A28] mb-1">
                  Latitude (-90 to 90 degrees)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editLat}
                  onChange={(e) => setEditLat(e.target.value)}
                  placeholder="e.g. 18.5204"
                  className="w-full text-xs p-2 rounded-lg bg-white border border-[#D8D2C4] text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E2A28] mb-1">
                  Longitude (-180 to 180 degrees)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editLon}
                  onChange={(e) => setEditLon(e.target.value)}
                  placeholder="e.g. 73.8567"
                  className="w-full text-xs p-2 rounded-lg bg-white border border-[#D8D2C4] text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                />
              </div>

              <div className="pt-3 border-t border-[#D8D2C4] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1E2A28]/70 hover:text-[#1E2A28]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLocation}
                  className="px-4 py-2 rounded-lg bg-[#1F5A48] hover:bg-[#184638] text-white text-xs font-bold shadow-xs transition-colors"
                >
                  {savingLocation ? 'Saving...' : 'Save Coordinates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
