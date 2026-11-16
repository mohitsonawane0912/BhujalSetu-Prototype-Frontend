import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import firebaseAppletConfig from '../firebase-applet-config.json';

// Load .env.local first if it exists, then fallback to .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Support both direct env vars and FIREBASE_SERVICE_ACCOUNT_PATH
let serviceAccountEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
let serviceAccountKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
let serviceAccountProjectId = process.env.FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || 'gen-lang-client-0038143503';
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '';

if (serviceAccountPath) {
  const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
  if (fs.existsSync(resolvedPath)) {
    try {
      const sa = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      if (sa.client_email) serviceAccountEmail = sa.client_email;
      if (sa.private_key) serviceAccountKey = sa.private_key;
      if (sa.project_id) serviceAccountProjectId = sa.project_id;
    } catch (err) {
      console.warn(`[Firebase Admin] Could not parse service account JSON at ${resolvedPath}:`, err);
    }
  } else {
    console.warn(`[Firebase Admin] Service account file not found at ${resolvedPath}`);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  deviceApiKey: process.env.DEVICE_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  firebase: {
    projectId: serviceAccountProjectId,
    clientEmail: serviceAccountEmail,
    privateKey: serviceAccountKey,
    serviceAccountPath: serviceAccountPath,
    databaseId: (firebaseAppletConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId || '',
  },
  appUrl: process.env.APP_URL || 'http://localhost:3000',
};
