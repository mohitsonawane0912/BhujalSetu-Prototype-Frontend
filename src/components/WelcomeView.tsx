import React, { useState, useEffect } from 'react';
import {
  Droplets,
  Shield,
  Radio,
  CheckCircle2,
  Clock,
  AlertCircle,
  LogIn,
  UserPlus,
  RefreshCw,
  LogOut,
  Info,
  Server,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NodeStatusPayload {
  nodeId: 'node-1' | 'node-2';
  name: string;
  description: string;
  verified: boolean;
  lastSeen: string | null;
  flowLpm: number | null;
  waterLevelCm?: number | null;
}

interface SetupStatusData {
  communityRegistered: boolean;
  community: {
    id: string;
    name: string;
    district?: string;
    state?: string;
  } | null;
  node1: NodeStatusPayload;
  node2: NodeStatusPayload;
  bothNodesVerified: boolean;
  membershipStatus: 'active' | 'pending' | 'none';
}

interface WelcomeViewProps {
  onActivated: () => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onActivated }) => {
  const { user, membershipStatus, signIn, signUp, registerCommunity, verifyHardwareNodes, signOutUser, error, clearError } = useAuth();

  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  const [setupStatus, setSetupStatus] = useState<SetupStatusData | null>(null);
  const [isCheckingNodes, setIsCheckingNodes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [communityName, setCommunityName] = useState('Rampur Prototype Village');
  const [villageId, setVillageId] = useState('village-rampur-04');
  const [district, setDistrict] = useState('Pune');
  const [state, setState] = useState('Maharashtra');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  // Fetch setup status on mount and poll
  const fetchSetupStatus = async () => {
    try {
      const res = await fetch('/api/auth/setup-status');
      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (data && data.success) {
          setSetupStatus(data);
          if (data.bothNodesVerified && membershipStatus === 'pending') {
            const resVerify = await verifyHardwareNodes();
            if (resVerify.activated) {
              onActivated();
            }
          }
        }
      }
    } catch {
      // Ignore background network error
    }
  };

  useEffect(() => {
    fetchSetupStatus();
    const interval = window.setInterval(fetchSetupStatus, 3000);
    return () => window.clearInterval(interval);
  }, [membershipStatus]);

  // Handle manual hardware check
  const handleCheckHardware = async () => {
    setIsCheckingNodes(true);
    setFormError(null);
    try {
      await fetchSetupStatus();
      const res = await verifyHardwareNodes();
      if (res.bothNodesVerified) {
        onActivated();
      } else {
        setFormError('Waiting for packets from both nodes. Check serial monitors to ensure both ESP32 boards have connected and transmitted.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Hardware verification check failed.');
    } finally {
      setIsCheckingNodes(false);
    }
  };

  // Sign In handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (result.membershipStatus === 'active') {
        onActivated();
      } else {
        // If pending, check nodes
        const verifyRes = await verifyHardwareNodes();
        if (verifyRes.activated) {
          onActivated();
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Sign in failed. Check your email and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registration handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (!setupStatus?.communityRegistered) {
        let parsedLat: number | null = null;
        let parsedLon: number | null = null;
        if (latitude.trim() || longitude.trim()) {
          if (!latitude.trim() || !longitude.trim()) {
            setFormError('Both latitude and longitude must be provided together, or leave both blank for unconfigured weather.');
            setIsSubmitting(false);
            return;
          }
          const lat = Number(latitude.trim());
          const lon = Number(longitude.trim());
          if (isNaN(lat) || lat < -90 || lat > 90) {
            setFormError('Latitude must be a valid number between -90 and 90 degrees.');
            setIsSubmitting(false);
            return;
          }
          if (isNaN(lon) || lon < -180 || lon > 180) {
            setFormError('Longitude must be a valid number between -180 and 180 degrees.');
            setIsSubmitting(false);
            return;
          }
          parsedLat = lat;
          parsedLon = lon;
        }

        // First community registration
        await registerCommunity({
          communityName,
          villageId,
          district,
          state,
          latitude: parsedLat,
          longitude: parsedLon,
          email,
          password,
          displayName,
        });
      } else {
        // Registering to existing single community
        await signUp(email, password, displayName, setupStatus.community?.id || villageId);
      }
      await fetchSetupStatus();
    } catch (err: any) {
      setFormError(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPending = user && membershipStatus === 'pending';

  return (
    <div className="min-h-screen bg-[#F5F1E8] text-[#1E2A28] flex flex-col justify-between selection:bg-[#1F5A48] selection:text-[#F5F1E8]">
      {/* Top Banner / Navigation */}
      <header className="bg-[#EAE5DB] border-b border-[#D8D2C4] py-4 px-4 sm:px-6 lg:px-8 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#1F5A48] flex items-center justify-center text-[#F5F1E8] shadow-sm">
              <Droplets className="w-6 h-6 text-[#A7D7D7]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xl tracking-tight text-[#1E2A28]">
                  Bhujal<span className="text-[#1F5A48]">Setu</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-[#D9C6A4]/70 text-[#1E2A28] rounded border border-[#C56B4C]/20">
                  Competition Prototype
                </span>
              </div>
              <p className="text-xs text-[#1E2A28]/70 hidden sm:block">
                Community Groundwater Intelligence & Dual-Node Tabletop Monitor
              </p>
            </div>
          </div>

          {user && (
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <span className="text-xs font-bold text-[#1E2A28] block">{user.displayName}</span>
                <span className="text-[10px] text-[#C56B4C] font-semibold uppercase tracking-wider block">
                  Status: {membershipStatus}
                </span>
              </div>
              <button
                type="button"
                onClick={signOutUser}
                className="px-3 py-1.5 rounded-lg border border-[#D8D2C4] hover:bg-[#DCD6CA] text-xs font-semibold text-[#1E2A28] flex items-center space-x-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* VIEW 1: SIGNED IN BUT PENDING HARDWARE VERIFICATION */}
        {isPending ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white border border-[#D8D2C4] rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-start justify-between flex-wrap gap-4 pb-6 border-b border-[#D8D2C4]">
                <div>
                  <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#C56B4C] mb-1">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Hardware Verification In Progress</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E2A28]">
                    ESP32 Dual-Node Check-In Required
                  </h1>
                  <p className="text-xs sm:text-sm text-[#1E2A28]/70 mt-1">
                    Welcome, <strong>{user?.displayName}</strong>. Your community account is registered. Full dashboard access activates automatically once both Node 1 and Node 2 check in over your local Wi-Fi.
                  </p>
                </div>

                <div className="px-3 py-1.5 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-xs">
                  <span className="text-[#1E2A28]/60 block text-[10px] uppercase font-semibold">Registered Community</span>
                  <strong className="text-[#1E2A28]">{setupStatus?.community?.name || user?.communityId}</strong>
                </div>
              </div>

              {/* Instructions Box */}
              <div className="mt-6 p-4 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4] space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#1F5A48] uppercase tracking-wider">
                  <Shield className="w-4 h-4" />
                  <span>Local Wi-Fi & Firmware Instructions</span>
                </div>
                <ul className="text-xs text-[#1E2A28]/80 space-y-2 list-disc list-inside">
                  <li>
                    Connect both ESP32 boards to the same 2.4 GHz local Wi-Fi network as this computer.
                  </li>
                  <li>
                    Wi-Fi credentials and node API keys are maintained strictly in your local firmware <code className="bg-white px-1.5 py-0.5 rounded border border-[#D8D2C4] font-mono text-[11px]">secrets.h</code> file on your computer.
                  </li>
                  <li>
                    <strong>Security Notice:</strong> Wi-Fi passwords and device API keys are never requested by or sent to the browser.
                  </li>
                  <li>
                    Ensure the backend target URL in firmware points to: <code className="bg-white px-1.5 py-0.5 rounded border border-[#D8D2C4] font-mono text-[11px]">http://&lt;COMPUTER_LAN_IP&gt;:5001/api/v1/telemetry</code>
                  </li>
                </ul>
              </div>

              {/* Real-time Hardware Node Status Cards */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Node 1 */}
                <div className={`p-5 rounded-xl border transition-all ${
                  setupStatus?.node1.verified
                    ? 'bg-[#1F5A48]/5 border-[#1F5A48]/40'
                    : 'bg-[#EAE5DB]/60 border-[#D8D2C4]'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-[#1E2A28]">Node 1 (Recharge Line)</span>
                    {setupStatus?.node1.verified ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#1F5A48] bg-[#1F5A48]/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-[#C56B4C] bg-[#C56B4C]/10 px-2 py-0.5 rounded-full">
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                        <span>Waiting...</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#1E2A28]/70">
                    YF-S201 turbine flow sensor on recharge loop + HC-SR04 ultrasonic sensor on tabletop tank.
                  </p>
                  <div className="mt-3 pt-3 border-t border-[#D8D2C4]/60 text-xs">
                    {setupStatus?.node1.verified ? (
                      <div className="space-y-1 text-[#1F5A48]">
                        <div>Last Measured Flow: <strong>{setupStatus.node1.flowLpm?.toFixed(1)} L/min</strong></div>
                        <div>Tank Water Level: <strong>{setupStatus.node1.waterLevelCm?.toFixed(1)} cm</strong></div>
                        <div className="text-[10px] text-[#1E2A28]/60">Captured: {new Date(setupStatus.node1.lastSeen!).toLocaleTimeString()}</div>
                      </div>
                    ) : (
                      <div className="text-[#1E2A28]/60 italic text-[11px]">
                        No authenticated packets received yet for {setupStatus?.community?.id || 'this village'}.
                      </div>
                    )}
                  </div>
                </div>

                {/* Node 2 */}
                <div className={`p-5 rounded-xl border transition-all ${
                  setupStatus?.node2.verified
                    ? 'bg-[#1F5A48]/5 border-[#1F5A48]/40'
                    : 'bg-[#EAE5DB]/60 border-[#D8D2C4]'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-[#1E2A28]">Node 2 (Extraction Line)</span>
                    {setupStatus?.node2.verified ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#1F5A48] bg-[#1F5A48]/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-[#C56B4C] bg-[#C56B4C]/10 px-2 py-0.5 rounded-full">
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                        <span>Waiting...</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#1E2A28]/70">
                    YF-S201 turbine flow sensor on pump extraction hose.
                  </p>
                  <div className="mt-3 pt-3 border-t border-[#D8D2C4]/60 text-xs">
                    {setupStatus?.node2.verified ? (
                      <div className="space-y-1 text-[#1F5A48]">
                        <div>Last Measured Flow: <strong>{setupStatus.node2.flowLpm?.toFixed(1)} L/min</strong></div>
                        <div className="text-[10px] text-[#1E2A28]/60">Captured: {new Date(setupStatus.node2.lastSeen!).toLocaleTimeString()}</div>
                      </div>
                    ) : (
                      <div className="text-[#1E2A28]/60 italic text-[11px]">
                        No authenticated packets received yet for {setupStatus?.community?.id || 'this village'}.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {formError && (
                <div className="mt-4 p-3 bg-[#B74A3B]/10 border border-[#B74A3B]/30 rounded-lg text-xs text-[#B74A3B] flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#D8D2C4]">
                <div className="text-xs text-[#1E2A28]/60 flex items-center space-x-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Auto-polling hardware packets every 3 seconds...</span>
                </div>

                <button
                  type="button"
                  onClick={handleCheckHardware}
                  disabled={isCheckingNodes}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#1F5A48] hover:bg-[#184638] text-white font-bold text-xs transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingNodes ? 'animate-spin' : ''}`} />
                  <span>Check Hardware & Activate</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: SIGNED-OUT WELCOME & AUTH FLOW */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Prototype Information & Hardware Status */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#1F5A48] mb-1.5">
                  <Server className="w-4 h-4 text-[#1F5A48]" />
                  <span>Local PostgreSQL Competition Edition</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1E2A28] tracking-tight">
                  Turning Groundwater Data into Community Action
                </h1>
                <p className="text-sm sm:text-base text-[#1E2A28]/70 mt-2 leading-relaxed">
                  BhujalSetu bridges physical sensor telemetry with participatory water budgeting. Sign in to your community account or register the competition prototype below to begin.
                </p>
              </div>

              {/* Live Prototype Setup Overview Card */}
              <div className="bg-white border border-[#D8D2C4] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#D8D2C4] pb-3">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-[#1F5A48]" />
                    <span className="font-bold text-sm text-[#1E2A28]">Prototype Setup Status</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#EAE5DB] text-[#1E2A28]/70">
                    Live Diagnostics
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Community Status */}
                  <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4]/70">
                    <span className="text-[10px] font-semibold text-[#1E2A28]/60 uppercase tracking-wider block">
                      1. Prototype Community
                    </span>
                    <div className="flex items-center space-x-2 mt-1">
                      {setupStatus?.communityRegistered ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#1F5A48] flex-shrink-0" />
                          <span className="font-bold text-[#1E2A28]">{setupStatus.community?.name}</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-[#C56B4C] flex-shrink-0" />
                          <span className="font-medium text-[#1E2A28]/80">Not registered yet</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Account Status */}
                  <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4]/70">
                    <span className="text-[10px] font-semibold text-[#1E2A28]/60 uppercase tracking-wider block">
                      2. Primary Account
                    </span>
                    <div className="flex items-center space-x-2 mt-1">
                      {setupStatus?.communityRegistered ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#1F5A48] flex-shrink-0" />
                          <span className="font-bold text-[#1E2A28]">Ready for sign-in</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-[#C56B4C] flex-shrink-0" />
                          <span className="font-medium text-[#1E2A28]/80">Register below</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Node 1 Status */}
                  <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4]/70">
                    <span className="text-[10px] font-semibold text-[#1E2A28]/60 uppercase tracking-wider block">
                      3. Node 1 (Recharge & Level)
                    </span>
                    <div className="flex items-center space-x-2 mt-1">
                      {setupStatus?.node1.verified ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#1F5A48] flex-shrink-0" />
                          <span className="font-bold text-[#1F5A48]">Connected</span>
                        </>
                      ) : (
                        <>
                          <Radio className="w-4 h-4 text-[#C56B4C] animate-pulse flex-shrink-0" />
                          <span className="font-medium text-[#1E2A28]/80">Waiting for packet</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Node 2 Status */}
                  <div className="p-3 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4]/70">
                    <span className="text-[10px] font-semibold text-[#1E2A28]/60 uppercase tracking-wider block">
                      4. Node 2 (Extraction)
                    </span>
                    <div className="flex items-center space-x-2 mt-1">
                      {setupStatus?.node2.verified ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#1F5A48] flex-shrink-0" />
                          <span className="font-bold text-[#1F5A48]">Connected</span>
                        </>
                      ) : (
                        <>
                          <Radio className="w-4 h-4 text-[#C56B4C] animate-pulse flex-shrink-0" />
                          <span className="font-medium text-[#1E2A28]/80">Waiting for packet</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#EAE5DB] text-[11px] text-[#1E2A28]/70 flex items-start space-x-2">
                  <Info className="w-4 h-4 text-[#1F5A48] flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Verification Policy:</strong> The competition dashboard requires measured Node 1 and Node 2 packets. Accounts remain pending until authenticated telemetry checks in.
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Authentication Card (Page-level layout, immune to header clipping) */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-[#D8D2C4] rounded-2xl p-6 sm:p-7 shadow-md">
                {/* Mode Selector Tabs */}
                <div className="flex border-b border-[#D8D2C4] pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setFormError(null);
                    }}
                    className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
                      activeTab === 'signin'
                        ? 'border-[#1F5A48] text-[#1F5A48]'
                        : 'border-transparent text-[#1E2A28]/60 hover:text-[#1E2A28]'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setFormError(null);
                    }}
                    className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
                      activeTab === 'register'
                        ? 'border-[#1F5A48] text-[#1F5A48]'
                        : 'border-transparent text-[#1E2A28]/60 hover:text-[#1E2A28]'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>
                      {setupStatus?.communityRegistered ? 'Register Member' : 'Register Prototype'}
                    </span>
                  </button>
                </div>

                {formError && (
                  <div className="mt-4 p-3 bg-[#B74A3B]/10 border border-[#B74A3B]/30 rounded-lg text-xs text-[#B74A3B] flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* SIGN IN FORM */}
                {activeTab === 'signin' && (
                  <form onSubmit={handleSignIn} className="mt-5 space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-[#1E2A28] mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. admin@rampur.in"
                        className="w-full px-3.5 py-2 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1E2A28] mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your account password"
                        className="w-full px-3.5 py-2 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                      />
                    </div>

                    <p className="text-[11px] text-[#1E2A28]/60 pt-1">
                      Sign in using your local PostgreSQL account credentials.
                    </p>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1F5A48] hover:bg-[#184638] text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50 mt-2 flex items-center justify-center space-x-1.5"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying Credentials...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In to BhujalSetu</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* REGISTER COMMUNITY & ACCOUNT FORM */}
                {activeTab === 'register' && (
                  <form onSubmit={handleRegister} className="mt-5 space-y-3">
                    {!setupStatus?.communityRegistered ? (
                      /* Mode A: First Community Registration */
                      <>
                        <div className="p-2.5 rounded-lg bg-[#1F5A48]/10 border border-[#1F5A48]/20 text-[11px] text-[#1F5A48]">
                          <strong>Prototype Community Setup:</strong> Register the primary community and its owner account.
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#1E2A28] mb-1">
                            Community / Village Name
                          </label>
                          <input
                            type="text"
                            required
                            value={communityName}
                            onChange={(e) => setCommunityName(e.target.value)}
                            placeholder="e.g. Rampur Village Prototype"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-[#1E2A28] mb-1">
                              District
                            </label>
                            <input
                              type="text"
                              value={district}
                              onChange={(e) => setDistrict(e.target.value)}
                              placeholder="e.g. Pune"
                              className="w-full px-3 py-1.5 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-[#1E2A28] mb-1">
                              State
                            </label>
                            <input
                              type="text"
                              value={state}
                              onChange={(e) => setState(e.target.value)}
                              placeholder="e.g. Maharashtra"
                              className="w-full px-3 py-1.5 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-[#1E2A28] mb-1">
                              Latitude (Optional)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={latitude}
                              onChange={(e) => setLatitude(e.target.value)}
                              placeholder="e.g. 18.5204"
                              className="w-full px-3 py-1.5 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-[#1E2A28] mb-1">
                              Longitude (Optional)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={longitude}
                              onChange={(e) => setLongitude(e.target.value)}
                              placeholder="e.g. 73.8567"
                              className="w-full px-3 py-1.5 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-[#1E2A28]/60">
                          Optional coordinates for Open-Meteo rainfall forecasts (-90 to 90, -180 to 180). Leave blank if unconfigured.
                        </p>
                      </>
                    ) : (
                      /* Mode B: Registering member for existing single community */
                      <div className="p-2.5 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-[11px] text-[#1E2A28]">
                        Joining community: <strong>{setupStatus.community?.name}</strong> ({setupStatus.community?.id})
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-[#1E2A28] mb-1">
                        Primary Account Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Ramesh Patel"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1E2A28] mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. owner@rampur.in"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#1E2A28] mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                      />
                    </div>

                    <p className="text-[11px] text-[#C56B4C] font-medium pt-1">
                      Registration creates your account in <strong>pending</strong> status. Active dashboard access activates after Node 1 and Node 2 check-in.
                    </p>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1F5A48] hover:bg-[#184638] text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50 mt-2 flex items-center justify-center space-x-1.5"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Registering Account...</span>
                        </>
                      ) : (
                        <>
                          <span>Register & Proceed to Device Setup</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#EAE5DB] border-t border-[#D8D2C4] py-6 text-xs text-[#1E2A28]/70 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#1E2A28]">BhujalSetu</span>
            <span>— Dual-Node ESP32 Local Prototype</span>
          </div>
          <div className="text-[11px] text-[#1E2A28]/60">
            Local PostgreSQL Database • Wi-Fi Credentials Maintained in Local Firmware Secrets Only
          </div>
        </div>
      </footer>
    </div>
  );
};
