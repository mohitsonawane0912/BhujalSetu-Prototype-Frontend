
# BhujalSetu — Community Groundwater Intelligence

Turning Groundwater Data into Community Action. Local PostgreSQL competition prototype with decoupled Express backend and React dashboard.

## Tabletop ESP32 Prototype

The active hardware prototype uses two ESP32-WROOM-32 nodes:
- **Node 1 (Recharge line):** YF-S201 flow sensor + HC-SR04 ultrasonic sensor measuring tabletop tank water level in cm (not groundwater depth).
- **Node 2 (Extraction line):** YF-S201 flow sensor on the pump extraction hose.
- **Manual pump:** Switched manually for demonstration. No pump control, relay automation, or claim of measuring pump status.
- **Data boundaries:** Tabletop flow and tank level only; not aquifer depth, water balance, or credit awards.
- **GEMs & Water Credits:** Proposed conceptual feature for future development; no points or tokens are calculated, awarded, or stored.

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

See [docs/TWO_NODE_BACKEND_SETUP.md](docs/TWO_NODE_BACKEND_SETUP.md) for detailed wiring, sensor calibration, packet specs, and the manual development Firestore cleanup guide.
