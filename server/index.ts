import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import telemetryRoutes from './routes/telemetryRoutes';
import nodeTelemetryRoutes from './routes/nodeTelemetryRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import authRoutes from './routes/authRoutes';
import waterCreditsRoutes from './routes/waterCreditsRoutes';

const app = express();

// Middleware: JSON parser with payload limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS headers for prototype development
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-device-api-key');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Request logger for development
app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`[HTTP] ${req.method} ${req.path} ${_res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', telemetryRoutes);
app.use('/api', nodeTelemetryRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', waterCreditsRoutes);

// Root fallback
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'BhujalSetu Groundwater Intelligence API',
    version: '1.0.0-prototype',
    endpoints: [
      'GET  /api/health',
      'POST /api/telemetry (ESP32 sensor intake)',
      'POST /api/v1/telemetry (one ESP32 node per packet)',
      'GET  /api/v1/telemetry?villageId=... (prototype history)',
      'GET  /api/prototype/telemetry/latest',
      'GET  /api/groundwater',
      'GET  /api/water-balance',
      'GET  /api/trends',
      'GET  /api/alerts',
      'GET  /api/actions',
      'POST /api/ai/advice (Gemini groundwater advisor)',
    ],
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.path,
  });
});

// Global Error Handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]:', err);
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message,
  });
});

import { fileURLToPath } from 'url';
import { checkConnection } from './db/postgres';

// Start listening if running directly
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain && process.env.NODE_ENV !== 'test') {
  app.listen(config.port, '0.0.0.0', async () => {
    console.log(`=======================================================`);
    console.log(`BhujalSetu Node.js/Express Backend running on port ${config.port}`);
    console.log(`Bound to:        0.0.0.0 (Accessible to local network devices)`);
    console.log(`Health endpoint: http://localhost:${config.port}/api/health`);
    console.log(`Telemetry URL:   http://localhost:${config.port}/api/v1/telemetry`);

    const pgOk = await checkConnection();
    if (pgOk) {
      console.log(`Database:        Connected to PostgreSQL (${config.postgres.database})`);
    } else {
      console.warn(`-------------------------------------------------------`);
      console.warn(`[Prerequisite Alert: PostgreSQL Disconnected]`);
      console.warn(`Could not connect to PostgreSQL on ${config.postgres.host}:${config.postgres.port}/${config.postgres.database}.`);
      console.warn(`Troubleshooting:`);
      console.warn(`  1. Start PostgreSQL: brew services start postgresql@16`);
      console.warn(`  2. Check status:     pg_isready -h ${config.postgres.host} -p ${config.postgres.port} -d ${config.postgres.database}`);
      console.warn(`  3. Run migrations:   npm run db:migrate`);
      console.warn(`-------------------------------------------------------`);
    }
    console.log(`=======================================================`);
  });
}

export default app;
