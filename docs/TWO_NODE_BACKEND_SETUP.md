# Two-Node Sensor Backend & Dashboard Setup Guide

This guide describes how to configure, calibrate, and run the **BhujalSetu** two-node tabletop demonstration.

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
  - **Water Credits & GEM points** have no approved value, formula, conversion, or award policy. Cash and non-cash recognition are possibilities under future discussion with local organizations and BMC/PMC; the application does not calculate or issue credits.

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

1. Open `firmware/two_node_wifi/`.
2. Copy `secrets.example.h` to `secrets.h` (this file is ignored by Git and must **never** be committed):
   ```c
   #pragma once
   #define BHUJAL_WIFI_SSID "YOUR_2_4_GHZ_WIFI_NAME"
   #define BHUJAL_WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
   #define BHUJAL_API_URL "http://192.168.1.150:5001/api/v1/telemetry"
   #define BHUJAL_DEVICE_API_KEY "YOUR_NODE_DEVICE_API_KEY"
   #define BHUJAL_VILLAGE_ID "village-rampur-04"
   ```

### Step 3: Flash Node 1 (Recharge Line)

1. Open `firmware/two_node_wifi/bhujalsetu_wifi_node.ino` in Arduino IDE.
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

When preparing firmware for Wi-Fi transmission, the Express backend validates packets strictly against [server/nodeTelemetrySchema.ts](../server/nodeTelemetrySchema.ts). Only packets with `dataSource: "measured"` are accepted in production.

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
- **Validation Rules**:
  - `waterLevel` is **required** on Node 1.
  - `waterLevel.distanceCm`: finite number between `2.0` and `400.0`.
  - `waterLevel.levelCm`: finite number between `0.0` and `400.0` (calculated as `TANK_USABLE_HEIGHT_CM - distanceCm`).
  - `flow.pulses`: non-negative integer.
  - `flow.flowLpm`: non-negative number up to 120 L/min.
  - `capturedAt`: ISO 8601 UTC timestamp string.

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
- **Validation Rules**:
  - `waterLevel` must **not** be present in Node 2 packets.
  - The pump is operated manually; there are no pump control or relay status fields.
  - `flow.totalLiters` represents Node 2 session volume and is tracked independently from Node 1.

---

## 5. Backend Configuration & Firebase Setup

The backend handles device authentication, payload validation, and persistence to Firestore.

### Local Environment Variables (.env.local)

Create `.env.local` in the project root (never commit this file):

```bash
PORT=5001
DEVICE_API_KEY=your_shared_or_fallback_32_character_key
NODE_1_DEVICE_API_KEY=unique_private_key_for_node_1
NODE_2_DEVICE_API_KEY=unique_private_key_for_node_2

# Firebase Admin Service Account Credentials (Server-side persistence)
FIREBASE_PROJECT_ID=gen-lang-client-0038143503

# Option A (Recommended): Point to downloaded service account JSON file
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json

# Option B (Alternative): Specify email and private key directly in environment
# FIREBASE_CLIENT_EMAIL=your-service-account@gen-lang-client-0038143503.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkq...your_key_here...\n-----END PRIVATE KEY-----\n"

# Optional Gemini AI Advice API Key
GEMINI_API_KEY=your_gemini_api_key
```

> **Note on Service Account Credentials:**
> Without valid Firebase Admin credentials (either `FIREBASE_SERVICE_ACCOUNT_PATH` pointing to an existing JSON key file, or `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`), the backend reports `firebase: not_configured` at `/api/health`. In production, telemetry persistence returns `HTTP 503` so unpersisted samples are never falsely claimed as stored.

To generate a Firebase Admin private key:
1. Open [Firebase Console](https://console.firebase.google.com/project/gen-lang-client-0038143503/settings/serviceaccounts/adminsdk).
2. Click **Generate new private key**.
3. **For Option A (Recommended):** Save the downloaded JSON file into your project root as `service-account.json` (this file name is already ignored by `.gitignore`). Set `FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json` in `.env.local`.
4. **For Option B (Alternative):** Open the JSON file in an editor, copy `client_email` and `private_key` into `.env.local`, preserving literal `\n` characters in the private key string.

---

## 6. Firestore Rules, Indexes & Community Membership

### Target Database & Rules Status

- **Firebase Project:** `gen-lang-client-0038143503` (configured in `.firebaserc`)
- **Target Firestore Database:** `ai-studio-b5c8fea1-15ca-479c-80da-b20daf9c036d` (configured in `firebase.json` and `firebase-applet-config.json`)
- **Deployment Status:** Firestore security rules and composite indexes have been successfully deployed. Security rules restrict access to collection `prototype_node_telemetry` and `prototype_telemetry` to users with confirmed membership in `community_memberships`.

### Provisioning Authorized Community Members

A community selector is **not** authorization. Access to live and historical node telemetry requires an active membership document in Firestore:

1. Open Firebase Console → Authentication → Users, and copy the user's `UID`.
2. Open Firestore → database `ai-studio-b5c8fea1-15ca-479c-80da-b20daf9c036d` → collection `community_memberships`.
3. Create document with ID: `{UID}_{villageId}` (e.g., `abc12345_village-rampur-04`).
4. Set fields:
   - `userId` (string): the user's UID
   - `villageId` (string): `village-rampur-04`
   - `status` (string): `active`
5. Users without this document receive `HTTP 403 Forbidden` and a clear access-denied state on the dashboard.

---

## 7. Implementation Status & Project Verification Boundary

To ensure full transparency between hardware bench testing and end-to-end cloud persistence, the project boundaries are defined as follows:

### What Is Currently Completed:
- **Local Sensor Wiring & Serial Verification:** Node 1 and Node 2 hardware wiring and basic sensor readings (pulse generation from YF-S201 flow turbines and echo distance from HC-SR04 ultrasonic sensor) have been inspected locally in the Arduino Serial Monitor.
- **Backend Schema & Ingestion Ready:** Express endpoints (`POST /api/v1/telemetry`, `GET /api/v1/telemetry`), Zod discriminated schemas, node identity matching, and Firestore collection paths (`prototype_node_telemetry`) are prepared and verified via automated test suites.
- **Dashboard Consumption Ready:** The single existing dashboard (`App.tsx`, `HomeView.tsx`, `TrendsView.tsx`) is prepared to consume measured Node 1 and Node 2 telemetry. When no records exist, it truthfully displays *"Waiting for device"* and *"Waiting for measured sensor history"*.
- **Security Rules & Indexes:** Deployed to Firebase project `gen-lang-client-0038143503`.

### What Remains to Be Done (Future Steps):
- **ESP32 Wi-Fi HTTP Transmission:** Wi-Fi packet transmission to the backend has not yet been uploaded or verified on the physical boards.
- **Backend Service Account Configuration:** Server credentials in `.env.local` must be configured for the backend to persist received packets to live Firestore.
- **Community Membership Document:** Creation of the authorized membership document in Firestore for the testing user account.
- **Physical Volume Calibration:** Flow sensor pulse calibration with a measured container (1.00 L) before presenting volume totals.
- **End-to-End Verification:** Live end-to-end data flow (Node 1/2 ESP32 → local Wi-Fi HTTP POST → Express backend validation → Firestore persistence → dashboard live update) has **not** been tested or claimed.

---

## 8. Running the Application

In two separate terminal windows from the repository root:

```bash
# Terminal 1: Start Express backend (port 5001)
npm run server:dev

# Terminal 2: Start Vite React frontend (port 3000)
npm run dev
```

### Automated Backend Tests & Linting

Verify API validation, node separation, authentication, and error paths in in-memory test mode without touching Firestore:

```bash
# Run automated backend test suite (19 checks)
npm run test:backend

# Verify TypeScript types
npm run lint

# Build client production bundle
npm run build
```

---

## 9. Troubleshooting Guide

| Issue | Likely Cause | Resolution |
|---|---|---|
| **HTTP 401 Unauthorized** from ESP32 | Device key mismatch or missing `Authorization: Bearer` header | Check `BHUJAL_DEVICE_API_KEY` in `secrets.h` matches `NODE_1_DEVICE_API_KEY` or `DEVICE_API_KEY` in `.env.local`. |
| **HTTP 403 Forbidden** on Dashboard | Signed-in user lacks active membership document | Provision `community_memberships/{UID}_{villageId}` in Firestore with `status: "active"`. |
| **HTTP 503 Storage Unavailable** | Server `.env.local` missing Firebase Admin service account key | Add `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` to `.env.local` and restart server. |
| **ESP32 Wi-Fi connect failed** | 5 GHz network or wrong credentials | ESP32-WROOM-32 supports **2.4 GHz only**. Connect to a 2.4 GHz SSID. |
| **ESP32 HTTP -1 Connection Refused** | Incorrect LAN IP or firewall block | Verify computer LAN IP (`ifconfig` / `ipconfig`). Allow port `5001` inbound in operating system firewall. |
| **Node 1 packet skipped (Water level echo)** | Ultrasonic sensor not receiving echo | Check TRIG (GPIO 5), ECHO divider (GPIO 34), 5V power, and ensure tank surface is within 2–400 cm. |
| **Zero pulses / flow rate shows 0.00** | Flow sensor wiring or flow arrow reversed | Confirm water flows in direction of housing arrow. Check sensor signal wiring and common ground. |
| **Dashboard stuck on loading** | Handled: page initialization is decoupled | Initial page loads even when signed out. Signed-out status is shown on telemetry cards. |
