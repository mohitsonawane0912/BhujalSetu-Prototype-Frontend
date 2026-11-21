import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

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

function resolveJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || '').trim();

  const isPlaceholder = (val: string): boolean => {
    const lower = val.toLowerCase();
    return (
      lower === 'replace-with-a-random-secret-key-at-least-32-chars-long' ||
      lower === 'your_jwt_secret_here' ||
      lower === 'bhujalsetu_local_postgres_auth_secret_salt_2026' ||
      lower === 'your_secret_here' ||
      lower === 'changeme' ||
      lower === 'secret' ||
      lower.includes('placeholder') ||
      lower.includes('replace-with')
    );
  };

  if (process.env.NODE_ENV === 'test') {
    if (!secret || isPlaceholder(secret) || secret.length < 32) {
      return 'test_only_isolated_jwt_secret_minimum_32_characters_for_unit_tests';
    }
    return secret;
  }

  if (!secret) {
    throw new Error(
      `\n================================================================================
[Prerequisite Missing: JWT_SECRET]
A secure JWT_SECRET is required to sign local authentication tokens.

Setup Instructions:
1. Open or create .env.local in the repository root.
2. Add a strong, random secret of at least 32 characters:
   JWT_SECRET="your-unique-random-32-plus-character-secret-key-goes-here"
   (Tip: Generate one with: openssl rand -base64 32)
3. Ensure .env.local is saved (it is Git-ignored and kept local).
4. Restart the backend or run 'npm run dev:all'.
================================================================================\n`
    );
  }

  if (isPlaceholder(secret)) {
    throw new Error(
      `\n================================================================================
[Prerequisite Notice: Placeholder JWT_SECRET]
The configured JWT_SECRET in .env.local is set to an unconfigured placeholder.

Setup Instructions:
1. Open .env.local in your editor.
2. Replace the placeholder value with a unique, random string of at least 32 characters.
3. Restart the backend.
================================================================================\n`
    );
  }

  if (secret.length < 32) {
    throw new Error(
      `\n================================================================================
[Prerequisite Notice: JWT_SECRET Too Short]
The configured JWT_SECRET is ${secret.length} characters long.
HMAC-SHA256 signing requires at least 32 characters for security.

Setup Instructions:
1. Open .env.local and lengthen JWT_SECRET to at least 32 characters.
2. Restart the backend.
================================================================================\n`
    );
  }

  return secret;
}

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  deviceApiKey: process.env.DEVICE_API_KEY || '',
  node1DeviceApiKey: process.env.NODE_1_DEVICE_API_KEY || '',
  node2DeviceApiKey: process.env.NODE_2_DEVICE_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  jwtSecret: resolveJwtSecret(),
  postgres: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'bhujalsetu_dev',
    user: process.env.PGUSER || process.env.USER || 'postgres',
    password: process.env.PGPASSWORD || '',
    connectionString: process.env.DATABASE_URL || '',
  },
  appUrl: process.env.APP_URL || 'http://localhost:3000',
};
