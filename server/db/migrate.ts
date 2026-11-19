import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, closePool, checkConnection } from './postgres';
import { config } from '../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(requireEmpty = false): Promise<{
  tables: Array<{ name: string; count: number }>;
  isEmpty: boolean;
}> {
  console.log(
    `[Database Migration] Connecting to PostgreSQL (${config.postgres.user}@${config.postgres.host}:${config.postgres.port}/${config.postgres.database})...`
  );

  const ok = await checkConnection();
  if (!ok) {
    throw new Error(
      `Cannot connect to PostgreSQL at ${config.postgres.host}:${config.postgres.port}/${config.postgres.database}. Please ensure PostgreSQL is installed and the service is running.`
    );
  }

  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[Database Migration] Applying schema.sql DDL...');
  await query(sql);

  // Target application tables
  const expectedTables = [
    'communities',
    'users',
    'community_memberships',
    'prototype_node_telemetry',
    'community_advisor_snapshots',
    'community_actions',
    'water_pledges',
    'field_observations',
    'community_water_credits_ledger',
  ];

  console.log('\n[Database Migration] Verifying table schemas and real row counts:');
  const tableCounts: Array<{ name: string; count: number }> = [];
  let totalRows = 0;

  for (const tableName of expectedTables) {
    const res = await query<{ count: string }>(`SELECT COUNT(*) FROM "${tableName}";`);
    const count = parseInt(res.rows[0].count, 10);
    tableCounts.push({ name: tableName, count });
    totalRows += count;
    console.log(`  - ${tableName.padEnd(26)} : ${count} rows`);
  }

  const isEmpty = totalRows === 0;

  if (isEmpty) {
    console.log(
      `\n[Database Migration] VERIFICATION PASSED: All ${expectedTables.length} competition tables exist and are confirmed completely empty (0 rows total).`
    );
    console.log('[Database Migration] The database is ready to record genuine measured telemetry from physical ESP32 nodes.\n');
  } else {
    console.warn(
      `\n[Database Migration WARNING] Database is NOT empty. Detected ${totalRows} existing record(s) in competition tables.`
    );
    const nonEmptyTables = tableCounts.filter((t) => t.count > 0);
    console.warn(
      `Non-empty tables: ${nonEmptyTables.map((t) => `${t.name} (${t.count})`).join(', ')}`
    );
    console.warn(
      '[Database Migration WARNING] All existing rows were preserved (no data was silently deleted).'
    );
    console.warn(
      '[Database Migration WARNING] The competition database is intended to start completely empty. Use "npm run telemetry:purge -- --all --confirm" to export and purge raw sensor packets if preparing for a clean run.\n'
    );

    if (requireEmpty || process.argv.includes('--require-empty')) {
      throw new Error(
        `[Database Migration Error] Strict empty verification failed: ${totalRows} records exist in application tables.`
      );
    }
  }

  return { tables: tableCounts, isEmpty };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const requireEmpty = process.argv.includes('--require-empty');
  runMigrations(requireEmpty)
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Database Migration Failed]', err.message);
      closePool().finally(() => process.exit(1));
    });
}
