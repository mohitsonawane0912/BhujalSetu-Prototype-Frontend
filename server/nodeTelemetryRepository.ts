import { FieldValue } from 'firebase-admin/firestore';
import { firestoreDb, isFirebaseConfigured } from './firebaseAdmin';
import { NodeTelemetryInput, NodeTelemetryRecord } from './nodeTelemetrySchema';

const TEST_COLLECTION = 'nodeTelemetryTestOnly';
const COLLECTION = 'prototype_node_telemetry';
const testRecords: NodeTelemetryRecord[] = [];

export const NodeTelemetryRepository = {
  clearTestRecords(): void {
    testRecords.length = 0;
  },

  async save(input: NodeTelemetryInput): Promise<NodeTelemetryRecord> {
    const id = `node_tel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: NodeTelemetryRecord = { ...input, id, receivedAt: new Date().toISOString() };

    if (process.env.NODE_ENV === 'test') {
      testRecords.unshift(record);
      return record;
    }
    if (!isFirebaseConfigured || !firestoreDb) {
      throw new Error('Firestore is not configured; telemetry was not stored.');
    }

    await firestoreDb.collection(COLLECTION).doc(id).set({
      ...record,
      serverReceivedAt: FieldValue.serverTimestamp(),
    });
    return record;
  },

  async list(villageId: string, limit: number): Promise<NodeTelemetryRecord[]> {
    if (process.env.NODE_ENV === 'test') {
      const villageRecords = testRecords.filter((item) => item.villageId === villageId);
      const node1 = villageRecords
        .filter((r) => r.nodeId === 'node-1')
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
        .slice(0, limit);
      const node2 = villageRecords
        .filter((r) => r.nodeId === 'node-2')
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
        .slice(0, limit);
      return [...node1, ...node2]
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
        .slice(0, limit);
    }
    if (!isFirebaseConfigured || !firestoreDb) {
      throw new Error('Firestore is not configured; telemetry history is unavailable.');
    }

    const [node1, node2] = await Promise.all(
      (['node-1', 'node-2'] as const).map((nodeId) =>
        firestoreDb!.collection(COLLECTION)
          .where('villageId', '==', villageId)
          .where('nodeId', '==', nodeId)
          .orderBy('capturedAt', 'desc')
          .limit(limit)
          .get()
      )
    );
    return [...node1.docs, ...node2.docs]
      .map((doc) => ({ ...doc.data(), id: doc.id } as NodeTelemetryRecord))
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      .slice(0, limit);
  },
};
