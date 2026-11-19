import { spawn } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local first if it exists, then fallback to .env (matching server/config.ts)
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const backendPort = process.env.PORT || '5001';
const frontendPort = process.env.VITE_PORT || '3000';

console.log('[Dev Runner] Starting BhujalSetu local development environment...');
console.log(`[Dev Runner] - Express API backend on http://localhost:${backendPort}`);
console.log(`[Dev Runner] - Vite frontend on http://localhost:${frontendPort}`);

if (!process.env.JWT_SECRET) {
  console.warn('\n[Prerequisite Notice] JWT_SECRET is not set in your environment.');
  console.warn('The Express backend requires JWT_SECRET (min 32 chars) in .env.local to issue authentication tokens.');
  console.warn('Example: Add JWT_SECRET="your-32-plus-character-secret" to .env.local\n');
}

const server = spawn('npm', ['run', 'server'], {
  stdio: 'inherit',
  env: process.env,
});

const vite = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  env: process.env,
});

let isShuttingDown = false;

function cleanup(code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n[Dev Runner] Shutting down development servers...');
  try {
    server.kill('SIGINT');
  } catch {}
  try {
    vite.kill('SIGINT');
  } catch {}

  setTimeout(() => {
    process.exit(code);
  }, 500);
}

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));

server.on('exit', (code) => {
  if (!isShuttingDown && code !== null && code !== 0) {
    console.error(`[Dev Runner] Express server exited with code ${code}`);
    cleanup(code);
  }
});

vite.on('exit', (code) => {
  if (!isShuttingDown && code !== null && code !== 0) {
    console.error(`[Dev Runner] Vite server exited with code ${code}`);
    cleanup(code);
  }
});
