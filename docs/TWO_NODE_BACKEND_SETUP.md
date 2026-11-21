# Two-Node Sensor Backend & Dashboard Setup Guide (PostgreSQL Competition Edition)

This guide describes how to configure, calibrate, and run the **BhujalSetu** two-node tabletop demonstration using local PostgreSQL and Express.

---

## 1. Prototype Overview & Wiring Plan

The tabletop demonstration uses two ESP32-WROOM-32 microcontrollers communicating over local 2.4 GHz Wi-Fi to the local backend:

- **Node 1 — Recharge Line:**
  - One **YF-S201** turbine flow sensor measuring inflow on the tabletop recharge loop.
  - One **HC-SR04** ultrasonic ranging module aimed at the tabletop water tank.
  - Reports **tabletop tank water level in centimetres**. This is **not** groundwater depth.
- **Node 2 — Extraction Line:**
  - One **YF-S201** turbine flow sensor on the pump extraction hose.
  - Measures extraction flow rate and volume total only.
- **Pump Operation & Actuator Policy:**
  - The pump is turned on and off **manually** for demonstration.
  - Do **not** add pump control, relay automation, or claim that the ESP32 measures pump status.
  - **Never** power a pump from an ESP32 GPIO pin or 3.3V rail. Always use an isolated, separate DC power supply with a physical manual switch.
- **Hydrological & Policy Boundary:**
  - The sensors measure tabletop flow and tank level only. Do **not** present these readings as a community aquifer measurement or use them to claim a scientifically measured recharge/groundwater balance.
  - **Water Credits & GEM points** are solely a proposed incentive idea to explain to judges for future exploration. The application does not calculate, award, track balances for, or redeem credits or tokens.

---

## 2. Safe Electrical Wiring & 3.3 V Logic Levels

ESP32 GPIO operates strictly at **3.3 V logic**. Connecting 5 V directly to an ESP32 input will damage the microcontroller.

### Node 1 Wiring (Recharge Line + Ultrasonic)

| Component | Component Pin | ESP32 Connection / Power | Logic Safety Note |
|---|---|---|---|
| **HC-SR04** | VCC | External 5 V DC supply | Must share common GND with ESP32 |
| **HC-SR04** | GND | Common GND | |
| **HC-SR04** | TRIG | ESP32 GPIO 5 | GPIO 5 outputs 3.3 V, which reliably triggers HC-SR04 |
| **HC-SR04** | ECHO | **Voltage divider** to GPIO 34 | **CRITICAL: ECHO outputs 5 V.** Use a divider: ECHO → 1 kΩ → GPIO 34; GPIO 34 → 2 kΩ → GND. (Drops 5 V to ~3.3 V). GPIO 34 is input-only. |
| **YF-S201** | Red (VCC) | 5 V DC supply | |
| **YF-S201** | Black (GND) | Common GND | |
| **YF-S201** | Yellow (Signal) | ESP32 GPIO 27 | Confirm sensor output does not swing to 5 V. If sensor uses internal 5 V pull-up, use a level shifter or divider before GPIO 27. |

### Node 2 Wiring (Extraction Line)

| Component | Component Pin | ESP32 Connection / Power | Logic Safety Note |
|---|---|---|---|
| **YF-S201** | Red (VCC) | 5 V DC supply | Must share common GND with ESP32 |
| **YF-S201** | Black (GND) | Common GND | |
| **YF-S201** | Yellow (Signal) | ESP32 GPIO 27 | Input interrupt pin for extraction flow turbine pulses |

---

## 3. Sensor Calibration Procedures

### A. Tabletop Tank Water Level Calibration (Node 1)

1. Measure the inside usable height of the tabletop tank from the face of the HC-SR04 sensor transducers to the bottom of the tank using a ruler (in cm).
2. Set `TANK_USABLE_HEIGHT_CM` in `firmware/two_node_wifi/bhujalsetu_wifi_node.ino` to this measured value (e.g. `30.0f`).
3. Ensure the sensor face is parallel to the water surface, unobstructed by tank edges, and placed at least 3–4 cm above the maximum fill line (to respect the HC-SR04 minimum blind zone of 2 cm).
4. Verify distance readings at empty (level ~0 cm), half-full, and near-full against a physical ruler. If a constant physical offset exists, adjust the sensor mounting height.
5. The ultrasonic sensor reports **tank water level in cm** (`TANK_USABLE_HEIGHT_CM - distanceCm`). This is tabletop tank storage, **not** deep aquifer depth.

### B. Flow Sensor Calibration (Node 1 & Node 2)

Turbine flow sensor pulse factors vary with water pressure, hose diameter, and orientation:

1. Mount each YF-S201 in its final hose orientation observing the water flow direction arrow on the plastic housing.
2. In the sketch, `FLOW_PULSES_PER_LITER` defaults to `450.0f`.
3. Fill a container with a known, measured volume of water (for example, exactly 1.00 Litre in a calibrated beaker or measuring jug).
4. Pass the water through the sensor at typical flow rate while watching the serial monitor's pulse count (`windowPulses` / `totalPulses`).
5. Calculate the exact calibration factor:
   $$\text{FLOW\_PULSES\_PER\_LITER} = \frac{\text{Total Pulses Recorded}}{\text{Known Volume in Litres}}$$
6. Update `FLOW_PULSES_PER_LITER` in `firmware/two_node_wifi/bhujalsetu_wifi_node.ino`.
7. Repeat with a second known volume (e.g. 2.00 Litres) to confirm linearity. Recalibrate whenever hose fittings, tubing length, or pump head pressure changes.

---

## 4. Local LAN & Firmware Configuration

The backend and ESP32 nodes communicate over your local Wi-Fi network.

### Step 1: Find Computer's Local LAN IPv4 Address

- **macOS / Linux:** Run `ifconfig` or `ip route`, or run `ipconfig getifaddr en0` (or `wlan0`).
  Example: `192.168.1.150`
- **Windows:** Run `ipconfig` in Command Prompt and note the IPv4 Address of your Wi-Fi adapter.
- Ensure your computer firewall allows incoming connections on port `5001`.

### Step 2: Configure Firmware Secrets

1. Open `firmware/two_node_wifi/bhujalsetu_wifi_node/`.
2. Ensure `secrets.h` is present (this file is ignored by Git and must **never** be committed):
   ```c
   #pragma once
   #define BHUJAL_WIFI_SSID "YOUR_2_4_GHZ_WIFI_NAME"
   #define BHUJAL_WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
   #define BHUJAL_API_URL "http://192.168.1.150:5001/api/v1/telemetry"
   #define BHUJAL_DEVICE_API_KEY "YOUR_NODE_DEVICE_API_KEY"
   #define BHUJAL_VILLAGE_ID "village-rampur-04"
   ```

### Step 3: Flash Node 1 (Recharge Line)

1. Open `firmware/two_node_wifi/bhujalsetu_wifi_node/bhujalsetu_wifi_node.ino` in Arduino IDE.
2. Confirm the top lines are configured for Node 1:
   ```c
   #define NODE_ID "node-1"
   #define DEVICE_ID "ESP32-NODE-1"
   #define HAS_WATER_LEVEL 1
   ```
3. Connect the Node 1 ESP32 via USB and upload.
4. Open Serial Monitor at 115200 baud. Confirm Wi-Fi connection, NTP time acquisition, and `HTTP=201` responses.

### Step 4: Flash Node 2 (Extraction Line)

1. Change the top configuration lines in the sketch:
   ```c
   #define NODE_ID "node-2"
   #define DEVICE_ID "ESP32-NODE-2"
   #define HAS_WATER_LEVEL 0
   ```
2. If using separate device keys, update `BHUJAL_DEVICE_API_KEY` in `secrets.h` with the Node 2 key.
3. Connect the Node 2 ESP32 via USB and upload.
4. Open Serial Monitor at 115200 baud. Confirm Wi-Fi connection and `HTTP=201` responses.

---

## 4.5. Expected Node Packet Specification (POST /api/v1/telemetry)

The Express backend validates packets strictly against `server/nodeTelemetrySchema.ts`. Only packets with `dataSource: "measured"` are accepted.

### A. Node 1 Packet (Recharge Flow + Tabletop Tank Level)

- **Node ID**: `"node-1"`
- **Endpoint**: `POST /api/v1/telemetry`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <NODE_1_DEVICE_API_KEY>` (or shared `<DEVICE_API_KEY>`)
- **JSON Payload Format**:
  ```json
  {
    "schemaVersion": 1,
    "deviceId": "ESP32-NODE-1",
    "nodeId": "node-1",
    "villageId": "village-rampur-04",
    "dataSource": "measured",
    "capturedAt": "2026-11-15T12:00:00Z",
    "flow": {
      "pulses": 24,
      "frequencyHz": 4.8,
      "flowLpm": 3.2,
      "totalLiters": 12.5
    },
    "waterLevel": {
      "distanceCm": 14.5,
      "levelCm": 15.5
    }
  }
  ```

### B. Node 2 Packet (Pump Extraction Flow Only)

- **Node ID**: `"node-2"`
- **Endpoint**: `POST /api/v1/telemetry`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <NODE_2_DEVICE_API_KEY>` (or shared `<DEVICE_API_KEY>`)
- **JSON Payload Format**:
  ```json
  {
    "schemaVersion": 1,
    "deviceId": "ESP32-NODE-2",
    "nodeId": "node-2",
    "villageId": "village-rampur-04",
    "dataSource": "measured",
    "capturedAt": "2026-11-15T12:00:00Z",
    "flow": {
      "pulses": 18,
      "frequencyHz": 3.6,
      "flowLpm": 2.4,
      "totalLiters": 8.2
    }
  }
  ```

---

## 5. Local PostgreSQL Database Configuration

The competition backend stores sensor packets and community records in a local PostgreSQL database through Express.

### Starting PostgreSQL:
```bash
# Start background service
brew services start postgresql@16

# Or manual start:
/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D /opt/homebrew/var/postgresql@16 start
```

### Initializing Database & Migrations:
```bash
createdb bhujalsetu_dev
npm run db:migrate
```

### Starting Backend & Frontend:

You can start the full development environment either using the unified runner or using two separate Terminal windows:

**Option A (Unified runner):**
```bash
npm run dev:all
```

**Option B (Two separate Terminal windows - Recommended for clear per-service logs):**
```bash
# Terminal 1 - Express API Backend (port 5001 or configured PORT)
npm run server

# Terminal 2 - Vite Dashboard Frontend (port 3000)
npm run dev
```

### Configuration Environment Variables (.env.local):
```bash
PORT=5001
JWT_SECRET=your_minimum_32_character_random_secret_here
DEVICE_API_KEY=your_shared_or_fallback_32_character_key
NODE_1_DEVICE_API_KEY=unique_private_key_for_node_1
NODE_2_DEVICE_API_KEY=unique_private_key_for_node_2

# PostgreSQL Settings
PGHOST=localhost
PGPORT=5432
PGDATABASE=bhujalsetu_dev
PGUSER=mohitsonawane
PGPASSWORD=

# Optional Gemini Advisor API Key
GEMINI_API_KEY=your_gemini_api_key
```

---

## 6. Extraction Anomaly Detector & Freshness Architecture

### A. Anomaly Detector Parameters & Alert Lifecycle
- **Baseline Requirement:** At least **10 active pumping samples** ($\ge 0.2$ L/min) of measured Node 2 telemetry must be recorded before an operating baseline is established. While under 10 samples, the baseline status is reported as `building_baseline`.
- **Robust Statistical Baseline:** Computes a **10% symmetric trimmed mean** of active historical samples to discard pump startup/shutdown turbulence.
- **Anomaly Trigger Criteria:** Triggers when current extraction flow $> 0.2$ L/min, flow ratio $\ge 1.8\times$ baseline, and flow delta $\ge 2.0$ L/min.
- **Alert Recovery & Clearing:** An alert requires **two distinct consecutive normal packets** (flow $\le 1.3\times$ baseline or $< 0.2$ L/min from distinct timestamps) to clear.
- **Recovery Visibility:** When the flow returns to normal after a surge, the backend maintains the alert in `status: ACTIVE` after the first normal reading. The frontend dashboard and alert API keep the warning visible until the second distinct normal packet arrives, at which point the alert transitions to `status: CLEARED`.
- **Security & Authorization:** `/api/alerts`, `/api/telemetry/extraction-anomaly`, and `/api/ai/advice` strictly require authenticated active community membership. Community ID is derived server-side from verified user credentials; query parameters attempting to select other communities are rejected with HTTP 403.

### B. Reliable Server Freshness Clock
- **Freshness Source:** Sensor packet staleness is evaluated strictly against the server-side arrival timestamp (`receivedAt`), with fallback to `capturedAt` only if `receivedAt` is absent. This protects against unsynchronized ESP32 internal clocks or RTC drift.
- **Stale Threshold:** Unified at **45 seconds** (`45_000` ms) across the AI Advisor, anomaly detector, and dashboard. Telemetry older than 45s is marked as offline/stale and triggers `WAITING_FOR_DATA`.

### C. Community Geographic Coordinates
- Community coordinates (latitude -90 to 90, longitude -180 to 180) are optionally configured during community registration in the welcome flow.
- If coordinates are absent or invalid, the external weather module returns an honest `unconfigured` status; no synthetic forecasts are generated.

---

## 7. Local Authentication & Administrator Provisioning

1. Registration and sign-in are managed locally via `/api/auth/register` and `/api/auth/login`.
2. Public registration creates a resident account with `status: 'pending'` to prevent arbitrary village access.
3. Telemetry read endpoints require an active community membership token (`Authorization: Bearer <token>`).
4. **Provisioning the First Administrator:**
   Run the CLI provisioning tool without passing a password on the command line. You will be prompted securely and privately in the console (password input is masked and will not appear in shell history or process listings):
   ```bash
   npm run admin:provision -- --email "admin@rampur.in" --name "Panchayat Admin" --villageId "village-rampur-04"
   ```
5. **Approving a Registered Resident:**
   ```bash
   npm run admin:provision -- --email "resident@rampur.in" --villageId "village-rampur-04" --activate
   ```
6. No public bypasses or dummy demo accounts exist; all accounts are hashed and verified with scrypt and JWT.

---

## 7. Export, Purge, and Backup Lifecycle for Raw Telemetry

After the competition, raw sensor records can be exported and purged without touching user accounts, actions, pledges, or code:

```bash
# Preview records to purge (dry run)
npm run telemetry:purge -- --all --dry-run

# Purge all raw sensor telemetry with confirmation (exports backup first to ./exports/)
npm run telemetry:purge -- --all --confirm

# Or purge telemetry older than a specific date cutoff
npm run telemetry:purge -- --cutoff "2026-11-20T00:00:00Z" --confirm
```

### Safe Management and Deletion of Telemetry Backups:
> **Important:** The JSON backup exported by `telemetry:purge` contains raw measured sensor packets. It remains safely on local disk in `exports/` until you explicitly decide you no longer need it. It is **never** silently deleted.

When you decide the backup file is no longer needed, you can delete it safely using the dedicated cleaner tool:
```bash
# 1. List all existing backup files on disk:
npm run telemetry:clean-backups -- --list

# 2. Preview deletion without removing:
npm run telemetry:clean-backups -- --all --dry-run

# 3. Delete a specific backup file:
npm run telemetry:clean-backups -- --file telemetry_export_2026-11-20T...json --confirm

# 4. Delete all backup files in exports/:
npm run telemetry:clean-backups -- --all --confirm

# Manual terminal alternative:
ls -la exports/
rm exports/telemetry_export_*.json
```

---

## 8. Development Firestore Cleanup Guide (Manual Reference)

> **Status Notice:** The previous programmatic Firestore cleanup attempt encountered `8 RESOURCE_EXHAUSTED: Quota limit exceeded` on consumer Google Cloud project `739886188219`. **Zero documents were deleted.** Billing was not enabled to bypass this quota. Old Firestore records were **not** migrated into PostgreSQL; the local PostgreSQL database starts completely empty.

If you wish to manually clear application records from the cloud development database (`ai-studio-b5c8fea1-15ca-479c-80da-b20daf9c036d`):

1. Open [Google Cloud Console / Firebase Console](https://console.firebase.google.com/) for project `ai-studio-b5c8fea1-15ca-479c-80da-b20daf9c036d`.
2. Go to **Firestore Database** > **Data**.
3. **Inventory of Application Collections to Clear:**
   - `prototype_node_telemetry` (Node 1 and Node 2 raw packets)
   - `prototype_telemetry` (legacy single-node telemetry)
   - `community_actions` (water conservation activities)
   - `water_pledges` (household water pledges)
   - `field_observations` (resident field notes)
   - `community_memberships` (village residency documents)
   - `users` (user profile records)
   - `community_gem_balances` (legacy concept testing balance records)
   - `gem_accruals` (legacy concept testing audit ledger records)
4. **Safety Boundaries:**
   - Delete application documents only inside the collections listed above.
   - **Do NOT** delete Firebase Authentication users.
   - **Do NOT** delete Security Rules (`firestore.rules`).
   - **Do NOT** delete Indexes (`firestore.indexes.json`).
   - **Do NOT** delete service account credentials or the Firebase project itself.
   - **Do NOT** enable billing to bypass free-tier quotas.

---

## 8. Remaining ESP32 Physical Verification Steps

Before running the live physical demonstration:
1. **Upload Firmware to Node 1**: Upload `bhujalsetu_wifi_node.ino` configured with `NODE_ID = "node-1"` and `HAS_WATER_LEVEL = 1`. Verify serial output connects to Wi-Fi.
2. **Upload Firmware to Node 2**: Upload `bhujalsetu_wifi_node.ino` configured with `NODE_ID = "node-2"` and `HAS_WATER_LEVEL = 0`. Verify serial output connects to Wi-Fi.
3. **Calibrate YF-S201 Flow Pulses**: Run 1.00 L of water through each sensor and adjust `FLOW_PULSES_PER_LITER` in firmware.
4. **Calibrate HC-SR04 Tank Usable Height**: Measure inside tank depth and set `TANK_USABLE_HEIGHT_CM`.
5. **Verify Live POST Reception**: Verify `HTTP 201` received on physical serial monitors when transmitting packets to the Express backend.
