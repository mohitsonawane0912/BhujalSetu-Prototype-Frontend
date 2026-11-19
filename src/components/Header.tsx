import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Droplets,
  AlertTriangle,
  Bell,
  Cpu,
  User,
  LogOut,
  ChevronDown,
  Info,
  CheckCircle2,
  X,
  MapPin,
  Radio,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { VillageCommunity, Alert, TelemetryConnectionStatus } from '../types/groundwater';

interface HeaderProps {
  currentVillage: VillageCommunity;
  availableVillages: VillageCommunity[];
  onSelectVillage: (village: VillageCommunity) => void;
  alerts: Alert[];
  onDismissAlert: (id: string) => void;
  onOpenHardwareModal: () => void;
  telemetryStatus?: TelemetryConnectionStatus;
}

export const Header: React.FC<HeaderProps> = ({
  currentVillage,
  availableVillages,
  onSelectVillage,
  alerts,
  onDismissAlert,
  onOpenHardwareModal,
  telemetryStatus = 'loading',
}) => {
  const { user, error, clearError, signIn, signUp, signOutUser } = useAuth();
  const [villageDropdownOpen, setVillageDropdownOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const activeAlerts = alerts.filter((a) => !a.isDismissed);
  const hasCritical = activeAlerts.some((a) => a.severity === 'CRITICAL');

  return (
    <header className="sticky top-0 z-40 bg-[#F5F1E8] border-b border-[#D8D2C4] backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#1F5A48] flex items-center justify-center text-[#F5F1E8] shadow-sm">
              <Droplets className="w-6 h-6 text-[#A7D7D7]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xl tracking-tight text-[#1E2A28]">
                  Bhujal<span className="text-[#1F5A48]">Setu</span>
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase bg-[#D9C6A4]/60 text-[#1E2A28] rounded border border-[#C56B4C]/20">
                  Prototype
                </span>
              </div>
              <p className="text-xs text-[#1E2A28]/70 hidden md:block">
                Community Groundwater Intelligence & Recharge
              </p>
            </div>
          </div>

          {/* Center: Community Selector & Demo Badge */}
          <div className="hidden lg:flex items-center space-x-4">
            {/* Village Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setVillageDropdownOpen(!villageDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#EAE5DB] hover:bg-[#E2DDD2] text-[#1E2A28] text-sm font-medium border border-[#D8D2C4] transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-[#3B7C8A]" />
                <span>{currentVillage.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#1E2A28]/60" />
              </button>

              {villageDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-[#F5F1E8] border border-[#D8D2C4] rounded-lg shadow-lg p-2 z-50">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1E2A28]/60 px-2 py-1 flex items-center justify-between">
                    <span>Authorized Community</span>
                    <span className="text-[10px] text-[#1F5A48] bg-[#1F5A48]/10 px-1.5 py-0.5 rounded font-bold">Verified</span>
                  </div>
                  {availableVillages.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        onSelectVillage(v);
                        setVillageDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex flex-col ${
                        v.id === currentVillage.id
                          ? 'bg-[#1F5A48] text-[#F5F1E8]'
                          : 'hover:bg-[#EAE5DB] text-[#1E2A28]'
                      }`}
                    >
                      <span className="font-medium">{v.name}</span>
                      <span
                        className={`text-xs ${
                          v.id === currentVillage.id
                            ? 'text-[#A7D7D7]'
                            : 'text-[#1E2A28]/60'
                        }`}
                      >
                        {v.district}, {v.state} • {v.aquiferType.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dynamic Hardware Telemetry Status Badge */}
            {telemetryStatus === 'ready' && (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#1F5A48]/15 border border-[#1F5A48]/30 text-[#1F5A48] text-xs font-semibold rounded">
                <Radio className="w-3.5 h-3.5 flex-shrink-0 text-[#1F5A48]" />
                <span>Tabletop Prototype · Live Telemetry</span>
              </div>
            )}
            {telemetryStatus === 'loading' && (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28]/70 text-xs font-semibold rounded animate-pulse">
                <Radio className="w-3.5 h-3.5 flex-shrink-0 text-[#1F5A48] animate-spin" />
                <span>Checking Telemetry...</span>
              </div>
            )}
            {telemetryStatus === 'no-data' && (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28]/70 text-xs font-semibold rounded">
                <Info className="w-3.5 h-3.5 flex-shrink-0 text-[#3B7C8A]" />
                <span>Waiting for Node Telemetry</span>
              </div>
            )}
            {telemetryStatus === 'signed-out' && (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#D9C6A4]/30 border border-[#D9C6A4] text-[#1E2A28]/70 text-xs font-semibold rounded">
                <WifiOff className="w-3.5 h-3.5 flex-shrink-0 text-[#C56B4C]" />
                <span>Sign In for Live Telemetry</span>
              </div>
            )}
            {telemetryStatus === 'unauthorized' && (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#B74A3B]/10 border border-[#B74A3B]/30 text-[#B74A3B] text-xs font-semibold rounded">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-[#B74A3B]" />
                <span>Membership Required</span>
              </div>
            )}
            {telemetryStatus === 'backend-error' && (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#C56B4C]/15 border border-[#C56B4C]/30 text-[#B74A3B] text-xs font-semibold rounded">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-[#C56B4C]" />
                <span>Telemetry Storage Offline</span>
              </div>
            )}
          </div>

          {/* Right Action Icons & Auth */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* ESP32 Hardware Blueprint button */}
            <button
              type="button"
              onClick={onOpenHardwareModal}
              title="View Planned ESP32 IoT Sensor Specs"
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-[#EAE5DB] hover:bg-[#E2DDD2] text-[#1E2A28] text-xs font-medium border border-[#D8D2C4] transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-[#3B7C8A]" />
              <span>ESP32 Blueprint</span>
            </button>

            {/* Notification / Alert Drawer Toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAlertsOpen(!alertsOpen)}
                className={`relative p-2 rounded-md border transition-colors ${
                  hasCritical
                    ? 'bg-[#B74A3B]/10 border-[#B74A3B]/40 text-[#B74A3B]'
                    : 'bg-[#EAE5DB] border-[#D8D2C4] text-[#1E2A28] hover:bg-[#E2DDD2]'
                }`}
                aria-label="View system alerts"
              >
                <Bell className="w-4 h-4" />
                {activeAlerts.length > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold rounded-full flex items-center justify-center text-white ${
                      hasCritical ? 'bg-[#B74A3B]' : 'bg-[#C56B4C]'
                    }`}
                  >
                    {activeAlerts.length}
                  </span>
                )}
              </button>

              {alertsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#F5F1E8] border border-[#D8D2C4] rounded-lg shadow-xl p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D8D2C4]">
                    <div className="flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-[#C56B4C]" />
                      <span className="font-semibold text-sm text-[#1E2A28]">
                        Aquifer Alert Feed ({activeAlerts.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAlertsOpen(false)}
                      className="text-[#1E2A28]/50 hover:text-[#1E2A28]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-2 space-y-2 max-h-80 overflow-y-auto pr-1">
                    {activeAlerts.length === 0 ? (
                      <div className="py-6 text-center text-sm text-[#1E2A28]/60">
                        <CheckCircle2 className="w-8 h-8 text-[#1F5A48] mx-auto mb-2" />
                        No active prototype sensor alerts. Tabletop hardware operating within normal bench bounds.
                      </div>
                    ) : (
                      activeAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-2.5 rounded-md text-xs border ${
                            alert.severity === 'CRITICAL'
                              ? 'bg-[#B74A3B]/10 border-[#B74A3B]/30 text-[#1E2A28]'
                              : alert.severity === 'WATCH'
                              ? 'bg-[#C56B4C]/10 border-[#C56B4C]/30 text-[#1E2A28]'
                              : 'bg-[#1F5A48]/10 border-[#1F5A48]/20 text-[#1E2A28]'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span
                              className={`font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded ${
                                alert.severity === 'CRITICAL'
                                  ? 'bg-[#B74A3B] text-white'
                                  : alert.severity === 'WATCH'
                                  ? 'bg-[#C56B4C] text-white'
                                  : 'bg-[#1F5A48] text-white'
                              }`}
                            >
                              {alert.severity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onDismissAlert(alert.id)}
                              className="text-[#1E2A28]/40 hover:text-[#1E2A28] ml-2"
                              title="Dismiss alert"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="font-medium mt-1 text-[#1E2A28] text-xs">
                            {alert.title}
                          </div>
                          <p className="mt-1 text-[#1E2A28]/80 leading-relaxed">
                            {alert.message}
                          </p>
                          <div className="mt-2 pt-1 border-t border-black/5 flex justify-between text-[10px] text-[#1E2A28]/60">
                            <span>{alert.triggerMetric}: {alert.actualValue}</span>
                            <span>{alert.timestamp}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile / Auth Area */}
            <div className="relative">
              {user ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 p-1.5 rounded-md hover:bg-[#EAE5DB] border border-transparent hover:border-[#D8D2C4] transition-colors"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="Profile"
                        className="w-7 h-7 rounded-full object-cover border border-[#1F5A48]"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#1F5A48] text-[#F5F1E8] flex items-center justify-center text-xs font-semibold">
                        {user.displayName?.[0] || 'U'}
                      </div>
                    )}
                    <span className="hidden sm:inline text-xs font-medium text-[#1E2A28] max-w-[120px] truncate">
                      {user.displayName}
                    </span>
                    <ChevronDown className="w-3 h-3 text-[#1E2A28]/60" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-[#F5F1E8] border border-[#D8D2C4] rounded-lg shadow-lg p-2 z-50">
                      <div className="px-3 py-2 border-b border-[#D8D2C4]">
                        <div className="text-xs font-semibold text-[#1E2A28]">
                          {user.displayName}
                        </div>
                        <div className="text-[11px] text-[#1E2A28]/60 truncate">
                          {user.email || 'Local Community Member'}
                        </div>
                        {user.role && (
                          <span className="inline-block mt-1 text-[10px] font-semibold text-[#1F5A48] bg-[#1F5A48]/10 px-1.5 py-0.5 rounded capitalize">
                            {user.role.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          signOutUser();
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-[#B74A3B] hover:bg-[#EAE5DB] rounded-md transition-colors mt-1"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setAuthModalOpen(true);
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-[#1F5A48] hover:bg-[#184638] text-[#F5F1E8] text-xs font-medium shadow-sm transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Community Sign In</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Banner: Telemetry Status */}
        <div className="lg:hidden pb-2 pt-1 flex items-center justify-between text-[11px]">
          <span className="font-medium text-[#1E2A28] flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#3B7C8A]" />
            {currentVillage.name}
          </span>
          <span className={`px-2 py-0.5 font-semibold rounded text-[10px] uppercase ${
            telemetryStatus === 'ready'
              ? 'bg-[#1F5A48]/15 border border-[#1F5A48]/30 text-[#1F5A48]'
              : telemetryStatus === 'loading'
              ? 'bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28]/70'
              : 'bg-[#D9C6A4]/30 border border-[#D9C6A4] text-[#1E2A28]/70'
          }`}>
            {telemetryStatus === 'ready'
              ? 'Prototype: Live Telemetry'
              : telemetryStatus === 'loading'
              ? 'Connecting...'
              : 'Prototype Telemetry'}
          </span>
        </div>

        {/* Auth Error Notification Bar */}
        {error && (
          <div className="mt-2 mb-2 p-2.5 rounded-lg bg-[#B74A3B]/10 border border-[#B74A3B]/30 text-xs text-[#1E2A28] flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-[#B74A3B] flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="p-1 text-[#1E2A28]/60 hover:text-[#1E2A28]"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Local Secure Auth Modal rendered via Portal to prevent sticky header clipping */}
        {authModalOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#F5F1E8] border border-[#D8D2C4] rounded-2xl max-w-md w-full p-6 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C4]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F5A48] block">
                    Local PostgreSQL Authentication
                  </span>
                  <h3 className="text-base font-bold text-[#1E2A28]">
                    {authMode === 'signin' ? 'Sign In to BhujalSetu' : 'Register New Community Account'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className="text-[#1E2A28]/60 hover:text-[#1E2A28] p-1 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="flex border-b border-[#D8D2C4] mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setFormError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                    authMode === 'signin'
                      ? 'border-[#1F5A48] text-[#1F5A48]'
                      : 'border-transparent text-[#1E2A28]/60 hover:text-[#1E2A28]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setFormError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                    authMode === 'register'
                      ? 'border-[#1F5A48] text-[#1F5A48]'
                      : 'border-transparent text-[#1E2A28]/60 hover:text-[#1E2A28]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {formError && (
                <div className="mt-3 p-2 bg-[#B74A3B]/10 border border-[#B74A3B]/30 rounded text-xs text-[#B74A3B]">
                  {formError}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFormError(null);
                  setAuthLoading(true);
                  try {
                    if (authMode === 'signin') {
                      await signIn(authEmail, authPassword);
                    } else {
                      await signUp(authEmail, authPassword, authName, currentVillage.id);
                    }
                    setAuthModalOpen(false);
                    setAuthEmail('');
                    setAuthPassword('');
                    setAuthName('');
                  } catch (err: any) {
                    setFormError(err.message || 'Authentication error');
                  } finally {
                    setAuthLoading(false);
                  }
                }}
                className="mt-4 space-y-3"
              >
                {authMode === 'register' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#1E2A28] mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="e.g. Ramesh Patel"
                      className="w-full px-3 py-2 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#1E2A28] mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="e.g. resident@rampur.in"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E2A28] mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D8D2C4] rounded-lg text-[#1E2A28] focus:outline-hidden focus:border-[#1F5A48]"
                  />
                </div>

                {authMode === 'register' && (
                  <p className="text-[11px] text-[#C56B4C]">
                    New accounts start with <strong>pending</strong> membership status. Active membership activates after both Node 1 and Node 2 check in with measured telemetry.
                  </p>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#1F5A48] hover:bg-[#184638] text-white font-semibold text-xs transition-colors shadow-xs disabled:opacity-50"
                  >
                    {authLoading
                      ? 'Processing...'
                      : authMode === 'signin'
                      ? 'Sign In'
                      : 'Register & Join Community'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    </header>
  );
};
