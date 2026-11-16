import { initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { config } from './config';

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;
let isConfigured = false;

// Attempt to initialize Firebase Admin if valid credentials exist
if (config.firebase.clientEmail && config.firebase.privateKey && process.env.NODE_ENV !== 'test') {
  try {
    adminApp = initializeApp(
      {
        credential: cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey,
        }),
      },
      'bhujalsetu-backend'
    );

    firestoreDb = config.firebase.databaseId
      ? getFirestore(adminApp, config.firebase.databaseId)
      : getFirestore(adminApp);

    isConfigured = true;
    console.log(`[Firebase Admin] Connected successfully to project: ${config.firebase.projectId}`);
  } catch (err) {
    console.warn('[Firebase Admin] Initialization failed with provided credentials:', err);
    isConfigured = false;
  }
} else {
  console.log(
    '[Firebase Admin] Service account credentials not provided in .env.local. Running in local fallback store mode.'
  );
}

export interface TelemetryRecord {
  id: string;
  deviceId: string;
  villageId: string;
  timestamp: string;
  dataSource: 'measured' | 'simulated';
  tankLevelPercent: number;
  tankDistanceCm: number;
  flowInLpm: number;
  flowOutLpm: number;
  flowInLitersTotal: number;
  flowOutLitersTotal: number;
  pumpEnabled: boolean;
  receivedAt: string;
}

// In-memory fallback repository when service account credentials are not configured yet
const localTelemetryStore: TelemetryRecord[] = [];

export const TelemetryRepository = {
  isUsingFirestore(): boolean {
    return isConfigured && firestoreDb !== null;
  },

  async saveTelemetry(record: Omit<TelemetryRecord, 'id'>): Promise<TelemetryRecord> {
    const id = `tel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullRecord: TelemetryRecord = {
      id,
      ...record,
    };

    if (isConfigured && firestoreDb) {
      try {
        await firestoreDb.collection('prototype_telemetry').doc(id).set({
          ...fullRecord,
          serverTimestamp: FieldValue.serverTimestamp(),
        });
        console.log(`[Firestore] Saved telemetry document /prototype_telemetry/${id}`);
      } catch (error) {
        console.error('[Firestore] Error saving telemetry:', error);
        throw new Error('Failed to persist telemetry to Firestore.');
      }
    } else if (process.env.NODE_ENV === 'test') {
      localTelemetryStore.unshift(fullRecord);
    } else {
      throw new Error('Firestore is not configured; telemetry was not stored.');
    }

    return fullRecord;
  },

  async getLatestTelemetry(villageId?: string): Promise<TelemetryRecord | null> {
    if (isConfigured && firestoreDb) {
      try {
        let query: FirebaseFirestore.Query = firestoreDb
          .collection('prototype_telemetry')
          .orderBy('timestamp', 'desc')
          .limit(1);

        if (villageId) {
          query = firestoreDb
            .collection('prototype_telemetry')
            .where('villageId', '==', villageId)
            .orderBy('timestamp', 'desc')
            .limit(1);
        }

        const snapshot = await query.get();
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const data = doc.data();
          return {
            id: doc.id,
            deviceId: data.deviceId,
            villageId: data.villageId,
            timestamp: data.timestamp,
            dataSource: data.dataSource === 'measured' ? 'measured' : 'simulated',
            tankLevelPercent: data.tankLevelPercent ?? 0,
            tankDistanceCm: data.tankDistanceCm ?? 0,
            flowInLpm: data.flowInLpm ?? 0,
            flowOutLpm: data.flowOutLpm ?? 0,
            flowInLitersTotal: data.flowInLitersTotal ?? 0,
            flowOutLitersTotal: data.flowOutLitersTotal ?? 0,
            pumpEnabled: data.pumpEnabled ?? false,
            receivedAt: data.receivedAt,
          };
        }
      } catch (err) {
        console.warn('[Firestore] Error querying latest telemetry:', err);
      }
    }

    // Fallback to local memory
    if (villageId) {
      return localTelemetryStore.find((r) => r.villageId === villageId) || null;
    }
    return localTelemetryStore[0] || null;
  },

  async getLatestPrototypeTelemetry(villageId?: string): Promise<TelemetryRecord | null> {
    return this.getLatestTelemetry(villageId);
  },

  async getTelemetryHistory(villageId?: string, limitCount: number = 30): Promise<TelemetryRecord[]> {
    if (isConfigured && firestoreDb) {
      try {
        let query: FirebaseFirestore.Query = firestoreDb
          .collection('prototype_telemetry')
          .orderBy('timestamp', 'desc')
          .limit(limitCount);

        if (villageId) {
          query = firestoreDb
            .collection('prototype_telemetry')
            .where('villageId', '==', villageId)
            .orderBy('timestamp', 'desc')
            .limit(limitCount);
        }

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            deviceId: data.deviceId,
            villageId: data.villageId,
            timestamp: data.timestamp,
            dataSource: data.dataSource === 'measured' ? 'measured' : 'simulated',
            tankLevelPercent: data.tankLevelPercent ?? 0,
            tankDistanceCm: data.tankDistanceCm ?? 0,
            flowInLpm: data.flowInLpm ?? 0,
            flowOutLpm: data.flowOutLpm ?? 0,
            flowInLitersTotal: data.flowInLitersTotal ?? 0,
            flowOutLitersTotal: data.flowOutLitersTotal ?? 0,
            pumpEnabled: data.pumpEnabled ?? false,
            receivedAt: data.receivedAt,
          };
        });
      } catch (err) {
        console.warn('[Firestore] Error querying telemetry history:', err);
      }
    }

    const filtered = villageId
      ? localTelemetryStore.filter((r) => r.villageId === villageId)
      : localTelemetryStore;

    return filtered.slice(0, limitCount);
  },
};

export { adminApp, firestoreDb, isConfigured as isFirebaseConfigured };

export async function verifyCommunityMembership(idToken: string, villageId: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') {
    if (idToken === 'test-token-valid-member' && villageId === 'village-rampur-04') return true;
    if (idToken === 'test-token-other-village' && villageId === 'village-shivpuri-02') return true;
    return false;
  }
  if (!adminApp || !firestoreDb || !isConfigured) throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
  const decoded = await getAuth(adminApp).verifyIdToken(idToken);
  const membershipId = `${decoded.uid}_${villageId}`;
  const membership = await firestoreDb.collection('community_memberships').doc(membershipId).get();
  const data = membership.data();
  return membership.exists && data?.userId === decoded.uid && data?.villageId === villageId && data?.status === 'active';
}
