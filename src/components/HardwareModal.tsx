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
            <div className="p-3 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-[#1E2A28] flex items-start space-x-2">
              <Info className="w-4 h-4 text-[#1F5A48] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#1E2A28]">Current Implementation Boundary:</strong>
                Sensor wiring and basic pulse/echo readings have been verified locally in the Arduino Serial Monitor. ESP32 Wi-Fi transmission to the backend has not yet been uploaded or verified. The dashboard and backend are fully prepared to consume measured packets once live transmission is initiated.
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4]">
                <span className="text-[10px] font-bold uppercase text-[#1F5A48] block">Microcontroller Core</span>
                <span className="font-bold text-sm block mt-0.5">{spec.controller}</span>
                <p className="text-[11px] text-[#1E2A28]/70 mt-1">
                  Handles GPIO pulse interrupts for flow turbines and ultrasonic trigger/echo timing. Built-in 2.4 GHz Wi-Fi sends authenticated JSON telemetry to the local backend over the LAN.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4]">
                <span className="text-[10px] font-bold uppercase text-[#3B7C8A] block">Tabletop Tank Level Sensor</span>
                <span className="font-bold text-sm block mt-0.5">{spec.waterLevelSensor}</span>
                <p className="text-[11px] text-[#1E2A28]/70 mt-1">
                  Mounted above a small tank. It measures distance to the water surface and reports tank fill percentage; it does not measure groundwater depth.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4]">
                <span className="text-[10px] font-bold uppercase text-[#C56B4C] block">Two-Node Flow Instrumentation</span>
                <span className="font-bold text-sm block mt-0.5">{spec.flowSensors}</span>
                <p className="text-[11px] text-[#1E2A28]/70 mt-1">
                  <strong>Node 1 (Recharge Line):</strong> YF-S201 Hall turbine on the tabletop recharge loop inlet hose.<br />
                  <strong>Node 2 (Extraction Line):</strong> YF-S201 Hall turbine on the tabletop pump extraction hose.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4]">
                <span className="text-[10px] font-bold uppercase text-[#1E2A28] block">Manual Pump Circuit & Electrical Safety</span>
                <span className="font-bold text-sm block mt-0.5">Manual low-voltage pump (no relay automation)</span>
                <p className="text-[11px] text-[#1E2A28]/70 mt-1">
                  The pump is operated manually for demonstration. No automated pump relay control or claim that the ESP32 measures pump state. Never power a pump from an ESP32 GPIO or 3.3V rail.
                </p>
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] text-[11px] text-[#1E2A28] space-y-1.5 mt-3">
              <strong className="block text-[#1F5A48] text-xs">Node Telemetry Counter Behavior & Independence:</strong>
              <ul className="list-disc pl-4 space-y-1 text-[#1E2A28]/80">
                <li><strong>flow.pulses:</strong> The count for a 5-second sampling window, not a lifetime total.</li>
                <li><strong>flow.flowLpm:</strong> The recent instantaneous rate; reads 0.00 L/min when no water is moving.</li>
                <li><strong>flow.totalLiters:</strong> The ESP32 node&apos;s volatile session counter; resets to 0 whenever that board reboots or loses power.</li>
                <li><strong>Independent Sessions:</strong> Node 1 and Node 2 counters accumulate independently. The system never subtracts raw cumulative session totals to claim a net balance.</li>
              </ul>
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
                { step: '1', title: 'ESP32 Nodes', desc: 'Node 1 (recharge flow + HC-SR04 tank level) and Node 2 (extraction flow)', icon: Cpu, color: 'text-[#1F5A48]' },
                { step: '2', title: 'Local Wi-Fi', desc: 'ESP32 nodes send authenticated JSON packets over the local 2.4 GHz LAN', icon: Wifi, color: 'text-[#3B7C8A]' },
                { step: '3', title: 'Node.js / Express API', desc: 'Express validates POST /api/v1/telemetry with per-node schema and API keys', icon: Server, color: 'text-[#C56B4C]' },
                { step: '4', title: 'Database & Rules Layer', desc: 'Stores verified node packets in prototype_node_telemetry in Firestore', icon: Database, color: 'text-[#1F5A48]' },
                { step: '5', title: 'React Dashboard (BhujalSetu)', desc: 'Dashboard displays authenticated node readings, status, and history charts; community models remain separate baselines', icon: Code2, color: 'text-[#3B7C8A]' },
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

        {/* Tab 3: Backend Integration */}
        {activeTab === 'backend' && (
          <div className="mt-5 space-y-3">
            <p className="text-xs text-[#1E2A28]/80 leading-relaxed">
              The prototype integration is active in this repository. Run the backend with <code className="bg-[#EAE5DB] px-1 py-0.5 rounded font-mono text-xs">npm run server:dev</code> and the dashboard with <code className="bg-[#EAE5DB] px-1 py-0.5 rounded font-mono text-xs">npm run dev</code>. Configure <code className="bg-[#EAE5DB] px-1 py-0.5 rounded font-mono text-xs">DEVICE_API_KEY</code>, <code className="bg-[#EAE5DB] px-1 py-0.5 rounded font-mono text-xs">NODE_1_DEVICE_API_KEY</code>, and <code className="bg-[#EAE5DB] px-1 py-0.5 rounded font-mono text-xs">NODE_2_DEVICE_API_KEY</code> in local <code className="bg-[#EAE5DB] px-1 py-0.5 rounded font-mono text-xs">.env.local</code>.
            </p>
            <div className="p-3.5 rounded-lg bg-[#1E2A28] text-[#F5F1E8] text-xs space-y-2">
              <div><code className="text-[#A7D7D7]">POST /api/v1/telemetry</code> validates node-specific schema (node-1 vs node-2).</div>
              <div><code className="text-[#A7D7D7]">GET /api/v1/telemetry?villageId=...</code> returns authorized community telemetry history.</div>
              <div>Prototype records use the <code className="text-[#D9C6A4]">prototype_node_telemetry</code> Firestore collection. They do not populate groundwater depth or community water balance.</div>
              <div>Use <code className="text-[#A7D7D7]">npm run test:backend</code> for hardware-free in-memory API checks.</div>
            </div>
            <div className="p-3 rounded-lg bg-[#C56B4C]/10 border border-[#C56B4C]/30 text-xs text-[#1E2A28]/80">
              ESP32 GPIO operates at 3.3V logic. Always use a voltage divider on the 5V HC-SR04 ECHO pin, and verify flow sensor pulse logic level. Never power the pump from ESP32 pins.
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
