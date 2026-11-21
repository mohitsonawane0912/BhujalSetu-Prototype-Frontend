
# BhujalSetu — Community Groundwater Intelligence

Turning Groundwater Data into Community Action. Local PostgreSQL competition prototype with decoupled Express backend and React dashboard.

## Tabletop ESP32 Prototype

The active hardware prototype uses two ESP32-WROOM-32 nodes:
- **Node 1 (Recharge line):** YF-S201 flow sensor + HC-SR04 ultrasonic sensor measuring tabletop tank water level in cm (not groundwater depth).
- **Node 2 (Extraction line):** YF-S201 flow sensor on the pump extraction hose.
- **Manual pump:** Switched manually for demonstration. No pump control, relay automation, or claim of measuring pump status.
- **Data boundaries:** The tabletop sensors measure only the prototype's flow and tank level. They do not measure aquifer depth or establish a real village-wide groundwater balance.

## Prototype Water Credits (Implemented)

The existing Water Balance page includes a daily Water Credits ledger based on measured tabletop telemetry:

- **Daily calculation:** Node 1 recharge litres are compared with Node 2 extraction litres for a completed calendar day in Asia/Kolkata.
- **Conversion:** `floor(max(0, recharge litres - extraction litres))` — one Water Credit per whole net litre of measured surplus. A deficit earns zero credits and does not subtract previously earned credits.
- **Data quality:** Both nodes must have measured packets and at least 75% time coverage. The calculation does not interpolate across telemetry gaps longer than 60 seconds; incomplete days earn zero credits.
- **Storage:** Completed daily results are kept in an auditable PostgreSQL ledger and duplicate calculations do not award credits twice. Today's values are shown as in progress and are not awarded before the day is complete.
- **Scope:** These are prototype recognition points calculated from tabletop Node 1 and Node 2 flows. They are not a village aquifer balance, cash value, or confirmed external reward entitlement.
- **Calibration:** The current backend uses a nominal 450 pulses-per-litre factor. Calibrate the physical sensors and update the calibration configuration before relying on the volume totals as calibrated measurements.

## Local PostgreSQL Database & Backend Setup

1. **Install and start PostgreSQL:**
   ```bash
   brew install postgresql@16
   brew services start postgresql@16
   # Or start manually:
   # /opt/homebrew/opt/postgresql@16/bin/pg_ctl -D /opt/homebrew/var/postgresql@16 start
   ```

2. **Initialize Empty Competition Database:**
   ```bash
   createdb bhujalsetu_dev
   npm run db:migrate
   ```

3. **Provision the First Administrator (Optional / Single-User Local):**
   ```bash
   # Prompts privately for password (input is hidden; never logged to shell history):
   npm run admin:provision -- --email "admin@rampur.in" --name "Panchayat Admin" --villageId "village-rampur-04"
   ```

4. **Start Backend & Frontend:**
   - **Option A (Single unified command):**
     ```bash
     npm run dev:all
     ```
   - **Option B (Two separate Terminal windows):**
     ```bash
     # Terminal 1 - Express API Backend
     npm run server

     # Terminal 2 - Vite Dashboard Frontend
     npm run dev
     ```

5. **Verify System Checks:**
   ```bash
   npm run test:backend
   ```

6. **Post-Competition Export, Purge & Backup Management:**
   ```bash
   # Purge all raw sensor telemetry with confirmation (exports backup first to ./exports/)
   npm run telemetry:purge -- --all --confirm

   # The JSON backup in exports/ contains raw sensor data and remains on disk.
   # When you no longer need the backup, inspect and safely delete it via:
   npm run telemetry:clean-backups -- --list
   npm run telemetry:clean-backups -- --all --confirm
   ```

See [docs/TWO_NODE_BACKEND_SETUP.md](docs/TWO_NODE_BACKEND_SETUP.md) for wiring, flow-sensor calibration, telemetry packet details, and local PostgreSQL setup and data-management instructions.
