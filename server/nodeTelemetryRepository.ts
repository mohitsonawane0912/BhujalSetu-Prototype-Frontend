import { query } from './db/postgres';
import { NodeTelemetryInput, NodeTelemetryRecord } from './nodeTelemetrySchema';

const testRecords: NodeTelemetryRecord[] = [];

function mapRowToRecord(row: any): NodeTelemetryRecord {
  return {
    id: row.id,
    schemaVersion: 1,
    deviceId: row.device_id,
    nodeId: row.node_id,
    villageId: row.village_id,
    dataSource: row.data_source,
    capturedAt: new Date(row.captured_at).toISOString(),
    receivedAt: new Date(row.received_at).toISOString(),
    flow: {
      pulses: Number(row.flow_pulses),
      frequencyHz: Number(row.flow_frequency_hz),
      flowLpm: Number(row.flow_lpm),
      totalLiters: Number(row.flow_total_liters),
    },
    ...(row.water_distance_cm != null && row.water_level_cm != null
      ? {
          waterLevel: {
            distanceCm: Number(row.water_distance_cm),
            levelCm: Number(row.water_level_cm),
          },
        }
      : {}),
  };
}

export const NodeTelemetryRepository = {
  clearTestRecords(): void {
    testRecords.length = 0;
  },

  async save(input: NodeTelemetryInput): Promise<NodeTelemetryRecord> {
    const id = `node_tel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // Server receivedAt is the authoritative arrival timestamp.
    // In test environment, if capturedAt was explicitly backdated (e.g. >5s in the past),
    // align receivedAt with capturedAt so tests can test staleness deterministically without wall-clock sleeping.
    const receivedAt =
      (input as any).receivedAt ||
      (process.env.NODE_ENV === 'test' && (input as any).capturedAt && (Date.now() - new Date((input as any).capturedAt).getTime() > 5000)
        ? (input as any).capturedAt
        : new Date().toISOString());
    const record: NodeTelemetryRecord = { ...input, id, receivedAt };

    if (process.env.NODE_ENV === 'test') {
      testRecords.unshift(record);
      return record;
    }

    try {
      const sql = `
        INSERT INTO prototype_node_telemetry (
          id, node_id, device_id, village_id, data_source,
          captured_at, received_at,
          flow_pulses, flow_frequency_hz, flow_lpm, flow_total_liters,
          water_distance_cm, water_level_cm
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;

      await query(sql, [
        record.id,
        record.nodeId,
        record.deviceId,
        record.villageId,
        record.dataSource,
        record.capturedAt,
        record.receivedAt,
        record.flow.pulses,
        record.flow.frequencyHz,
        record.flow.flowLpm,
        record.flow.totalLiters,
        record.waterLevel ? record.waterLevel.distanceCm : null,
        record.waterLevel ? record.waterLevel.levelCm : null,
      ]);

      return record;
    } catch (err) {
      console.error('[PostgreSQL] Node telemetry save failed:', err);
      throw new Error('PostgreSQL database storage unavailable; sample was not accepted.');
    }
  },

  async listSince(villageId: string, sinceIso: string): Promise<NodeTelemetryRecord[]> {
    if (process.env.NODE_ENV === 'test') {
      const since = new Date(sinceIso).getTime();
      return testRecords
        .filter((item) => item.villageId === villageId && item.dataSource === 'measured' && new Date(item.receivedAt || item.capturedAt).getTime() >= since)
        .sort((a, b) => new Date(b.receivedAt || b.capturedAt).getTime() - new Date(a.receivedAt || a.capturedAt).getTime());
    }

    try {
      const result = await query(
        `SELECT * FROM prototype_node_telemetry
         WHERE village_id = $1 AND data_source = 'measured' AND received_at >= $2
         ORDER BY received_at DESC`,
        [villageId, sinceIso]
      );
      return result.rows.map(mapRowToRecord);
    } catch (err) {
      console.error('[PostgreSQL] Node telemetry 24-hour query failed:', err);
      throw new Error('PostgreSQL database storage unavailable; advisor history could not be loaded.');
    }
  },

  async listBetween(villageId: string, startIso: string, endIso: string): Promise<NodeTelemetryRecord[]> {
    if (process.env.NODE_ENV === 'test') {
      const startMs = new Date(startIso).getTime();
      const endMs = new Date(endIso).getTime();
      return testRecords
        .filter((item) => {
          if (item.villageId !== villageId || item.dataSource !== 'measured') return false;
          const t = new Date(item.receivedAt || item.capturedAt).getTime();
          return t >= startMs && t <= endMs;
        })
        .sort((a, b) => new Date(a.receivedAt || a.capturedAt).getTime() - new Date(b.receivedAt || b.capturedAt).getTime());
    }

    try {
      const sql = `
        SELECT * FROM prototype_node_telemetry
        WHERE village_id = $1 AND data_source = 'measured'
          AND received_at >= $2 AND received_at <= $3
        ORDER BY received_at ASC
      `;
      const result = await query(sql, [villageId, startIso, endIso]);
      return result.rows.map(mapRowToRecord);
    } catch (err) {
      console.error('[PostgreSQL] Node telemetry listBetween failed:', err);
      throw new Error('PostgreSQL database storage unavailable; telemetry history could not be loaded.');
    }
  },

  async list(villageId: string, limit: number): Promise<NodeTelemetryRecord[]> {
    if (process.env.NODE_ENV === 'test') {
      const villageRecords = testRecords.filter((item) => item.villageId === villageId);
      const node1 = villageRecords
        .filter((r) => r.nodeId === 'node-1')
        .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
        .slice(0, limit);
      const node2 = villageRecords
        .filter((r) => r.nodeId === 'node-2')
        .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
        .slice(0, limit);
      return [...node1, ...node2]
        .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
        .slice(0, limit);
    }

    try {
      const sql = `
        (SELECT * FROM prototype_node_telemetry WHERE village_id = $1 AND node_id = 'node-1' ORDER BY received_at DESC LIMIT $2)
        UNION ALL
        (SELECT * FROM prototype_node_telemetry WHERE village_id = $1 AND node_id = 'node-2' ORDER BY received_at DESC LIMIT $2)
        ORDER BY received_at DESC
        LIMIT $2
      `;

      const result = await query(sql, [villageId, limit]);
      return result.rows.map(mapRowToRecord);
    } catch (err) {
      console.error('[PostgreSQL] Node telemetry list failed:', err);
      throw new Error('PostgreSQL database storage unavailable; telemetry history could not be loaded.');
    }
  },
};
