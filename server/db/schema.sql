-- ==============================================================================
-- BhujalSetu Competition Schema for Local PostgreSQL
-- Turning Groundwater Data into Community Action
--
-- Notes:
-- 1. All tables start EMPTY until live ESP32 telemetry or authenticated users arrive.
-- 2. GEMs and Water Credits are a proposed concept only: no GEM tables or ledgers.
-- 3. Measured Node 1 and Node 2 packets are stored in prototype_node_telemetry.
-- ==============================================================================

-- 0. Communities Table (Prototype single-community registration)
CREATE TABLE IF NOT EXISTS communities (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  district VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  latitude NUMERIC(9, 6) NULL,
  longitude NUMERIC(9, 6) NULL,
  registered_by VARCHAR(128) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe migrations for coordinates
ALTER TABLE communities ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6) NULL;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6) NULL;

-- 1. Users Table (Local secure authentication)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  email VARCHAR(256) UNIQUE NOT NULL,
  password_hash VARCHAR(256) NOT NULL,
  password_salt VARCHAR(128) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'resident',
  community_id VARCHAR(64) NOT NULL DEFAULT 'village-rampur-04',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Community Memberships Table (Verification for telemetry & action access)
CREATE TABLE IF NOT EXISTS community_memberships (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  village_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  role VARCHAR(32) NOT NULL DEFAULT 'resident',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_village UNIQUE (user_id, village_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_village ON community_memberships(user_id, village_id);
CREATE INDEX IF NOT EXISTS idx_memberships_village ON community_memberships(village_id);

-- 3. Prototype Node Telemetry Table (Measured packets from ESP32 Node 1 and Node 2)
CREATE TABLE IF NOT EXISTS prototype_node_telemetry (
  id VARCHAR(128) PRIMARY KEY,
  node_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  village_id VARCHAR(64) NOT NULL,
  data_source VARCHAR(32) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  flow_pulses INTEGER NOT NULL,
  flow_frequency_hz NUMERIC(10, 2) NOT NULL,
  flow_lpm NUMERIC(10, 2) NOT NULL,
  flow_total_liters NUMERIC(10, 3) NOT NULL,
  water_distance_cm NUMERIC(10, 2) NULL,
  water_level_cm NUMERIC(10, 2) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_telemetry_village_time ON prototype_node_telemetry(village_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_node_telemetry_node_time ON prototype_node_telemetry(node_id, captured_at DESC);

-- 3a. One stable daily advisor decision per community; refreshed at most every 24 hours.
CREATE TABLE IF NOT EXISTS community_advisor_snapshots (
  community_id VARCHAR(64) PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  response JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_advisor_snapshots_expiry ON community_advisor_snapshots(expires_at);


-- 4. Community Actions Table
CREATE TABLE IF NOT EXISTS community_actions (
  id VARCHAR(128) PRIMARY KEY,
  community_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  user_email VARCHAR(256) NULL,
  action_type VARCHAR(64) NOT NULL,
  title VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  ward VARCHAR(100) NOT NULL,
  impact_liters NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_actions_village ON community_actions(community_id, created_at DESC);

-- 5. Water Pledges Table
CREATE TABLE IF NOT EXISTS water_pledges (
  id VARCHAR(128) PRIMARY KEY,
  community_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  pledge_type VARCHAR(64) NOT NULL,
  target_liters_per_day NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_water_pledges_village ON water_pledges(community_id, created_at DESC);

-- 6. Field Observations Table
CREATE TABLE IF NOT EXISTS field_observations (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  observation_type VARCHAR(64) NOT NULL,
  location VARCHAR(150) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  notes VARCHAR(500) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_observations_user ON field_observations(user_id, created_at DESC);

-- 7. Community Water Credits Ledger (Idempotent auditable daily water credits)
CREATE TABLE IF NOT EXISTS community_water_credits_ledger (
  id VARCHAR(128) PRIMARY KEY,
  community_id VARCHAR(64) NOT NULL,
  period_type VARCHAR(32) NOT NULL DEFAULT 'daily',
  period_date DATE NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  recharge_liters NUMERIC(12, 3) NOT NULL DEFAULT 0,
  extraction_liters NUMERIC(12, 3) NOT NULL DEFAULT 0,
  net_surplus_liters NUMERIC(12, 3) NOT NULL DEFAULT 0,
  net_deficit_liters NUMERIC(12, 3) NOT NULL DEFAULT 0,
  surplus_percentage NUMERIC(8, 2) NULL,
  credits_earned INTEGER NOT NULL DEFAULT 0,
  data_coverage_status VARCHAR(32) NOT NULL,
  coverage_percentage_node1 NUMERIC(5, 2) NOT NULL DEFAULT 0,
  coverage_percentage_node2 NUMERIC(5, 2) NOT NULL DEFAULT 0,
  node1_sample_count INTEGER NOT NULL DEFAULT 0,
  node2_sample_count INTEGER NOT NULL DEFAULT 0,
  gap_count_node1 INTEGER NOT NULL DEFAULT 0,
  gap_count_node2 INTEGER NOT NULL DEFAULT 0,
  formula_version VARCHAR(32) NOT NULL DEFAULT 'v1.0-tabletop-net-litres',
  conversion_rate NUMERIC(8, 4) NOT NULL DEFAULT 1.0,
  disclaimer TEXT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_community_period UNIQUE (community_id, period_type, period_date)
);

CREATE INDEX IF NOT EXISTS idx_water_credits_community_date ON community_water_credits_ledger(community_id, period_date DESC);
