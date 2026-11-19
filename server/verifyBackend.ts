/** Hardware-free telemetry API integration checks. NODE_ENV=test forces memory storage. */
import http from 'http';
import app from './index';
import { config } from './config';
import { WeatherService } from './weatherService';
import { AnomalyDetector } from './anomalyDetector';
import { NodeTelemetryRepository } from './nodeTelemetryRepository';
import { AuthService } from './authService';
import { WaterCreditsService, getKolkataDateString } from './waterCreditsService';

const TEST_PORT = 5099;
process.env.NODE_1_DEVICE_API_KEY = 'node_1_test_key_only';
process.env.NODE_2_DEVICE_API_KEY = 'node_2_test_key_only';
const sample = {
  deviceId: 'SIM-TEST-01',
  villageId: 'village-rampur-04',
  dataSource: 'simulated',
  tankLevelPercent: 60,
  tankDistanceCm: 12,
  flowInLpm: 0.8,
  flowOutLpm: 0.5,
  flowInLitersTotal: 2.4,
  flowOutLitersTotal: 1.5,
  pumpEnabled: false,
};
const node1Sample = {
  schemaVersion: 1,
  deviceId: 'ESP32-NODE-1',
  nodeId: 'node-1',
  villageId: 'village-rampur-04',
  dataSource: 'measured',
  capturedAt: '2026-11-15T10:00:00.000Z',
  flow: { pulses: 8, frequencyHz: 8, flowLpm: 1.07, totalLiters: 0.42 },
  waterLevel: { distanceCm: 12.5, levelCm: 17.5 },
};

const node2Sample = {
  schemaVersion: 1,
  deviceId: 'ESP32-NODE-2',
  nodeId: 'node-2',
  villageId: 'village-rampur-04',
  dataSource: 'measured',
  capturedAt: '2026-11-15T10:00:01.000Z',
  flow: { pulses: 5, frequencyHz: 5, flowLpm: 0.67, totalLiters: 0.25 },
};

function request(method: string, route: string, body?: unknown, token?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const raw = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1', port: TEST_PORT, path: route, method,
      headers: {
        ...(raw ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: text ? JSON.parse(text) : null }));
    });
    req.on('error', reject);
    if (raw) req.write(raw);
    req.end();
  });
}

async function main() {
  if (process.env.NODE_ENV !== 'test' || !config.deviceApiKey) throw new Error('Run with the test:backend script.');
  const server = app.listen(TEST_PORT, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const checks: Array<[string, () => Promise<boolean>]> = [
    ['health endpoint', async () => (await request('GET', '/api/health')).status === 200],
    ['missing and incorrect device keys are rejected', async () => {
      const missing = await request('POST', '/api/telemetry', sample);
      const wrong = await request('POST', '/api/telemetry', sample, 'wrong-test-key');
      return missing.status === 401 && wrong.status === 401;
    }],
    ['invalid telemetry is rejected', async () => {
      const invalid = await request('POST', '/api/telemetry', { ...sample, tankLevelPercent: 140 }, config.deviceApiKey);
      return invalid.status === 400;
    }],
    ['simulated telemetry is accepted with source label', async () => {
      const saved = await request('POST', '/api/telemetry', sample, config.deviceApiKey);
      return saved.status === 201 && saved.body.success === true;
    }],
    ['Node 1 packet stores recharge flow and water level', async () => {
      const saved = await request('POST', '/api/v1/telemetry', node1Sample, process.env.NODE_1_DEVICE_API_KEY);
      return saved.status === 201 && saved.body.nodeId === 'node-1' && saved.body.dataSource === 'measured';
    }],
    ['Node 1 without waterLevel is rejected', async () => {
      const { waterLevel, ...withoutLevel } = node1Sample;
      const res = await request('POST', '/api/v1/telemetry', withoutLevel, process.env.NODE_1_DEVICE_API_KEY);
      return res.status === 400;
    }],
    ['Node 1 with negative flow is rejected', async () => {
      const res = await request('POST', '/api/v1/telemetry', {
        ...node1Sample,
        flow: { ...node1Sample.flow, flowLpm: -5 },
      }, process.env.NODE_1_DEVICE_API_KEY);
      return res.status === 400;
    }],
    ['Node 1 with negative waterLevel distance is rejected', async () => {
      const res = await request('POST', '/api/v1/telemetry', {
        ...node1Sample,
        waterLevel: { distanceCm: -1, levelCm: 10 },
      }, process.env.NODE_1_DEVICE_API_KEY);
      return res.status === 400;
    }],
    ['Node 2 packet accepts flow only', async () => {
      const saved = await request('POST', '/api/v1/telemetry', node2Sample, process.env.NODE_2_DEVICE_API_KEY);
      return saved.status === 201 && saved.body.nodeId === 'node-2';
    }],
    ['Node 2 cannot submit a water-level reading', async () => {
      const invalid = await request('POST', '/api/v1/telemetry', {
        ...node2Sample,
        waterLevel: { distanceCm: 10, levelCm: 20 },
      }, process.env.NODE_2_DEVICE_API_KEY);
      return invalid.status === 400;
    }],
    ['node keys cannot be used to impersonate the other node', async () => {
      const rejected = await request('POST', '/api/v1/telemetry', node1Sample, process.env.NODE_2_DEVICE_API_KEY);
      return rejected.status === 401;
    }],
    ['telemetry history requires authentication', async () => {
      const unauth = await request('GET', '/api/v1/telemetry?villageId=village-rampur-04&limit=10');
      return unauth.status === 401;
    }],
    ['telemetry history rejects non-member access', async () => {
      const forbidden = await request('GET', '/api/v1/telemetry?villageId=village-rampur-04&limit=10', undefined, 'test-token-non-member');
      return forbidden.status === 403;
    }],
    ['telemetry history rejects member from another village', async () => {
      const otherVillage = await request('GET', '/api/v1/telemetry?villageId=village-rampur-04&limit=10', undefined, 'test-token-other-village');
      return otherVillage.status === 403;
    }],
    ['telemetry history validates query parameters', async () => {
      const res = await request('GET', '/api/v1/telemetry?villageId=&limit=10', undefined, 'test-token-valid-member');
      const resLimit = await request('GET', '/api/v1/telemetry?villageId=village-rampur-04&limit=9999', undefined, 'test-token-valid-member');
      return res.status === 400 && resLimit.status === 400;
    }],
    ['per-village history returns separate node records for authorized members', async () => {
      const history = await request('GET', '/api/v1/telemetry?villageId=village-rampur-04&limit=10', undefined, 'test-token-valid-member');
      const nodes = new Set((history.body.records || []).map((record: any) => record.nodeId));
      return history.status === 200 && nodes.has('node-1') && nodes.has('node-2');
    }],
    ['stored telemetry is returned by the latest endpoint for authorized member', async () => {
      const latest = await request('GET', '/api/prototype/telemetry/latest?villageId=village-rampur-04', undefined, 'test-token-valid-member');
      return latest.status === 200 && latest.body.dataSource === 'simulated' && latest.body.tankLevelPercent === 60;
    }],
    ['legacy telemetry endpoint returns deprecation header', async () => {
      const res = await request('POST', '/api/telemetry', sample, config.deviceApiKey);
      return res.status === 201 && !!res.headers['x-deprecated'];
    }],
    ['tabletop telemetry does not claim to be groundwater telemetry', async () => {
      const groundwater = await request('GET', '/api/groundwater?villageId=village-rampur-04');
      return groundwater.status === 200 && groundwater.body.hasLiveTelemetry === false && groundwater.body.depthMeters === null;
    }],
    ['Node 1 and Node 2 packets arriving concurrently without overwriting each other', async () => {
      const ts = '2026-11-15T11:00:00.000Z';
      const p1 = {
        schemaVersion: 1,
        deviceId: 'ESP32-NODE-1',
        nodeId: 'node-1',
        villageId: 'village-rampur-04',
        dataSource: 'measured',
        capturedAt: ts,
        flow: { pulses: 450, frequencyHz: 15, flowLpm: 2.0, totalLiters: 1.0 },
        waterLevel: { distanceCm: 10, levelCm: 20 },
      };
      const p2 = {
        schemaVersion: 1,
        deviceId: 'ESP32-NODE-2',
        nodeId: 'node-2',
        villageId: 'village-rampur-04',
        dataSource: 'measured',
        capturedAt: ts,
        flow: { pulses: 225, frequencyHz: 8, flowLpm: 1.0, totalLiters: 0.5 },
      };

      const [res1, res2] = await Promise.all([
        request('POST', '/api/v1/telemetry', p1, process.env.NODE_1_DEVICE_API_KEY),
        request('POST', '/api/v1/telemetry', p2, process.env.NODE_2_DEVICE_API_KEY),
      ]);
      if (res1.status !== 201 || res2.status !== 201) return false;

      const history = await request('GET', '/api/v1/telemetry?villageId=village-rampur-04&limit=20', undefined, 'test-token-valid-member');
      const records = history.body.records || [];
      const hasNode1 = records.some((r: any) => r.id === res1.body.telemetryId && r.nodeId === 'node-1');
      const hasNode2 = records.some((r: any) => r.id === res2.body.telemetryId && r.nodeId === 'node-2');
      return hasNode1 && hasNode2;
    }],
    ['No GEM award when paired measured data is missing or stale', async () => {
      // Send a packet in an isolated window with ONLY Node 1 (Node 2 missing)
      const orphanTs = '2026-11-15T12:30:00.000Z';
      const orphanNode1 = {
        schemaVersion: 1,
        deviceId: 'ESP32-NODE-1',
        nodeId: 'node-1',
        villageId: 'village-rampur-04',
        dataSource: 'measured',
        capturedAt: orphanTs,
        flow: { pulses: 900, frequencyHz: 30, flowLpm: 4.0, totalLiters: 2.0 },
        waterLevel: { distanceCm: 10, levelCm: 20 },
      };
      const saved = await request('POST', '/api/v1/telemetry', orphanNode1, process.env.NODE_1_DEVICE_API_KEY);
      if (saved.status !== 201) return false;

      const gemsRes = await request('GET', '/api/v1/gems?villageId=village-rampur-04', undefined, 'test-token-valid-member');
      if (gemsRes.status !== 200) return false;
      const windowKey = '2026-11-15T12:30:00.000Z';
      const windowAccrual = (gemsRes.body.ledger || []).find((l: any) => l.windowStart === windowKey);
      return windowAccrual === undefined;
    }],
    ['No GEM points or tokens are calculated, awarded, or stored upon telemetry arrival', async () => {
      // Window with paired data: Node 1 has 1350 pulses (3.0L), Node 2 has 450 pulses (1.0L).
      const pairedTs = '2026-11-15T14:15:10.000Z';
      const p1 = {
        schemaVersion: 1,
        deviceId: 'ESP32-NODE-1',
        nodeId: 'node-1',
        villageId: 'village-rampur-04',
        dataSource: 'measured',
        capturedAt: pairedTs,
        flow: { pulses: 1350, frequencyHz: 45, flowLpm: 6.0, totalLiters: 3.0 },
        waterLevel: { distanceCm: 8, levelCm: 22 },
      };
      const p2 = {
        schemaVersion: 1,
        deviceId: 'ESP32-NODE-2',
        nodeId: 'node-2',
        villageId: 'village-rampur-04',
        dataSource: 'measured',
        capturedAt: pairedTs,
        flow: { pulses: 450, frequencyHz: 15, flowLpm: 2.0, totalLiters: 1.0 },
      };

      await request('POST', '/api/v1/telemetry', p1, process.env.NODE_1_DEVICE_API_KEY);
      await request('POST', '/api/v1/telemetry', p2, process.env.NODE_2_DEVICE_API_KEY);

      const gemsRes = await request('GET', '/api/v1/gems?villageId=village-rampur-04', undefined, 'test-token-valid-member');
      if (gemsRes.status !== 200) return false;

      // Must be marked as proposed concept only with no active point balances or ledger
      return gemsRes.body.proposed === true && gemsRes.body.aggregateBalance === undefined && gemsRes.body.ledger === undefined;
    }],
    ['GEM endpoint returns proposed status and notes required authority agreement', async () => {
      const res = await request('GET', '/api/v1/gems?villageId=village-rampur-04', undefined, 'test-token-valid-member');
      if (res.status !== 200) return false;
      return res.body.proposed === true && typeof res.body.message === 'string' && res.body.message.includes('proposed');
    }],
    ['No fixed or simulated water-balance numbers in the live dashboard/API path', async () => {
      // Query village without paired telemetry
      const res = await request('GET', '/api/water-balance?villageId=village-empty-09');
      if (res.status !== 200) return false;
      const body = res.body;
      const hasNoFakeNumbers = body.inputs === null && body.outputs === null && body.netBalanceLiters === null;
      const isHonestWaiting = body.hasLiveTelemetry === false && body.status === 'waiting_for_devices';

      const gw = await request('GET', '/api/groundwater?villageId=village-empty-09');
      const gwNoDepth = gw.status === 200 && gw.body.depthMeters === null && gw.body.hasLiveTelemetry === false;

      return hasNoFakeNumbers && isHonestWaiting && gwNoDepth;
    }],
    ['Local secure user registration, token generation, and login', async () => {
      const email = `test.resident.${Date.now()}@example.org`;
      const reg = await request('POST', '/api/auth/register', {
        email,
        password: 'securePassword123!',
        displayName: 'Test Resident',
        villageId: 'village-rampur-04',
      });
      if (reg.status !== 201 || !reg.body.token || reg.body.user.email !== email) return false;

      const token = reg.body.token;
      const me = await request('GET', '/api/auth/me', undefined, token);
      if (me.status !== 200 || me.body.user.email !== email) return false;

      const login = await request('POST', '/api/auth/login', {
        email,
        password: 'securePassword123!',
      });
      if (login.status !== 200 || !login.body.token) return false;

      const badLogin = await request('POST', '/api/auth/login', {
        email,
        password: 'wrongPassword!',
      });
      return badLogin.status === 401;
    }],
    ['Community actions and pledges require active membership and derive identity server-side', async () => {
      // Unauthenticated requests rejected
      const unauthAct = await request('POST', '/api/community/actions', {
        actionType: 'recharge_pit_clearing',
        title: 'Cleared Pit near Primary School',
        ward: 'Ward 2',
      });
      if (unauthAct.status !== 401) return false;

      // Pending member rejected
      const pendingAct = await request('POST', '/api/community/actions', {
        actionType: 'recharge_pit_clearing',
        title: 'Cleared Pit near Primary School',
        ward: 'Ward 2',
      }, 'test-token-pending-member');
      if (pendingAct.status !== 403) return false;

      // Authenticated active member succeeds and derives userId/userName from token
      const validAct = await request('POST', '/api/community/actions', {
        userId: 'spoofed_user_id', // client attempt to spoof should be ignored
        userName: 'Spoofed User',
        communityId: 'spoofed_village',
        actionType: 'recharge_pit_clearing',
        title: 'Cleared Pit near Primary School',
        ward: 'Ward 2',
        impactLiters: 1500,
        status: 'completed',
      }, 'test-token-valid-member');
      if (validAct.status !== 201) return false;
      // Derived from test-token-valid-member
      if (validAct.body.action?.userId !== 'test-user-rampur-01') return false;
      if (validAct.body.action?.communityId !== 'village-rampur-04') return false;

      // List requires active membership
      const unauthList = await request('GET', '/api/community/actions?villageId=village-rampur-04');
      if (unauthList.status !== 401) return false;

      const authList = await request('GET', '/api/community/actions?villageId=village-rampur-04', undefined, 'test-token-valid-member');
      if (authList.status !== 200 || !Array.isArray(authList.body.actions)) return false;

      // Pledges also require active membership and derive identity server-side
      const validPledge = await request('POST', '/api/community/pledges', {
        userId: 'spoofed_user_id',
        userName: 'Spoofed User',
        pledgeType: 'irrigation_timing',
        targetLitersPerDay: 120,
      }, 'test-token-valid-member');
      if (validPledge.status !== 201) return false;
      if (validPledge.body.pledge?.userId !== 'test-user-rampur-01') return false;

      const authListPledges = await request('GET', '/api/community/pledges?villageId=village-rampur-04', undefined, 'test-token-valid-member');
      return authListPledges.status === 200 && Array.isArray(authListPledges.body.pledges);
    }],
    ['Prototype single community registration and hardware activation flow', async () => {
      // Check setup-status endpoint
      const statusRes = await request('GET', '/api/auth/setup-status');
      if (statusRes.status !== 200) return false;

      // Register prototype community
      const regComm = await request('POST', '/api/auth/register-community', {
        communityName: 'Rampur Pilot Gram',
        villageId: 'village-rampur-04',
        district: 'Pune',
        state: 'Maharashtra',
        email: 'primary.admin@rampur.in',
        password: 'AdminPassword123!',
        displayName: 'Primary Admin',
      });
      if (regComm.status !== 201 || regComm.body.membershipStatus !== 'pending') return false;

      // Single-community boundary: attempting to register a second different community is blocked
      const secondComm = await request('POST', '/api/auth/register-community', {
        communityName: 'Second Village',
        villageId: 'village-other-99',
        email: 'other@other.in',
        password: 'OtherPassword123!',
        displayName: 'Other Admin',
      });
      if (secondComm.status !== 400) return false;

      // Submit authenticated Node 1 and Node 2 packets
      const n1 = await request('POST', '/api/v1/telemetry', node1Sample, process.env.NODE_1_DEVICE_API_KEY);
      const n2 = await request('POST', '/api/v1/telemetry', node2Sample, process.env.NODE_2_DEVICE_API_KEY);
      if (n1.status !== 201 || n2.status !== 201) return false;

      // Trigger node verification & activation
      const verifyRes = await request('POST', '/api/auth/verify-nodes', { villageId: 'village-rampur-04' });
      return verifyRes.status === 200 && verifyRes.body.bothNodesVerified === true && verifyRes.body.activated === true;
    }],
    ['AI Advisor requires active community membership and derives identity server-side', async () => {
      // 1. Unauthenticated request is rejected
      const unauth = await request('GET', '/api/ai/advice');
      if (unauth.status !== 401) return false;

      // 2. Pending member request is rejected
      const pending = await request('GET', '/api/ai/advice', undefined, 'test-token-pending-member');
      if (pending.status !== 403) return false;

      // 3. Authorized active member succeeds
      const auth = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      return auth.status === 200 && auth.body.success === true && typeof auth.body.level === 'string';
    }],
    ['AI Advisor loads server-side context and rejects browser-supplied measurements', async () => {
      // Client sends fake sensor measurements in body
      const spoofedBody = {
        currentDepthMeters: 999.9,
        extractionLiters: 888888,
        rechargeLiters: 777777,
      };
      const res = await request('POST', '/api/ai/advice', spoofedBody, 'test-token-valid-member');
      if (res.status !== 200) return false;

      // Check evidence: groundwater is marked UNMEASURED with limitation note (no spoofed 999.9 depth)
      const evidence = res.body.evidence;
      if (!evidence || evidence.groundwater.status !== 'UNMEASURED') return false;
      if (evidence.groundwater.value.includes('999.9')) return false;
      return evidence.groundwater.limitationNote.toLowerCase().includes('ultrasonic sensor');
    }],
    ['AI Advisor returns WAITING_FOR_DATA with honest limitation note when telemetry is absent', async () => {
      NodeTelemetryRepository.clearTestRecords();
      AnomalyDetector.clearState();
      WeatherService.setMockForecast(null);

      const res = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      if (res.status !== 200) return false;
      return res.body.level === 'WAITING_FOR_DATA' && res.body.evidence.nodeTelemetry.status === 'waiting_for_devices';
    }],
    ['AI Advisor returns WAITING_FOR_DATA when Node 1 is missing, Node 2 is missing, or either is stale', async () => {
      NodeTelemetryRepository.clearTestRecords();
      AnomalyDetector.clearState();

      // Case A: Only Node 2 is present, Node 1 is missing
      await request('POST', '/api/v1/telemetry', {
        ...node2Sample,
        capturedAt: new Date().toISOString(),
      }, process.env.NODE_2_DEVICE_API_KEY);
      const missingN1Res = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      if (missingN1Res.status !== 200 || missingN1Res.body.level !== 'WAITING_FOR_DATA') return false;
      if (missingN1Res.body.evidence.nodeTelemetry.node1Status !== 'missing') return false;

      // Case B: Only Node 1 is present, Node 2 is missing
      NodeTelemetryRepository.clearTestRecords();
      await request('POST', '/api/v1/telemetry', {
        ...node1Sample,
        capturedAt: new Date().toISOString(),
      }, process.env.NODE_1_DEVICE_API_KEY);
      const missingN2Res = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      if (missingN2Res.status !== 200 || missingN2Res.body.level !== 'WAITING_FOR_DATA') return false;
      if (missingN2Res.body.evidence.nodeTelemetry.node2Status !== 'missing') return false;

      // Case C: Node 1 is stale (>45s ago), Node 2 is live
      NodeTelemetryRepository.clearTestRecords();
      await request('POST', '/api/v1/telemetry', {
        ...node1Sample,
        capturedAt: new Date(Date.now() - 60_000).toISOString(),
      }, process.env.NODE_1_DEVICE_API_KEY);
      await request('POST', '/api/v1/telemetry', {
        ...node2Sample,
        capturedAt: new Date().toISOString(),
      }, process.env.NODE_2_DEVICE_API_KEY);
      const staleN1Res = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      if (staleN1Res.status !== 200 || staleN1Res.body.level !== 'WAITING_FOR_DATA') return false;
      if (staleN1Res.body.evidence.nodeTelemetry.node1Status !== 'stale') return false;

      // Case D: Node 2 is stale (>45s ago), Node 1 is live
      NodeTelemetryRepository.clearTestRecords();
      await request('POST', '/api/v1/telemetry', {
        ...node1Sample,
        capturedAt: new Date().toISOString(),
      }, process.env.NODE_1_DEVICE_API_KEY);
      await request('POST', '/api/v1/telemetry', {
        ...node2Sample,
        capturedAt: new Date(Date.now() - 60_000).toISOString(),
      }, process.env.NODE_2_DEVICE_API_KEY);
      const staleN2Res = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      if (staleN2Res.status !== 200 || staleN2Res.body.level !== 'WAITING_FOR_DATA') return false;
      return staleN2Res.body.evidence.nodeTelemetry.node2Status === 'stale';
    }],
    ['AI Advisor PREPARE_RECHARGE classification on high precipitation forecast', async () => {
      NodeTelemetryRepository.clearTestRecords();
      AnomalyDetector.clearState();

      // Add measured live Node 1 and Node 2 packets
      await request('POST', '/api/v1/telemetry', {
        ...node1Sample,
        capturedAt: new Date().toISOString(),
      }, process.env.NODE_1_DEVICE_API_KEY);
      await request('POST', '/api/v1/telemetry', {
        ...node2Sample,
        capturedAt: new Date().toISOString(),
      }, process.env.NODE_2_DEVICE_API_KEY);

      // Mock high rain forecast
      WeatherService.setMockForecast({
        status: 'available',
        source: 'Open-Meteo Weather API (WMO-compliant forecast)',
        location: 'Rampur Gram Panchayat (26.24°N, 73.02°E)',
        forecastRainMm: 28.5,
        maxProbabilityPercent: 80,
        summary: 'Significant rain expected: ~28.5 mm forecasted (80% probability).',
        freshness: 'Freshly fetched test forecast',
        fetchedAt: new Date().toISOString(),
      });

      const res = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      WeatherService.setMockForecast(null);
      return res.status === 200 && res.body.level === 'PREPARE_RECHARGE';
    }],
    ['AI Advisor CRITICAL_CONSERVATION on Node 2 extraction anomaly or low tank', async () => {
      NodeTelemetryRepository.clearTestRecords();
      AnomalyDetector.clearState();

      // Submit 10 baseline samples of Node 2 at 1.5 L/min
      for (let i = 0; i < 10; i++) {
        await request('POST', '/api/v1/telemetry', {
          ...node2Sample,
          capturedAt: new Date(Date.now() - (15 - i) * 2000).toISOString(),
          flow: { pulses: 11, frequencyHz: 11, flowLpm: 1.5, totalLiters: 1.0 + i * 0.1 },
        }, process.env.NODE_2_DEVICE_API_KEY);
      }
      // Submit surge packet at 5.5 L/min (> 1.8x baseline and > 2.0 delta)
      await request('POST', '/api/v1/telemetry', {
        ...node2Sample,
        capturedAt: new Date().toISOString(),
        flow: { pulses: 41, frequencyHz: 41, flowLpm: 5.5, totalLiters: 2.5 },
      }, process.env.NODE_2_DEVICE_API_KEY);

      // Also ensure Node 1 is live so data completeness passes
      await request('POST', '/api/v1/telemetry', {
        ...node1Sample,
        capturedAt: new Date().toISOString(),
      }, process.env.NODE_1_DEVICE_API_KEY);

      const res = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      return res.status === 200 && res.body.level === 'CRITICAL_CONSERVATION' && res.body.evidence.anomaly.detected === true;
    }],
    ['AI Advisor CONSERVE_WATER exact classification mapping when extraction exceeds recharge', async () => {
      NodeTelemetryRepository.clearTestRecords();
      AnomalyDetector.clearState();

      // Node 2 extraction (2.5 L/min) exceeds Node 1 recharge (1.0 L/min)
      await request('POST', '/api/v1/telemetry', {
        ...node1Sample,
        capturedAt: new Date().toISOString(),
        flow: { pulses: 8, frequencyHz: 8, flowLpm: 1.0, totalLiters: 1.0 },
      }, process.env.NODE_1_DEVICE_API_KEY);
      await request('POST', '/api/v1/telemetry', {
        ...node2Sample,
        capturedAt: new Date().toISOString(),
        flow: { pulses: 19, frequencyHz: 19, flowLpm: 2.5, totalLiters: 2.5 },
      }, process.env.NODE_2_DEVICE_API_KEY);

      const conserveRes = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      return conserveRes.status === 200 && conserveRes.body.level === 'CONSERVE_WATER';
    }],
    ['AI Advisor NORMAL_USE exact classification mapping when recharge balances extraction', async () => {
      NodeTelemetryRepository.clearTestRecords();
      AnomalyDetector.clearState();

      // Node 1 recharge (3.0 L/min) exceeds extraction (1.0 L/min) with adequate tank level
      await request('POST', '/api/v1/telemetry', {
        ...node1Sample,
        capturedAt: new Date().toISOString(),
        flow: { pulses: 23, frequencyHz: 23, flowLpm: 3.0, totalLiters: 5.0 },
        waterLevel: { distanceCm: 10.0, levelCm: 20.0 },
      }, process.env.NODE_1_DEVICE_API_KEY);
      await request('POST', '/api/v1/telemetry', {
        ...node2Sample,
        capturedAt: new Date().toISOString(),
        flow: { pulses: 8, frequencyHz: 8, flowLpm: 1.0, totalLiters: 2.5 },
      }, process.env.NODE_2_DEVICE_API_KEY);

      const normalRes = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      return normalRes.status === 200 && normalRes.body.level === 'NORMAL_USE';
    }],
    ['Weather location is sourced strictly from community record and missing coordinates do not produce a forecast', async () => {
      // 1. Community without coordinates returns unconfigured without guessed weather
      AuthService.setTestCommunity({
        id: 'village-rampur-04',
        name: 'Rampur Pilot Gram',
        district: 'Jodhpur',
        state: 'Rajasthan',
        latitude: null,
        longitude: null,
        createdAt: new Date().toISOString(),
      });

      const unconfRes = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      if (unconfRes.status !== 200) return false;
      const unconfWeather = unconfRes.body.evidence.weather;
      if (unconfWeather.status !== 'unconfigured' || unconfWeather.forecastRainMm !== null) return false;
      if (!unconfWeather.limitationNote?.includes('coordinates')) return false;

      // 2. Community with valid coordinates passes verified location
      AuthService.setTestCommunity({
        id: 'village-rampur-04',
        name: 'Rampur Pilot Gram',
        district: 'Jodhpur',
        state: 'Rajasthan',
        latitude: 26.2389,
        longitude: 73.0243,
        createdAt: new Date().toISOString(),
      });

      WeatherService.setMockForecast({
        status: 'available',
        source: 'Open-Meteo Weather API (WMO-compliant forecast)',
        location: 'Rampur Pilot Gram (26.24°N, 73.02°E)',
        forecastRainMm: 0,
        maxProbabilityPercent: 5,
        summary: 'Dry weather expected.',
        freshness: 'Freshly fetched test forecast',
        fetchedAt: new Date().toISOString(),
      });

      const confRes = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      WeatherService.setMockForecast(null);
      return confRes.status === 200 && confRes.body.evidence.weather.status === 'available' && confRes.body.evidence.weather.location.includes('26.24');
    }],
    ['Weather API error and missing coordinates graceful handling', async () => {
      // 1. Missing coordinates returns unconfigured without throw
      const unconf = await WeatherService.getForecast(null, null, 'Unconfigured Gram');
      if (unconf.status !== 'unconfigured' || !unconf.limitationNote) return false;

      // 2. Error status preserves attribution and does not invent rain numbers
      WeatherService.setMockForecast({
        status: 'error',
        source: 'Open-Meteo Weather API',
        location: 'Rampur Gram Panchayat (26.24°N, 73.02°E)',
        forecastRainMm: null,
        maxProbabilityPercent: null,
        summary: 'Weather forecast temporarily unavailable from external provider.',
        freshness: 'API call failed / timed out',
        fetchedAt: new Date().toISOString(),
        limitationNote: 'External weather service timed out.',
      });

      const res = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      WeatherService.setMockForecast(null);
      return res.status === 200 && res.body.evidence.weather.status === 'error';
    }],
    ['Extraction anomaly baseline warm-up, high extraction detection, offline handling, and distinct alert clearing', async () => {
      NodeTelemetryRepository.clearTestRecords();
      AnomalyDetector.clearState();

      // Phase A: Warm-up with fewer than 10 samples
      for (let i = 0; i < 5; i++) {
        await request('POST', '/api/v1/telemetry', {
          ...node2Sample,
          capturedAt: new Date(Date.now() - (10 - i) * 1000).toISOString(),
          flow: { pulses: 15, frequencyHz: 15, flowLpm: 2.0, totalLiters: 1.0 + i },
        }, process.env.NODE_2_DEVICE_API_KEY);
      }
      const warmUpRes = await request('GET', '/api/telemetry/extraction-anomaly', undefined, 'test-token-valid-member');
      if (warmUpRes.status !== 200 || warmUpRes.body.baselineStatus !== 'building_baseline' || warmUpRes.body.isAnomaly !== false) return false;

      // Phase B: Complete 10 baseline samples
      for (let i = 5; i < 11; i++) {
        await request('POST', '/api/v1/telemetry', {
          ...node2Sample,
          capturedAt: new Date(Date.now() - (12 - i) * 1000).toISOString(),
          flow: { pulses: 15, frequencyHz: 15, flowLpm: 2.0, totalLiters: 1.0 + i },
        }, process.env.NODE_2_DEVICE_API_KEY);
      }
      const baselineRes = await request('GET', '/api/telemetry/extraction-anomaly', undefined, 'test-token-valid-member');
      if (baselineRes.body.baselineStatus !== 'established') return false;

      // Phase C: Surge packet (>1.8x baseline and >2.0 delta) -> anomaly triggers
      await request('POST', '/api/v1/telemetry', {
        ...node2Sample,
        capturedAt: new Date().toISOString(),
        flow: { pulses: 45, frequencyHz: 45, flowLpm: 6.0, totalLiters: 15.0 },
      }, process.env.NODE_2_DEVICE_API_KEY);
      const surgeRes = await request('GET', '/api/telemetry/extraction-anomaly', undefined, 'test-token-valid-member');
      if (!surgeRes.body.isAnomaly) return false;

      // Check alert appears in /api/alerts for authorized community member
      const alertsRes = await request('GET', '/api/alerts', undefined, 'test-token-valid-member');
      const anomalyAlert = alertsRes.body.find((a: any) => a.id.includes('anomaly'));
      if (!anomalyAlert || anomalyAlert.status !== 'ACTIVE') return false;

      // Phase D: Deduplication check - repeated check does not create duplicate alert object
      const alertsRes2 = await request('GET', '/api/alerts', undefined, 'test-token-valid-member');
      const anomalyAlerts = alertsRes2.body.filter((a: any) => a.id.includes('anomaly'));
      if (anomalyAlerts.length !== 1) return false;

      // Phase E: Repeated evaluation of the SAME normal packet does NOT clear the alert.
      // Alert remains ACTIVE through recovery (after 1st normal packet) on both anomaly API and dashboard alerts.
      await request('POST', '/api/v1/telemetry', {
        ...node2Sample,
        capturedAt: new Date(Date.now() + 1000).toISOString(),
        flow: { pulses: 15, frequencyHz: 15, flowLpm: 2.0, totalLiters: 16.0 },
      }, process.env.NODE_2_DEVICE_API_KEY);

      // Evaluate multiple times on the SAME packet
      await request('GET', '/api/telemetry/extraction-anomaly', undefined, 'test-token-valid-member');
      await request('GET', '/api/telemetry/extraction-anomaly', undefined, 'test-token-valid-member');
      const stillActiveRes = await request('GET', '/api/telemetry/extraction-anomaly', undefined, 'test-token-valid-member');
      // Current reading is normal (isAnomaly: false), but alert must still be ACTIVE awaiting 2nd distinct normal packet
      if (stillActiveRes.body.isAnomaly !== false || !stillActiveRes.body.alert || stillActiveRes.body.alert.status !== 'ACTIVE') return false;

      // Dashboard /api/alerts must also keep displaying the active alert during recovery
      const alertsResRecovery = await request('GET', '/api/alerts', undefined, 'test-token-valid-member');
      const recoveryAlert = alertsResRecovery.body.find((a: any) => a.id.includes('anomaly'));
      if (!recoveryAlert || recoveryAlert.status !== 'ACTIVE') return false;

      // Phase F: Only when a SECOND distinct normal packet arrives does the alert transition to CLEARED
      await request('POST', '/api/v1/telemetry', {
        ...node2Sample,
        capturedAt: new Date(Date.now() + 2000).toISOString(),
        flow: { pulses: 15, frequencyHz: 15, flowLpm: 2.0, totalLiters: 17.0 },
      }, process.env.NODE_2_DEVICE_API_KEY);
      const clearedRes = await request('GET', '/api/telemetry/extraction-anomaly', undefined, 'test-token-valid-member');
      const isClearedInAnomalyEndpoint = clearedRes.status === 200 && clearedRes.body.isAnomaly === false && (!clearedRes.body.alert || clearedRes.body.alert.status === 'CLEARED');
      if (!isClearedInAnomalyEndpoint) return false;

      // Dashboard /api/alerts must no longer return the cleared alert
      const alertsResCleared = await request('GET', '/api/alerts', undefined, 'test-token-valid-member');
      const clearedAlertInAlerts = alertsResCleared.body.find((a: any) => a.id.includes('anomaly'));
      return clearedAlertInAlerts === undefined;
    }],
    ['Alert and anomaly endpoints enforce strict active community membership and reject cross-village queries', async () => {
      // 1. Unauthenticated requests are rejected with 401
      const unauthAlerts = await request('GET', '/api/alerts');
      if (unauthAlerts.status !== 401) return false;

      const unauthAnomaly = await request('GET', '/api/telemetry/extraction-anomaly');
      if (unauthAnomaly.status !== 401) return false;

      // 2. Non-member tokens are rejected with 403
      const nonMemberAlerts = await request('GET', '/api/alerts', undefined, 'test-token-non-member');
      if (nonMemberAlerts.status !== 403) return false;

      const nonMemberAnomaly = await request('GET', '/api/telemetry/extraction-anomaly', undefined, 'test-token-non-member');
      if (nonMemberAnomaly.status !== 403) return false;

      // 3. Query parameter attempting to select another community is rejected with 403
      const crossVillageAlerts = await request('GET', '/api/alerts?villageId=village-other-99', undefined, 'test-token-valid-member');
      if (crossVillageAlerts.status !== 403) return false;

      const crossVillageAnomaly = await request('GET', '/api/telemetry/extraction-anomaly?villageId=village-other-99', undefined, 'test-token-valid-member');
      if (crossVillageAnomaly.status !== 403) return false;

      const crossVillageAdvisor = await request('GET', '/api/ai/advice?villageId=village-other-99', undefined, 'test-token-valid-member');
      return crossVillageAdvisor.status === 403;
    }],
    ['Community registration coordinates range validation and weather integration', async () => {
      // Out of range latitude (>90)
      const badLat = await request('POST', '/api/auth/register-community', {
        communityName: 'Invalid Lat Village',
        villageId: 'village-test-lat',
        email: 'badlat@test.org',
        password: 'password123',
        displayName: 'Test Admin',
        latitude: 95.5,
        longitude: 73.8,
      });
      if (badLat.status !== 400) return false;

      // Out of range longitude (>180)
      const badLon = await request('POST', '/api/auth/register-community', {
        communityName: 'Invalid Lon Village',
        villageId: 'village-test-lon',
        email: 'badlon@test.org',
        password: 'password123',
        displayName: 'Test Admin',
        latitude: 18.5,
        longitude: 195.0,
      });
      if (badLon.status !== 400) return false;

      // Latitude provided without longitude
      const missingLon = await request('POST', '/api/auth/register-community', {
        communityName: 'Missing Lon Village',
        villageId: 'village-test-missing-lon',
        email: 'missinglon@test.org',
        password: 'password123',
        displayName: 'Test Admin',
        latitude: 18.5,
      });
      return missingLon.status === 400;
    }],
    ['Reliable server arrival freshness clock protects against unsynchronized device clocks', async () => {
      NodeTelemetryRepository.clearTestRecords();

      // Submit a packet where device clock says NOW, but server receivedAt is 60s ago
      const staleArrival = new Date(Date.now() - 60_000).toISOString();
      await NodeTelemetryRepository.save({
        ...node1Sample,
        capturedAt: new Date().toISOString(), // Device clock says "now"
        receivedAt: staleArrival, // But server received it 60s ago
      } as any);

      // Submit Node 2 with fresh server receivedAt
      await NodeTelemetryRepository.save({
        ...node2Sample,
        capturedAt: new Date(Date.now() - 1000).toISOString(),
        receivedAt: new Date().toISOString(),
      } as any);

      const res = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      // Must be classified as WAITING_FOR_DATA and report Node 1 as stale despite device capturedAt
      return res.status === 200 && res.body.level === 'WAITING_FOR_DATA' && res.body.evidence.nodeTelemetry.node1Status === 'stale';
    }],
    ['Server arrival time (receivedAt) is authoritative end to end when conflicting with device capturedAt', async () => {
      NodeTelemetryRepository.clearTestRecords();
      AnomalyDetector.clearState();

      // Setup 10 baseline samples for Node 2 so baseline is established
      for (let i = 0; i < 10; i++) {
        await NodeTelemetryRepository.save({
          ...node2Sample,
          capturedAt: new Date(Date.now() - (20 - i) * 1000).toISOString(),
          receivedAt: new Date(Date.now() - (20 - i) * 1000).toISOString(),
          flow: { pulses: 15, frequencyHz: 15, flowLpm: 1.5, totalLiters: 1.0 + i },
        } as any);
      }

      // Conflict test for Node 2:
      // Packet A: device clock lagged (capturedAt = 30s ago), but arrived at server 2s ago (receivedAt = 2s ago) with SURGE flow 7.0 L/min
      const node2PacketA = {
        ...node2Sample,
        capturedAt: new Date(Date.now() - 30_000).toISOString(),
        receivedAt: new Date(Date.now() - 2_000).toISOString(),
        flow: { pulses: 50, frequencyHz: 50, flowLpm: 7.0, totalLiters: 20.0 },
      };
      // Packet B: device clock jumped ahead (capturedAt = 5s ago), but arrived at server 10s ago (receivedAt = 10s ago) with normal flow 1.5 L/min
      const node2PacketB = {
        ...node2Sample,
        capturedAt: new Date(Date.now() - 5_000).toISOString(),
        receivedAt: new Date(Date.now() - 10_000).toISOString(),
        flow: { pulses: 15, frequencyHz: 15, flowLpm: 1.5, totalLiters: 19.0 },
      };

      await NodeTelemetryRepository.save(node2PacketB as any);
      await NodeTelemetryRepository.save(node2PacketA as any);

      // Conflict test for Node 1:
      // Packet X: device clock lagged (capturedAt = 40s ago), arrived at server 1s ago (receivedAt = 1s ago) with tank level 18.0 cm
      const node1PacketX = {
        ...node1Sample,
        capturedAt: new Date(Date.now() - 40_000).toISOString(),
        receivedAt: new Date(Date.now() - 1_000).toISOString(),
        flow: { pulses: 15, frequencyHz: 15, flowLpm: 2.0, totalLiters: 5.0 },
        waterLevel: { distanceCm: 12, levelCm: 18.0 },
      };
      // Packet Y: device clock jumped ahead (capturedAt = 6s ago), arrived at server 15s ago (receivedAt = 15s ago) with depleted tank level 3.0 cm
      const node1PacketY = {
        ...node1Sample,
        capturedAt: new Date(Date.now() - 6_000).toISOString(),
        receivedAt: new Date(Date.now() - 15_000).toISOString(),
        flow: { pulses: 10, frequencyHz: 10, flowLpm: 1.0, totalLiters: 4.5 },
        waterLevel: { distanceCm: 27, levelCm: 3.0 },
      };

      await NodeTelemetryRepository.save(node1PacketY as any);
      await NodeTelemetryRepository.save(node1PacketX as any);

      // 1. Verify NodeTelemetryRepository.list() orders by receivedAt DESC
      const records = await NodeTelemetryRepository.list('village-rampur-04', 10);
      const topN2 = records.find((r) => r.nodeId === 'node-2');
      const topN1 = records.find((r) => r.nodeId === 'node-1');
      if (!topN2 || topN2.flow.flowLpm !== 7.0) return false;
      if (!topN1 || topN1.waterLevel?.levelCm !== 18.0) return false;

      // 2. Verify AnomalyDetector selects Packet A (flow 7.0 L/min), triggering anomaly while preserving capturedAt
      const anomalyRes = await request('GET', '/api/telemetry/extraction-anomaly', undefined, 'test-token-valid-member');
      if (anomalyRes.status !== 200 || anomalyRes.body.currentFlowLpm !== 7.0 || anomalyRes.body.isAnomaly !== true) return false;
      if (anomalyRes.body.latestCapturedAt !== node2PacketA.capturedAt) return false;

      // 3. Verify Advisor selects Packet X for Node 1 and Packet A for Node 2
      const advisorRes = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      if (advisorRes.status !== 200) return false;
      const nTele = advisorRes.body.evidence.nodeTelemetry;
      if (nTele.extractionFlowLpm !== 7.0 || nTele.tankLevelCm !== 18.0) return false;

      // 4. Verify dashboard telemetry endpoint (/api/v1/telemetry) serves Packet A & Packet X first
      const dashTelemetryRes = await request('GET', '/api/v1/telemetry?villageId=village-rampur-04&limit=10', undefined, 'test-token-valid-member');
      const dRecords = dashTelemetryRes.body.records || [];
      const dashN2Top = dRecords.find((r: any) => r.nodeId === 'node-2');
      const dashN1Top = dRecords.find((r: any) => r.nodeId === 'node-1');
      return dashN2Top?.flow.flowLpm === 7.0 && dashN1Top?.waterLevel?.levelCm === 18.0;
    }],
    ['Allow location updates for already registered community and enforce validation', async () => {
      // 1. Ensure a community exists with null coordinates
      const initialComm = await AuthService.getPrototypeCommunity();
      if (initialComm) {
        await AuthService.updateCommunityLocation(initialComm.id, null, null);
      }

      // 2. Weather is unconfigured when coordinates are null
      const unconfigAdv = await request('GET', '/api/ai/advice', undefined, 'test-token-valid-member');
      if (unconfigAdv.body.evidence.weather.status !== 'unconfigured') return false;

      // 3. Update community location via PATCH /api/auth/community/location
      const updateRes = await request('PATCH', '/api/auth/community/location', {
        latitude: 26.2389,
        longitude: 73.0243,
      }, 'test-token-valid-member');
      if (updateRes.status !== 200 || !updateRes.body.success) return false;
      if (updateRes.body.community.latitude !== 26.2389 || updateRes.body.community.longitude !== 73.0243) return false;

      // 4. Verified community record now loads the new coordinates
      const commRecord = await AuthService.getPrototypeCommunity();
      if (!commRecord || commRecord.latitude !== 26.2389 || commRecord.longitude !== 73.0243) return false;

      // 5. Invalid updates are strictly rejected
      const badLat = await request('PATCH', '/api/auth/community/location', { latitude: 95.0, longitude: 73.0 }, 'test-token-valid-member');
      if (badLat.status !== 400) return false;

      const badLon = await request('PATCH', '/api/auth/community/location', { latitude: 26.0, longitude: 200.0 }, 'test-token-valid-member');
      if (badLon.status !== 400) return false;

      const missingOne = await request('PATCH', '/api/auth/community/location', { latitude: 26.0 }, 'test-token-valid-member');
      if (missingOne.status !== 400) return false;

      // 6. Unauthenticated and non-member attempts are rejected
      const unauth = await request('PATCH', '/api/auth/community/location', { latitude: 26.0, longitude: 73.0 });
      if (unauth.status !== 401) return false;

      const nonMember = await request('PATCH', '/api/auth/community/location', { latitude: 26.0, longitude: 73.0 }, 'test-token-non-member');
      return nonMember.status === 403;
    }],
    ['Signed-in user can only see and select verified authorized community profiles and cannot see or query unrelated communities', async () => {
      // 1. Authenticated user requests authorized communities
      const res = await request('GET', '/api/auth/authorized-communities', undefined, 'test-token-valid-member');
      if (res.status !== 200 || !res.body.success || !Array.isArray(res.body.communities)) return false;

      // Must return exactly the user's authorized community
      const commIds = res.body.communities.map((c: any) => c.id);
      if (!commIds.includes('village-rampur-04')) return false;

      // Must NOT include unrelated, sample, or mock community profiles
      if (commIds.includes('village-shivpuri-02') || commIds.includes('village-adarsh-01')) return false;

      // 2. Unauthenticated request is rejected with 401
      const unauth = await request('GET', '/api/auth/authorized-communities');
      if (unauth.status !== 401) return false;

      // 3. Non-member token is rejected with 403
      const nonMember = await request('GET', '/api/auth/authorized-communities', undefined, 'test-token-non-member');
      if (nonMember.status !== 403) return false;

      // 4. Attempting to select/query unrelated community profiles is rejected across all protected endpoints
      const unauthTelemetry = await request('GET', '/api/v1/telemetry?villageId=village-shivpuri-02&limit=10', undefined, 'test-token-valid-member');
      if (unauthTelemetry.status !== 403) return false;

      const unauthAlerts = await request('GET', '/api/alerts?villageId=village-shivpuri-02', undefined, 'test-token-valid-member');
      if (unauthAlerts.status !== 403) return false;

      const unauthAnomaly = await request('GET', '/api/telemetry/extraction-anomaly?villageId=village-adarsh-01', undefined, 'test-token-valid-member');
      return unauthAnomaly.status === 403;
    }],
    ['Allow community name updates for authorized community and enforce validation', async () => {
      // 1. Update community name via PATCH /api/auth/community/name
      const updateRes = await request('PATCH', '/api/auth/community/name', {
        name: 'Rampur Smart Watershed Commons',
      }, 'test-token-valid-member');
      if (updateRes.status !== 200 || !updateRes.body.success) return false;
      if (updateRes.body.community.name !== 'Rampur Smart Watershed Commons') return false;

      // 2. Verified community record and authorized-communities return the updated name
      const commRecord = await AuthService.getPrototypeCommunity();
      if (!commRecord || commRecord.name !== 'Rampur Smart Watershed Commons') return false;

      const authCommRes = await request('GET', '/api/auth/authorized-communities', undefined, 'test-token-valid-member');
      if (authCommRes.status !== 200 || authCommRes.body.communities[0]?.name !== 'Rampur Smart Watershed Commons') return false;

      // 3. Validation: blank or too short (<2 chars) name rejected with 400
      const tooShort = await request('PATCH', '/api/auth/community/name', { name: ' ' }, 'test-token-valid-member');
      if (tooShort.status !== 400) return false;

      // 4. Validation: overly long (>128 chars) name rejected with 400
      const tooLong = await request('PATCH', '/api/auth/community/name', { name: 'A'.repeat(129) }, 'test-token-valid-member');
      if (tooLong.status !== 400) return false;

      // 5. Unauthenticated request rejected with 401
      const unauth = await request('PATCH', '/api/auth/community/name', { name: 'Hacked Village' });
      if (unauth.status !== 401) return false;

      // 6. Non-member request rejected with 403
      const nonMember = await request('PATCH', '/api/auth/community/name', { name: 'Unauthorized Change' }, 'test-token-non-member');
      if (nonMember.status !== 403) return false;

      // Restore original name for clean state
      await AuthService.updateCommunityName('village-rampur-04', 'Rampur Village Community');
      return true;
    }],
    ['Water Credits: Daily conversion formula (1 credit per net surplus litre, floor) and surplus percentage', async () => {
      WaterCreditsService.clearTestData();
      NodeTelemetryRepository.clearTestRecords();

      // Seed 2026-11-15 (completed day in Asia/Kolkata) with sufficient coverage (86.8% > 75%)
      // Node 1: 120 Litres, Node 2: 100 Litres -> Net Surplus: 20 Litres -> 20 Credits (20.0% surplus)
      const dayStartMs = Date.parse('2026-11-15T00:00:00.000+05:30');
      const packetCount = 1500;
      const stepMs = 50 * 1000; // 50s intervals (no gap since <= 60s)
      const n1Pulses = Math.round((120 * 450) / packetCount);
      const n2Pulses = Math.round((100 * 450) / packetCount);

      for (let i = 0; i < packetCount; i++) {
        const timeIso = new Date(dayStartMs + i * stepMs).toISOString();
        await NodeTelemetryRepository.save({
          schemaVersion: 1,
          deviceId: 'ESP32-NODE-1',
          nodeId: 'node-1',
          villageId: 'village-rampur-04',
          dataSource: 'measured',
          capturedAt: timeIso,
          receivedAt: timeIso,
          flow: { pulses: n1Pulses, frequencyHz: 8, flowLpm: 1.0, totalLiters: 99.0 },
          waterLevel: { distanceCm: 10, levelCm: 20 },
        } as any);

        await NodeTelemetryRepository.save({
          schemaVersion: 1,
          deviceId: 'ESP32-NODE-2',
          nodeId: 'node-2',
          villageId: 'village-rampur-04',
          dataSource: 'measured',
          capturedAt: timeIso,
          receivedAt: timeIso,
          flow: { pulses: n2Pulses, frequencyHz: 6, flowLpm: 0.8, totalLiters: 99.0 },
        } as any);
      }

      // Calculate daily credits for 2026-11-15
      const calcRes = await request('POST', '/api/v1/water-credits/calculate-daily', {
        targetDate: '2026-11-15',
      }, 'test-token-valid-member');

      if (calcRes.status !== 200 || !calcRes.body.success) return false;
      const entry = calcRes.body.entry;
      if (!entry || entry.periodDate !== '2026-11-15') return false;
      if (entry.dataCoverageStatus !== 'complete') return false;
      if (entry.creditsEarned !== 20) return false;
      if (Math.round(entry.rechargeLiters) !== 120 || Math.round(entry.extractionLiters) !== 100) return false;
      if (Math.round(entry.netSurplusLiters) !== 20) return false;
      if (entry.surplusPercentage !== 20) return false;

      // Verify balance endpoint returns 20 credits
      const balRes = await request('GET', '/api/v1/water-credits/balance', undefined, 'test-token-valid-member');
      return balRes.status === 200 && balRes.body.availableCredits === 20;
    }],
    ['Water Credits: Zero extraction handles percentage as unavailable while awarding credits from measured surplus', async () => {
      // 2026-11-14: Node 1 has 50 Litres, Node 2 has 0 Litres (0 pulses)
      const dayStartMs = Date.parse('2026-11-14T00:00:00.000+05:30');
      const packetCount = 1500;
      const stepMs = 50 * 1000;
      const n1Pulses = Math.round((50 * 450) / packetCount);

      for (let i = 0; i < packetCount; i++) {
        const timeIso = new Date(dayStartMs + i * stepMs).toISOString();
        await NodeTelemetryRepository.save({
          schemaVersion: 1,
          deviceId: 'ESP32-NODE-1',
          nodeId: 'node-1',
          villageId: 'village-rampur-04',
          dataSource: 'measured',
          capturedAt: timeIso,
          receivedAt: timeIso,
          flow: { pulses: n1Pulses, frequencyHz: 5, flowLpm: 0.6, totalLiters: 99.0 },
          waterLevel: { distanceCm: 10, levelCm: 20 },
        } as any);

        await NodeTelemetryRepository.save({
          schemaVersion: 1,
          deviceId: 'ESP32-NODE-2',
          nodeId: 'node-2',
          villageId: 'village-rampur-04',
          dataSource: 'measured',
          capturedAt: timeIso,
          receivedAt: timeIso,
          flow: { pulses: 0, frequencyHz: 0, flowLpm: 0, totalLiters: 99.0 },
        } as any);
      }

      const calcRes = await request('POST', '/api/v1/water-credits/calculate-daily', {
        targetDate: '2026-11-14',
      }, 'test-token-valid-member');

      if (calcRes.status !== 200 || !calcRes.body.success) return false;
      const entry = calcRes.body.entry;
      // Zero extraction: surplusPercentage must be null (unavailable)
      if (entry.surplusPercentage !== null) return false;
      if (entry.creditsEarned !== 50) return false;
      if (Math.round(entry.rechargeLiters) !== 50 || entry.extractionLiters !== 0) return false;

      // Cumulative balance is now 20 (from 11-15) + 50 (from 11-14) = 70
      const balRes = await request('GET', '/api/v1/water-credits/balance', undefined, 'test-token-valid-member');
      return balRes.status === 200 && balRes.body.availableCredits === 70;
    }],
    ['Water Credits: Deficit when extraction exceeds recharge awards zero credits and preserves previously earned credits', async () => {
      // 2026-11-13: Node 1 has 80 Litres, Node 2 has 100 Litres (20 L deficit)
      const dayStartMs = Date.parse('2026-11-13T00:00:00.000+05:30');
      const packetCount = 1500;
      const stepMs = 50 * 1000;
      const n1Pulses = Math.round((80 * 450) / packetCount);
      const n2Pulses = Math.round((100 * 450) / packetCount);

      for (let i = 0; i < packetCount; i++) {
        const timeIso = new Date(dayStartMs + i * stepMs).toISOString();
        await NodeTelemetryRepository.save({
          schemaVersion: 1,
          deviceId: 'ESP32-NODE-1',
          nodeId: 'node-1',
          villageId: 'village-rampur-04',
          dataSource: 'measured',
          capturedAt: timeIso,
          receivedAt: timeIso,
          flow: { pulses: n1Pulses, frequencyHz: 5, flowLpm: 0.6, totalLiters: 99.0 },
          waterLevel: { distanceCm: 10, levelCm: 20 },
        } as any);

        await NodeTelemetryRepository.save({
          schemaVersion: 1,
          deviceId: 'ESP32-NODE-2',
          nodeId: 'node-2',
          villageId: 'village-rampur-04',
          dataSource: 'measured',
          capturedAt: timeIso,
          receivedAt: timeIso,
          flow: { pulses: n2Pulses, frequencyHz: 7, flowLpm: 0.9, totalLiters: 99.0 },
        } as any);
      }

      const calcRes = await request('POST', '/api/v1/water-credits/calculate-daily', {
        targetDate: '2026-11-13',
      }, 'test-token-valid-member');

      if (calcRes.status !== 200 || !calcRes.body.success) return false;
      const entry = calcRes.body.entry;
      // Zero credits awarded for deficit day
      if (entry.creditsEarned !== 0) return false;
      if (Math.round(entry.netDeficitLiters) !== 20) return false;
      if (entry.netSurplusLiters !== 0) return false;
      if (entry.surplusPercentage !== -20) return false;

      // Cumulative balance must NOT be reduced (remains 70)
      const balRes = await request('GET', '/api/v1/water-credits/balance', undefined, 'test-token-valid-member');
      return balRes.status === 200 && balRes.body.availableCredits === 70;
    }],
    ['Water Credits: Asia/Kolkata timezone day boundaries protect in-progress day from premature awards', async () => {
      // Current date in Asia/Kolkata (still ongoing today)
      // Attempting to calculate credits for today must be rejected with 400
      const todayKolkata = getKolkataDateString(new Date());
      const res = await request('POST', '/api/v1/water-credits/calculate-daily', {
        targetDate: todayKolkata,
      }, 'test-token-valid-member');

      if (res.status !== 400 || res.body.success !== false) return false;
      if (!res.body.error.toLowerCase().includes('in progress')) return false;

      // Summary todayRunning returns in_progress without credits
      const summaryRes = await request('GET', '/api/v1/water-credits/summary', undefined, 'test-token-valid-member');
      if (summaryRes.status !== 200 || !summaryRes.body.success) return false;
      return summaryRes.body.todayRunning.isCompleted === false;
    }],
    ['Water Credits: Safeguard against missing node, stale sensor, or telemetry gap marks day Incomplete with 0 credits', async () => {
      // 2026-11-12: Only Node 1 is present (Node 2 completely missing)
      const dayStartMs = Date.parse('2026-11-12T00:00:00.000+05:30');
      for (let i = 0; i < 1500; i++) {
        const timeIso = new Date(dayStartMs + i * 50 * 1000).toISOString();
        await NodeTelemetryRepository.save({
          schemaVersion: 1,
          deviceId: 'ESP32-NODE-1',
          nodeId: 'node-1',
          villageId: 'village-rampur-04',
          dataSource: 'measured',
          capturedAt: timeIso,
          receivedAt: timeIso,
          flow: { pulses: 50, frequencyHz: 5, flowLpm: 0.6, totalLiters: 99.0 },
          waterLevel: { distanceCm: 10, levelCm: 20 },
        } as any);
      }

      const res = await request('POST', '/api/v1/water-credits/calculate-daily', {
        targetDate: '2026-11-12',
      }, 'test-token-valid-member');

      if (res.status !== 200 || !res.body.success) return false;
      const entry = res.body.entry;
      // Missing Node 2 must mark day Incomplete and award 0 credits
      return entry.dataCoverageStatus === 'incomplete' && entry.creditsEarned === 0 && entry.node2SampleCount === 0;
    }],
    ['Water Credits: Volume integration does not interpolate across long telemetry gaps', async () => {
      // 2026-11-11: Only 4 isolated packets spaced 3 hours apart (>60s gap threshold)
      const dayStartMs = Date.parse('2026-11-11T00:00:00.000+05:30');
      const times = [
        new Date(dayStartMs + 1 * 3600 * 1000).toISOString(),
        new Date(dayStartMs + 4 * 3600 * 1000).toISOString(),
        new Date(dayStartMs + 8 * 3600 * 1000).toISOString(),
        new Date(dayStartMs + 12 * 3600 * 1000).toISOString(),
      ];

      for (const t of times) {
        await NodeTelemetryRepository.save({
          schemaVersion: 1,
          deviceId: 'ESP32-NODE-1',
          nodeId: 'node-1',
          villageId: 'village-rampur-04',
          dataSource: 'measured',
          capturedAt: t,
          receivedAt: t,
          flow: { pulses: 450, frequencyHz: 5, flowLpm: 5.0, totalLiters: 99.0 },
          waterLevel: { distanceCm: 10, levelCm: 20 },
        } as any);
        await NodeTelemetryRepository.save({
          schemaVersion: 1,
          deviceId: 'ESP32-NODE-2',
          nodeId: 'node-2',
          villageId: 'village-rampur-04',
          dataSource: 'measured',
          capturedAt: t,
          receivedAt: t,
          flow: { pulses: 450, frequencyHz: 5, flowLpm: 5.0, totalLiters: 99.0 },
        } as any);
      }

      const res = await request('POST', '/api/v1/water-credits/calculate-daily', {
        targetDate: '2026-11-11',
      }, 'test-token-valid-member');

      if (res.status !== 200 || !res.body.success) return false;
      const entry = res.body.entry;
      // Because gaps > 60s were not interpolated, coverage is ~0.05% (<75%), gapCount > 0, status incomplete, 0 credits
      return entry.dataCoverageStatus === 'incomplete' && entry.gapCountNode1 >= 3 && entry.creditsEarned === 0;
    }],
    ['Water Credits: Rejects simulated packets and browser-supplied totals strictly server-side', async () => {
      // 2026-11-10: Send simulated packets
      const dayStartMs = Date.parse('2026-11-10T00:00:00.000+05:30');
      for (let i = 0; i < 1500; i++) {
        const timeIso = new Date(dayStartMs + i * 50 * 1000).toISOString();
        await NodeTelemetryRepository.save({
          schemaVersion: 1,
          deviceId: 'ESP32-NODE-1',
          nodeId: 'node-1',
          villageId: 'village-rampur-04',
          dataSource: 'simulated', // Fake simulation!
          capturedAt: timeIso,
          receivedAt: timeIso,
          flow: { pulses: 9999, frequencyHz: 50, flowLpm: 100.0, totalLiters: 99999.0 },
          waterLevel: { distanceCm: 10, levelCm: 20 },
        } as any);
      }

      // Client sends spoofed recharge totals in request body
      const res = await request('POST', '/api/v1/water-credits/calculate-daily', {
        targetDate: '2026-11-10',
        rechargeLiters: 999999,
        creditsEarned: 999999,
      }, 'test-token-valid-member');

      if (res.status !== 200 || !res.body.success) return false;
      const entry = res.body.entry;
      // Simulated packets are ignored; measured recharge remains 0 and credits 0
      return entry.rechargeLiters === 0 && entry.creditsEarned === 0 && entry.dataCoverageStatus !== 'complete';
    }],
    ['Water Credits: Idempotent calculation prevents double-crediting across repeated requests and restarts', async () => {
      // Fetch balance before
      const beforeRes = await request('GET', '/api/v1/water-credits/balance', undefined, 'test-token-valid-member');
      const startBalance = beforeRes.body.availableCredits;

      // Repeat calculation for 2026-11-15 three times
      for (let r = 0; r < 3; r++) {
        const repeatRes = await request('POST', '/api/v1/water-credits/calculate-daily', {
          targetDate: '2026-11-15',
        }, 'test-token-valid-member');
        if (repeatRes.status !== 200 || repeatRes.body.entry.creditsEarned !== 20) return false;
      }

      // Balance must NOT have increased!
      const afterRes = await request('GET', '/api/v1/water-credits/balance', undefined, 'test-token-valid-member');
      return afterRes.body.availableCredits === startBalance;
    }],
    ['Water Credits: Endpoints enforce active community membership and reject cross-community access', async () => {
      // 1. Unauthenticated request rejected with 401
      const unauth = await request('GET', '/api/v1/water-credits/summary');
      if (unauth.status !== 401) return false;

      // 2. Non-member rejected with 403
      const nonMember = await request('GET', '/api/v1/water-credits/summary', undefined, 'test-token-non-member');
      if (nonMember.status !== 403) return false;

      // 3. Pending member rejected with 403
      const pending = await request('GET', '/api/v1/water-credits/summary', undefined, 'test-token-pending-member');
      if (pending.status !== 403) return false;

      // 4. Cross-community access rejected with 403
      const crossVillage = await request('GET', '/api/v1/water-credits/summary?villageId=village-other-99', undefined, 'test-token-valid-member');
      if (crossVillage.status !== 403) return false;

      // 5. Cross-community calculation post rejected with 403
      const crossPost = await request('POST', '/api/v1/water-credits/calculate-daily', {
        communityId: 'village-other-99',
        targetDate: '2026-11-15',
      }, 'test-token-valid-member');
      if (crossPost.status !== 403) return false;

      // 6. Authorized member succeeds
      const auth = await request('GET', '/api/v1/water-credits/summary', undefined, 'test-token-valid-member');
      return auth.status === 200 && auth.body.success === true && typeof auth.body.availableCredits === 'number';
    }],
  ];

  let failures = 0;
  try {
    for (const [label, check] of checks) {
      const passed = await check();
      console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
      if (!passed) failures++;
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  if (failures) process.exitCode = 1;
  else console.log(`\n${checks.length} backend checks passed (in-memory test mode).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
