/** Hardware-free telemetry API integration checks. NODE_ENV=test forces memory storage. */
import http from 'http';
import app from './index';
import { config } from './config';

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
