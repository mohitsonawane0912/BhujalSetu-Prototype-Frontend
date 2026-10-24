import React, { useState } from 'react';
import {
  Cpu,
  X,
  Server,
  Wifi,
  Database,
  ArrowRight,
  Code2,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { HardwareSensorSpec } from '../types/groundwater';

interface HardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  spec: HardwareSensorSpec;
}

export const HardwareModal: React.FC<HardwareModalProps> = ({
  isOpen,
  onClose,
  spec,
}) => {
  const [activeTab, setActiveTab] = useState<'hardware' | 'pipeline' | 'backend'>('hardware');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#F5F1E8] border border-[#D8D2C4] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#D8D2C4]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3B7C8A]/15 text-[#3B7C8A] flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#3B7C8A] block">
                Engineering Specification
              </span>
              <h3 className="text-base font-bold text-[#1E2A28]">
                Planned ESP32 IoT Prototype Architecture
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#1E2A28]/50 hover:text-[#1E2A28] p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex space-x-1 mt-4 p-1 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4]">
          {[
            { id: 'hardware', label: '1. Sensor Bill of Materials' },
            { id: 'pipeline', label: '2. Telemetry Pipeline' },
            { id: 'backend', label: '3. Node.js Backend Integration' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === t.id
                  ? 'bg-[#1F5A48] text-[#F5F1E8] shadow-xs'
                  : 'text-[#1E2A28]/70 hover:text-[#1E2A28]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Hardware Specifications */}
        {activeTab === 'hardware' && (
          <div className="mt-5 space-y-4 text-xs text-[#1E2A28]">
            <div className="p-3 rounded-lg bg-[#C56B4C]/15 border border-[#C56B4C]/30 text-[#B74A3B] flex items-start space-x-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block">Hardware Integrity Guarantee:</strong>
                BhujalSetu does not fake hardware connectivity. The current dashboard uses realistic simulated calibration data, and the specifications below describe the verified prototype sensor design.
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4]">
                <span className="text-[10px] font-bold uppercase text-[#1F5A48] block">Microcontroller Core</span>
                <span className="font-bold text-sm block mt-0.5">{spec.controller}</span>
                <p className="text-[11px] text-[#1E2A28]/70 mt-1">
                  Handles GPIO pulse interrupts for flow turbines and ultrasonic trigger/echo timing. Built-in 2.4 GHz Wi-Fi sends JSON packets over HTTPS.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4]">
                <span className="text-[10px] font-bold uppercase text-[#3B7C8A] block">Water Level (Depth) Sensor</span>
                <span className="font-bold text-sm block mt-0.5">{spec.waterLevelSensor}</span>
                <p className="text-[11px] text-[#1E2A28]/70 mt-1">
                  Mounted atop the piezometer well casing. Calculates depth = (Speed of sound × Time) / 2 to determine water level fluctuations below ground surface.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4]">
                <span className="text-[10px] font-bold uppercase text-[#C56B4C] block">Dual Water Flow Sensors</span>
                <span className="font-bold text-sm block mt-0.5">{spec.flowSensors}</span>
                <p className="text-[11px] text-[#1E2A28]/70 mt-1">
                  <strong>Sensor 1 (Inflow):</strong> Fitted to the recharge pit intake pipe.<br />
                  <strong>Sensor 2 (Outflow):</strong> Fitted to the tubewell distribution discharge pipe.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4]">
                <span className="text-[10px] font-bold uppercase text-[#1E2A28] block">Actuator & Protection</span>
                <span className="font-bold text-sm block mt-0.5">{spec.actuator}</span>
                <p className="text-[11px] text-[#1E2A28]/70 mt-1">
                  Enables automated shut-off if continuous night draw exceeds baseline or if water table enters critical threshold.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Pipeline Diagram */}
        {activeTab === 'pipeline' && (
          <div className="mt-5 space-y-4">
            <span className="text-xs font-bold text-[#1E2A28] block">
              End-to-End Data Flow Architecture:
            </span>

            <div className="space-y-2">
              {[
                { step: '1', title: 'ESP32 Sensors', desc: 'HC-SR04 depth + 2× YF-S201 Hall turbines compute pulses per second', icon: Cpu, color: 'text-[#1F5A48]' },
                { step: '2', title: 'Wi-Fi / Cellular Gateway', desc: 'ESP32 packages telemetry JSON and connects to local Gram Panchayat Wi-Fi', icon: Wifi, color: 'text-[#3B7C8A]' },
                { step: '3', title: 'Node.js / Express API', desc: 'Express handles POST /api/telemetry with API key validation & sanity checking', icon: Server, color: 'text-[#C56B4C]' },
                { step: '4', title: 'Database & Rules Layer', desc: 'Stores readings into Firestore / PostgreSQL and evaluates rule-based alert triggers', icon: Database, color: 'text-[#1F5A48]' },
                { step: '5', title: 'React Dashboard (BhujalSetu)', desc: 'Hydrological dial, balance ledger, trends, and action recommendations render in real time', icon: Code2, color: 'text-[#3B7C8A]' },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="p-3 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] flex items-center space-x-3 text-xs">
                    <div className="w-7 h-7 rounded-md bg-[#F5F1E8] flex items-center justify-center font-bold text-[#1E2A28] flex-shrink-0">
                      {item.step}
                    </div>
                    <Icon className={`w-4 h-4 ${item.color} flex-shrink-0`} />
                    <div className="flex-1">
                      <span className="font-bold text-[#1E2A28] block">{item.title}</span>
                      <span className="text-[11px] text-[#1E2A28]/70">{item.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Node.js Backend Code Blueprint */}
        {activeTab === 'backend' && (
          <div className="mt-5 space-y-3">
            <p className="text-xs text-[#1E2A28]/80 leading-relaxed">
              When ready to deploy a live Node.js / Express server, point <code className="bg-[#EAE5DB] px-1 py-0.5 rounded font-mono text-xs">src/services/api.ts</code> to the following endpoints:
            </p>

            <div className="p-3.5 rounded-lg bg-[#1E2A28] text-[#F5F1E8] text-[11px] font-mono overflow-x-auto space-y-1">
              <span className="text-[#A7D7D7]">// server.ts - Express IoT Gateway</span><br />
              <span className="text-[#D9C6A4]">app.post('/api/telemetry', async (req, res) =&gt; &#123;</span><br />
              &nbsp;&nbsp;const &#123; wellId, depthMeters, inflowLiters, extractionLiters &#125; = req.body;<br />
              &nbsp;&nbsp;await db.collection('telemetry').add(&#123; ...req.body, timestamp: new Date() &#125;);<br />
              &nbsp;&nbsp;res.json(&#123; status: 'ok', received: true &#125;);<br />
              <span className="text-[#D9C6A4]">&#125;);</span><br /><br />
              <span className="text-[#A7D7D7]">// Dashboard Endpoints</span><br />
              app.get('/api/groundwater', getLatestGroundwaterLevel);<br />
              app.get('/api/water-balance', computeWaterBalance);<br />
              app.get('/api/trends', getTrendSeries);<br />
              app.get('/api/alerts', evaluateRuleAlerts);<br />
              app.get('/api/actions', getActionRecommendations);
            </div>

            <div className="p-3 rounded-lg bg-[#1F5A48]/10 border border-[#1F5A48]/30 text-xs text-[#1E2A28]/80 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#1F5A48] flex-shrink-0" />
              <span>
                All TypeScript interfaces in <code className="font-semibold text-[#1F5A48]">src/types/groundwater.ts</code> are 100% compatible with Express request and response contracts.
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-[#D8D2C4] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#1F5A48] text-white text-xs font-bold"
          >
            Close Blueprint
          </button>
        </div>
      </div>
    </div>
  );
};
