import crypto from 'crypto';
import { query } from './db/postgres';
import { config } from './config';
import { NodeTelemetryRepository } from './nodeTelemetryRepository';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  role: string;
  communityId: string;
  createdAt: string;
}

export interface CommunityRecord {
  id: string;
  name: string;
  district?: string;
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  registeredBy?: string;
  createdAt: string;
}

export interface NodeStatusInfo {
  nodeId: 'node-1' | 'node-2';
  name: string;
  description: string;
  verified: boolean;
  lastSeen: string | null;
  flowLpm: number | null;
  waterLevelCm?: number | null;
}

export interface SetupStatusResponse {
  communityRegistered: boolean;
  community: CommunityRecord | null;
  userCount: number;
  node1: NodeStatusInfo;
  node2: NodeStatusInfo;
  bothNodesVerified: boolean;
  membershipStatus: 'active' | 'pending' | 'none';
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  communityId: string;
  exp: number;
}

// In-memory test store when running tests in isolated environments
const testUsers = new Map<string, { user: UserRecord; passwordHash: string; salt: string }>();
const testMemberships = new Map<string, { id: string; userId: string; villageId: string; status: string; role: string }>();
const testCommunities = new Map<string, CommunityRecord>();

export const AuthService = {
  clearTestData() {
    testUsers.clear();
    testMemberships.clear();
    testCommunities.clear();
  },

  setTestCommunity(community: CommunityRecord) {
    testCommunities.set(community.id, community);
  },

  hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  },

  generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  },

  createToken(user: UserRecord): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      communityId: user.communityId,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    const headerBase64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', config.jwtSecret)
      .update(`${headerBase64}.${payloadBase64}`)
      .digest('base64url');

    return `${headerBase64}.${payloadBase64}.${signature}`;
  },

  verifyToken(token: string): AuthTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [headerB64, payloadB64, signature] = parts;

      const expectedSig = crypto
        .createHmac('sha256', config.jwtSecret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as AuthTokenPayload;
      if (payload.exp && payload.exp < Date.now()) {
        return null; // Expired
      }
      return payload;
    } catch {
      return null;
    }
  },

  /**
   * Get the single registered prototype community.
   * Returns null if no community has been registered yet.
   */
  async getPrototypeCommunity(): Promise<CommunityRecord | null> {
    if (process.env.NODE_ENV === 'test') {
      const first = Array.from(testCommunities.values())[0];
      return first || null;
    }

    try {
      const res = await query(
        'SELECT id, name, district, state, latitude, longitude, registered_by, created_at FROM communities ORDER BY created_at ASC LIMIT 1'
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        name: row.name,
        district: row.district || undefined,
        state: row.state || undefined,
        latitude: row.latitude != null ? Number(row.latitude) : null,
        longitude: row.longitude != null ? Number(row.longitude) : null,
        registeredBy: row.registered_by || undefined,
        createdAt: new Date(row.created_at).toISOString(),
      };
    } catch {
      return null;
    }
  },

  async getCommunityById(id: string): Promise<CommunityRecord | null> {
    if (process.env.NODE_ENV === 'test') {
      return testCommunities.get(id) || null;
    }

    try {
      const res = await query(
        'SELECT id, name, district, state, latitude, longitude, registered_by, created_at FROM communities WHERE id = $1',
        [id]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        name: row.name,
        district: row.district || undefined,
        state: row.state || undefined,
        latitude: row.latitude != null ? Number(row.latitude) : null,
        longitude: row.longitude != null ? Number(row.longitude) : null,
        registeredBy: row.registered_by || undefined,
        createdAt: new Date(row.created_at).toISOString(),
      };
    } catch {
      return null;
    }
  },

  /**
   * Securely updates geographic coordinates for an existing community.
   * Requires both coordinates together (-90..90 and -180..180), or both null to clear.
   */
  async updateCommunityLocation(
    communityId: string,
    latitude: number | null,
    longitude: number | null
  ): Promise<CommunityRecord> {
    if ((latitude === null) !== (longitude === null)) {
      throw new Error('Both latitude and longitude must be provided together, or both set to null.');
    }
    if (latitude !== null && longitude !== null) {
      if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
        throw new Error('Latitude must be a valid number between -90 and 90 degrees.');
      }
      if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
        throw new Error('Longitude must be a valid number between -180 and 180 degrees.');
      }
    }

    if (process.env.NODE_ENV === 'test') {
      const comm = testCommunities.get(communityId) || Array.from(testCommunities.values()).find((c) => c.id === communityId);
      if (!comm) throw new Error(`Community ${communityId} not found.`);
      comm.latitude = latitude;
      comm.longitude = longitude;
      return comm;
    }

    const res = await query(
      `UPDATE communities SET latitude = $1, longitude = $2 WHERE id = $3
       RETURNING id, name, district, state, latitude, longitude, registered_by, created_at`,
      [latitude, longitude, communityId]
    );
    if (res.rows.length === 0) throw new Error(`Community ${communityId} not found.`);
    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      district: row.district || undefined,
      state: row.state || undefined,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      registeredBy: row.registered_by || undefined,
      createdAt: new Date(row.created_at).toISOString(),
    };
  },

  /**
   * Securely updates the community name for an existing community.
   * Requires name between 2 and 128 characters.
   */
  async updateCommunityName(
    communityId: string,
    name: string
  ): Promise<CommunityRecord> {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed || trimmed.length < 2 || trimmed.length > 128) {
      throw new Error('Community name must be between 2 and 128 characters.');
    }

    if (process.env.NODE_ENV === 'test') {
      const comm = testCommunities.get(communityId) || Array.from(testCommunities.values()).find((c) => c.id === communityId);
      if (!comm) throw new Error(`Community ${communityId} not found.`);
      comm.name = trimmed;
      return comm;
    }

    const res = await query(
      `UPDATE communities SET name = $1 WHERE id = $2
       RETURNING id, name, district, state, latitude, longitude, registered_by, created_at`,
      [trimmed, communityId]
    );
    if (res.rows.length === 0) throw new Error(`Community ${communityId} not found.`);
    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      district: row.district || undefined,
      state: row.state || undefined,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      registeredBy: row.registered_by || undefined,
      createdAt: new Date(row.created_at).toISOString(),
    };
  },

  /**
   * Register the single prototype community and its primary administrator account.
   * Enforces boundary: Only ONE community is supported in this prototype.
   */
  async registerPrototypeCommunityAndUser(params: {
    communityName: string;
    villageId?: string;
    district?: string;
    state?: string;
    latitude?: number | null;
    longitude?: number | null;
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ user: UserRecord; token: string; membershipStatus: 'pending'; community: CommunityRecord }> {
    const communityName = (params.communityName || '').trim();
    const villageId = (params.villageId || 'village-rampur-04').trim();
    const district = (params.district || 'Pune').trim();
    const state = (params.state || 'Maharashtra').trim();
    const email = params.email.trim().toLowerCase();
    const displayName = params.displayName.trim();
    const role = 'admin'; // Creator of the prototype community is primary admin
    const nowIso = new Date().toISOString();

    let latitude: number | null = null;
    if (params.latitude != null && !isNaN(Number(params.latitude))) {
      const latNum = Number(params.latitude);
      if (latNum >= -90 && latNum <= 90) latitude = latNum;
    }

    let longitude: number | null = null;
    if (params.longitude != null && !isNaN(Number(params.longitude))) {
      const lonNum = Number(params.longitude);
      if (lonNum >= -180 && lonNum <= 180) longitude = lonNum;
    }

    if (!communityName) throw new Error('Community name is required.');
    if (!email || !email.includes('@')) throw new Error('Valid email is required.');
    if (!params.password || params.password.length < 6) throw new Error('Password must be at least 6 characters.');
    if (!displayName) throw new Error('Full name is required.');

    // Check prototype single-community boundary
    const existingCommunity = await this.getPrototypeCommunity();
    if (existingCommunity && existingCommunity.id !== villageId) {
      throw new Error(
        `A prototype community is already registered ("${existingCommunity.name}"). For this prototype, only one community is supported. Please sign in or register as a resident of ${existingCommunity.name}.`
      );
    }

    const salt = this.generateSalt();
    const passwordHash = this.hashPassword(params.password, salt);
    const userId = `usr_${crypto.randomUUID()}`;
    const membershipId = `${userId}_${villageId}`;

    const user: UserRecord = {
      id: userId,
      email,
      displayName,
      role,
      communityId: villageId,
      createdAt: nowIso,
    };

    let community: CommunityRecord;
    if (existingCommunity) {
      // If community already exists, update coordinates if supplied
      if (latitude !== undefined && longitude !== undefined) {
        existingCommunity.latitude = latitude;
        existingCommunity.longitude = longitude;
        if (district) existingCommunity.district = district;
        if (state) existingCommunity.state = state;
        if (communityName) existingCommunity.name = communityName;
      }
      community = existingCommunity;
    } else {
      community = {
        id: villageId,
        name: communityName,
        district,
        state,
        latitude,
        longitude,
        registeredBy: userId,
        createdAt: nowIso,
      };
    }

    if (process.env.NODE_ENV === 'test') {
      if (Array.from(testUsers.values()).some((u) => u.user.email === email)) {
        throw new Error('Email is already registered.');
      }
      if (!existingCommunity) {
        testCommunities.set(villageId, community);
      } else {
        testCommunities.set(villageId, existingCommunity);
      }
      testUsers.set(userId, { user, passwordHash, salt });
      testMemberships.set(membershipId, {
        id: membershipId,
        userId,
        villageId,
        status: 'pending',
        role,
      });
      const token = this.createToken(user);
      return { user, token, membershipStatus: 'pending', community };
    }

    // Check duplicate user email
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw new Error('Email is already registered. Please sign in instead.');
    }

    // Insert community if not existing, or update coordinates if already existing
    if (!existingCommunity) {
      await query(
        `INSERT INTO communities (id, name, district, state, latitude, longitude, registered_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [community.id, community.name, community.district, community.state, community.latitude, community.longitude, community.registeredBy, community.createdAt]
      );
    } else if (latitude !== undefined && longitude !== undefined) {
      await query(
        `UPDATE communities SET latitude = $1, longitude = $2 WHERE id = $3`,
        [latitude, longitude, existingCommunity.id]
      );
    }

    // Insert user
    await query(
      `INSERT INTO users (id, email, password_hash, password_salt, display_name, role, community_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, email, passwordHash, salt, displayName, role, villageId, nowIso]
    );

    // Insert membership in 'pending' status - activates only after Node 1 and Node 2 check in
    await query(
      `INSERT INTO community_memberships (id, user_id, village_id, status, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, $5)
       ON CONFLICT (user_id, village_id) DO NOTHING`,
      [membershipId, userId, villageId, role, nowIso]
    );

    const token = this.createToken(user);
    return { user, token, membershipStatus: 'pending', community };
  },

  /**
   * User Self-Registration:
   * Creates a resident account with 'pending' membership status.
   * Membership activates only after Node 1 and Node 2 hardware packets are verified.
   */
  async registerUser(params: {
    email: string;
    password: string;
    displayName: string;
    villageId?: string;
  }): Promise<{ user: UserRecord; token: string; membershipStatus: 'pending' }> {
    const email = params.email.trim().toLowerCase();
    const displayName = params.displayName.trim();
    const role = 'resident'; // Public self-registration is strictly resident role

    if (!email || !email.includes('@')) throw new Error('Valid email is required.');
    if (!params.password || params.password.length < 6) throw new Error('Password must be at least 6 characters.');
    if (!displayName) throw new Error('Full name is required.');

    // Attach to single registered prototype community if one exists
    const community = await this.getPrototypeCommunity();
    const villageId = community?.id || params.villageId || 'village-rampur-04';

    const salt = this.generateSalt();
    const passwordHash = this.hashPassword(params.password, salt);
    const userId = `usr_${crypto.randomUUID()}`;
    const membershipId = `${userId}_${villageId}`;
    const nowIso = new Date().toISOString();

    const user: UserRecord = {
      id: userId,
      email,
      displayName,
      role,
      communityId: villageId,
      createdAt: nowIso,
    };

    if (process.env.NODE_ENV === 'test') {
      if (Array.from(testUsers.values()).some((u) => u.user.email === email)) {
        throw new Error('Email is already registered.');
      }
      testUsers.set(userId, { user, passwordHash, salt });
      testMemberships.set(membershipId, {
        id: membershipId,
        userId,
        villageId,
        status: 'pending',
        role,
      });
      const token = this.createToken(user);
      return { user, token, membershipStatus: 'pending' };
    }

    // Check duplicate email
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new Error('Email is already registered. Please sign in instead.');
    }

    // Insert user
    await query(
      `INSERT INTO users (id, email, password_hash, password_salt, display_name, role, community_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, email, passwordHash, salt, displayName, role, villageId, nowIso]
    );

    // Insert membership in 'pending' status
    await query(
      `INSERT INTO community_memberships (id, user_id, village_id, status, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, $5)
       ON CONFLICT (user_id, village_id) DO NOTHING`,
      [membershipId, userId, villageId, role, nowIso]
    );

    const token = this.createToken(user);
    return { user, token, membershipStatus: 'pending' };
  },

  async loginUser(params: {
    email: string;
    password: string;
  }): Promise<{ user: UserRecord; token: string; membershipStatus: 'active' | 'pending' | 'none' }> {
    const email = params.email.trim().toLowerCase();

    if (process.env.NODE_ENV === 'test') {
      const entry = Array.from(testUsers.values()).find((u) => u.user.email === email);
      if (!entry) throw new Error('Invalid email or password.');
      const testHash = this.hashPassword(params.password, entry.salt);
      if (!crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(entry.passwordHash, 'hex'))) {
        throw new Error('Invalid email or password.');
      }
      const mem = Array.from(testMemberships.values()).find(
        (m) => m.userId === entry.user.id && m.villageId === entry.user.communityId
      );
      const membershipStatus = mem?.status === 'active' ? 'active' : mem ? 'pending' : 'none';
      const token = this.createToken(entry.user);
      return { user: entry.user, token, membershipStatus };
    }

    const res = await query(
      'SELECT id, email, password_hash, password_salt, display_name, role, community_id, created_at FROM users WHERE email = $1',
      [email]
    );

    if (res.rows.length === 0) {
      throw new Error('Invalid email or password.');
    }

    const row = res.rows[0];
    const computedHash = this.hashPassword(params.password, row.password_salt);

    const isMatch = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(row.password_hash, 'hex')
    );

    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    const user: UserRecord = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      communityId: row.community_id,
      createdAt: row.created_at,
    };

    // Check membership status
    const memRes = await query(
      'SELECT status FROM community_memberships WHERE user_id = $1 AND village_id = $2',
      [user.id, user.communityId]
    );
    const membershipStatus = memRes.rows.length > 0 ? (memRes.rows[0].status as 'active' | 'pending') : 'none';

    const token = this.createToken(user);
    return { user, token, membershipStatus };
  },

  /**
   * Check live hardware telemetry verification status for Node 1 and Node 2.
   * Returns honest waiting status until real authenticated packets arrive.
   */
  async getNodeStatusForCommunity(villageId: string): Promise<{
    node1: NodeStatusInfo;
    node2: NodeStatusInfo;
    bothNodesVerified: boolean;
  }> {
    const node1: NodeStatusInfo = {
      nodeId: 'node-1',
      name: 'Node 1 (Recharge Line)',
      description: 'YF-S201 flow sensor on recharge pipe + HC-SR04 ultrasonic sensor on tabletop tank',
      verified: false,
      lastSeen: null,
      flowLpm: null,
      waterLevelCm: null,
    };

    const node2: NodeStatusInfo = {
      nodeId: 'node-2',
      name: 'Node 2 (Extraction Line)',
      description: 'YF-S201 flow sensor on pump extraction hose',
      verified: false,
      lastSeen: null,
      flowLpm: null,
    };

    if (process.env.NODE_ENV === 'test') {
      const records = await NodeTelemetryRepository.list(villageId, 50);
      const n1Rec = records.find((r) => r.nodeId === 'node-1');
      if (n1Rec) {
        node1.verified = true;
        node1.lastSeen = n1Rec.capturedAt;
        node1.flowLpm = n1Rec.flow.flowLpm;
        node1.waterLevelCm = n1Rec.waterLevel?.levelCm ?? null;
      }
      const n2Rec = records.find((r) => r.nodeId === 'node-2');
      if (n2Rec) {
        node2.verified = true;
        node2.lastSeen = n2Rec.capturedAt;
        node2.flowLpm = n2Rec.flow.flowLpm;
      }
      return {
        node1,
        node2,
        bothNodesVerified: node1.verified && node2.verified,
      };
    }

    try {
      const res = await query(
        `SELECT DISTINCT ON (node_id) node_id, flow_lpm, water_level_cm, captured_at
         FROM prototype_node_telemetry
         WHERE village_id = $1 AND node_id IN ('node-1', 'node-2')
         ORDER BY node_id, captured_at DESC`,
        [villageId]
      );

      for (const row of res.rows) {
        if (row.node_id === 'node-1') {
          node1.verified = true;
          node1.lastSeen = new Date(row.captured_at).toISOString();
          node1.flowLpm = Number(row.flow_lpm);
          node1.waterLevelCm = row.water_level_cm != null ? Number(row.water_level_cm) : null;
        } else if (row.node_id === 'node-2') {
          node2.verified = true;
          node2.lastSeen = new Date(row.captured_at).toISOString();
          node2.flowLpm = Number(row.flow_lpm);
        }
      }
    } catch (err) {
      console.warn('[Hardware Status] Could not check prototype node telemetry:', err);
    }

    return {
      node1,
      node2,
      bothNodesVerified: node1.verified && node2.verified,
    };
  },

  /**
   * Hardware Verification Check & Membership Activation:
   * Activates community membership ONLY after BOTH Node 1 and Node 2
   * have successfully checked in with authenticated telemetry packets.
   */
  async checkAndActivateNodes(villageId: string): Promise<{
    bothNodesVerified: boolean;
    node1: NodeStatusInfo;
    node2: NodeStatusInfo;
    activated: boolean;
  }> {
    const { node1, node2, bothNodesVerified } = await this.getNodeStatusForCommunity(villageId);

    if (!bothNodesVerified) {
      return {
        bothNodesVerified: false,
        node1,
        node2,
        activated: false,
      };
    }

    // Both nodes verified: activate pending memberships for this village
    if (process.env.NODE_ENV === 'test') {
      for (const [key, mem] of testMemberships.entries()) {
        if (mem.villageId === villageId && mem.status === 'pending') {
          testMemberships.set(key, { ...mem, status: 'active' });
        }
      }
    } else {
      try {
        await query(
          `UPDATE community_memberships
           SET status = 'active', updated_at = NOW()
           WHERE village_id = $1 AND status = 'pending'`,
          [villageId]
        );
      } catch (err) {
        console.error('[Hardware Activation] Failed to update community memberships to active:', err);
      }
    }

    return {
      bothNodesVerified: true,
      node1,
      node2,
      activated: true,
    };
  },

  /**
   * Check if a user has active membership for the requested village.
   * Returns true only when status === 'active'.
   */
  async verifyCommunityMembership(userId: string, villageId: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      const mem = Array.from(testMemberships.values()).find(
        (m) => m.userId === userId && m.villageId === villageId && m.status === 'active'
      );
      return Boolean(mem);
    }

    try {
      const res = await query(
        `SELECT id FROM community_memberships WHERE user_id = $1 AND village_id = $2 AND status = 'active'`,
        [userId, villageId]
      );
      return res.rows.length > 0;
    } catch {
      return false;
    }
  },

  /**
   * Get raw membership status ('active' | 'pending' | 'none')
   */
  async getMembershipStatus(userId: string, villageId: string): Promise<'active' | 'pending' | 'none'> {
    if (process.env.NODE_ENV === 'test') {
      const mem = Array.from(testMemberships.values()).find(
        (m) => m.userId === userId && m.villageId === villageId
      );
      if (!mem) return 'none';
      return mem.status === 'active' ? 'active' : 'pending';
    }

    try {
      const res = await query(
        `SELECT status FROM community_memberships WHERE user_id = $1 AND village_id = $2`,
        [userId, villageId]
      );
      if (res.rows.length === 0) return 'none';
      return res.rows[0].status === 'active' ? 'active' : 'pending';
    } catch {
      return 'none';
    }
  },

  /**
   * Administrator Provisioning:
   * Provisions a user account with explicit role and active membership.
   * Used by administrator provisioning CLI and test harness.
   */
  async provisionUser(params: {
    email: string;
    password?: string;
    displayName: string;
    villageId: string;
    role?: string;
    status?: 'active' | 'pending';
  }): Promise<{ user: UserRecord; token?: string }> {
    const email = params.email.trim().toLowerCase();
    const displayName = params.displayName.trim();
    const villageId = params.villageId || 'village-rampur-04';
    const role = params.role || 'admin';
    const status = params.status || 'active';
    const nowIso = new Date().toISOString();

    const salt = this.generateSalt();
    const passwordHash = params.password ? this.hashPassword(params.password, salt) : '';
    const userId = `usr_${crypto.randomUUID()}`;
    const membershipId = `${userId}_${villageId}`;

    const user: UserRecord = {
      id: userId,
      email,
      displayName,
      role,
      communityId: villageId,
      createdAt: nowIso,
    };

    if (process.env.NODE_ENV === 'test') {
      testUsers.set(userId, { user, passwordHash, salt });
      testMemberships.set(membershipId, {
        id: membershipId,
        userId,
        villageId,
        status,
        role,
      });
      const token = this.createToken(user);
      return { user, token };
    }

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      const existingId = existing.rows[0].id;
      // Update role and membership
      await query(`UPDATE users SET role = $1 WHERE id = $2`, [role, existingId]);
      await query(
        `INSERT INTO community_memberships (id, user_id, village_id, status, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT (user_id, village_id) DO UPDATE SET status = $4, role = $5, updated_at = $6`,
        [`${existingId}_${villageId}`, existingId, villageId, status, role, nowIso]
      );
      user.id = existingId;
      return { user };
    }

    if (!params.password) {
      throw new Error('Password is required for new user provisioning.');
    }

    await query(
      `INSERT INTO users (id, email, password_hash, password_salt, display_name, role, community_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, email, passwordHash, salt, displayName, role, villageId, nowIso]
    );

    await query(
      `INSERT INTO community_memberships (id, user_id, village_id, status, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (user_id, village_id) DO UPDATE SET status = $4, role = $5, updated_at = $6`,
      [membershipId, userId, villageId, status, role, nowIso]
    );

    const token = this.createToken(user);
    return { user, token };
  },

  /**
   * Activate an existing user's membership for a village
   */
  async activateMembership(emailOrUserId: string, villageId: string, role = 'resident'): Promise<boolean> {
    const target = emailOrUserId.trim().toLowerCase();
    const nowIso = new Date().toISOString();

    if (process.env.NODE_ENV === 'test') {
      const entry = Array.from(testUsers.values()).find(
        (u) => u.user.email === target || u.user.id === target
      );
      if (!entry) return false;
      const memId = `${entry.user.id}_${villageId}`;
      testMemberships.set(memId, {
        id: memId,
        userId: entry.user.id,
        villageId,
        status: 'active',
        role,
      });
      return true;
    }

    const userRes = await query('SELECT id FROM users WHERE email = $1 OR id = $1', [target]);
    if (userRes.rows.length === 0) return false;
    const userId = userRes.rows[0].id;
    const memId = `${userId}_${villageId}`;

    await query(
      `INSERT INTO community_memberships (id, user_id, village_id, status, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', $4, $5, $5)
       ON CONFLICT (user_id, village_id) DO UPDATE SET status = 'active', role = $4, updated_at = $5`,
      [memId, userId, villageId, role, nowIso]
    );
    return true;
  },

  async addMembershipForTest(userId: string, villageId: string): Promise<void> {
    const memId = `${userId}_${villageId}`;
    if (process.env.NODE_ENV === 'test') {
      testMemberships.set(memId, {
        id: memId,
        userId,
        villageId,
        status: 'active',
        role: 'resident',
      });
      return;
    }
    await query(
      `INSERT INTO community_memberships (id, user_id, village_id, status, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', 'resident', NOW(), NOW())
       ON CONFLICT (user_id, village_id) DO UPDATE SET status = 'active'`,
      [memId, userId, villageId]
    );
  },
};
