/**
 * Administrator-only Export and Purge Tool for Raw Prototype Node Telemetry
 *
 * Requirements:
 * - Deletes raw sensor records only from prototype_node_telemetry.
 * - Does NOT delete user accounts, community data, actions, pledges, or code/config.
 * - Requires explicit cutoff timestamp (--cutoff <ISO_DATE>) or --all.
 * - Requires explicit --confirm flag to prevent accidental execution.
 * - Exports records to JSON backup before deletion.
 *
 * Usage:
 *   npm run telemetry:purge -- --cutoff "2026-11-20T00:00:00Z" --confirm
 *   npm run telemetry:purge -- --all --confirm
 *   npm run telemetry:purge -- --all --dry-run
 */

import fs from 'fs';
import path from 'path';
import { query, closePool, checkConnection } from './postgres';

interface PurgeOptions {
  cutoff?: string;
  all: boolean;
  confirm: boolean;
  dryRun: boolean;
  exportDir: string;
}

function parseArgs(args: string[]): PurgeOptions {
  const options: PurgeOptions = {
    all: false,
    confirm: false,
    dryRun: false,
    exportDir: path.resolve(process.cwd(), 'exports'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all') {
      options.all = true;
    } else if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--cutoff' && args[i + 1]) {
      options.cutoff = args[++i];
    } else if (arg === '--export-dir' && args[i + 1]) {
      options.exportDir = path.resolve(process.cwd(), args[++i]);
    }
  }

  return options;
}

export async function exportAndPurgeTelemetry(options: PurgeOptions): Promise<{
  exportedCount: number;
  deletedCount: number;
  exportFile?: string;
}> {
  if (!options.all && !options.cutoff) {
    throw new Error(
      'Safety check failed: You must specify either --cutoff "<ISO_TIMESTAMP>" or --all to purge telemetry.'
    );
  }

  if (!options.confirm && !options.dryRun) {
    throw new Error(
      'Safety check failed: Confirmation required. Pass --confirm to execute the purge, or --dry-run to preview.'
    );
  }

  const ok = await checkConnection();
  if (!ok) {
    throw new Error('PostgreSQL database is unreachable. Purge aborted.');
  }

  let selectSql = 'SELECT * FROM prototype_node_telemetry';
  let deleteSql = 'DELETE FROM prototype_node_telemetry';
  const params: any[] = [];

  if (options.cutoff) {
    const cutoffDate = new Date(options.cutoff);
    if (isNaN(cutoffDate.getTime())) {
      throw new Error(`Invalid ISO timestamp provided for --cutoff: "${options.cutoff}"`);
    }
    selectSql += ' WHERE captured_at <= $1 ORDER BY captured_at ASC';
    deleteSql += ' WHERE captured_at <= $1';
    params.push(cutoffDate.toISOString());
  } else {
    selectSql += ' ORDER BY captured_at ASC';
  }

  console.log(`[Telemetry Purge] Querying matching telemetry records...`);
  const selectRes = await query(selectSql, params);
  const records = selectRes.rows;
  const count = records.length;

  console.log(`[Telemetry Purge] Found ${count} raw sensor records matching criteria.`);

  if (count === 0) {
    console.log('[Telemetry Purge] No records found. Nothing to purge.');
    return { exportedCount: 0, deletedCount: 0 };
  }

  // 1. Export backup first before any deletion
  if (!fs.existsSync(options.exportDir)) {
    fs.mkdirSync(options.exportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportFileName = `telemetry_export_${timestamp}.json`;
  const exportFilePath = path.join(options.exportDir, exportFileName);

  fs.writeFileSync(exportFilePath, JSON.stringify(records, null, 2), 'utf8');
  console.log(`[Telemetry Purge] Successfully exported ${count} records to ${exportFilePath}`);
  console.log(`[Telemetry Purge] NOTICE: This backup file contains raw sensor records on local storage.`);
  console.log(`[Telemetry Purge] The backup is safely preserved and will NOT be automatically deleted.`);
  console.log(`[Telemetry Purge] When you no longer need this backup, inspect and delete it explicitly via:`);
  console.log(`  npm run telemetry:clean-backups -- --file "${exportFileName}" --confirm`);
  console.log(`  (or run: npm run telemetry:clean-backups -- --all --confirm)`);

  if (options.dryRun) {
    console.log(`[Telemetry Purge] DRY RUN MODE: No records were deleted from PostgreSQL.`);
    return { exportedCount: count, deletedCount: 0, exportFile: exportFilePath };
  }

  // 2. Perform safe deletion
  const deleteRes = await query(deleteSql, params);
  const deleted = deleteRes.rowCount || 0;
  console.log(`[Telemetry Purge] Successfully deleted ${deleted} records from prototype_node_telemetry table.`);
  console.log(`[Telemetry Purge] Project configuration, users, and community data remain untouched.`);

  return { exportedCount: count, deletedCount: deleted, exportFile: exportFilePath };
}

if (process.argv[1]?.endsWith('purgeTelemetry.ts')) {
  const options = parseArgs(process.argv.slice(2));
  exportAndPurgeTelemetry(options)
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Telemetry Purge Error]', err.message);
      closePool().finally(() => process.exit(1));
    });
}
