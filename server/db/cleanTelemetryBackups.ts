/**
 * Administrator-only Clean Telemetry Backups Tool
 *
 * Requirements:
 * - Allows administrators to inspect and safely delete raw sensor telemetry JSON backups
 *   generated in the exports/ directory by "npm run telemetry:purge".
 * - Raw telemetry backups remain on disk until explicitly deleted with this command.
 * - Requires explicit confirmation (--confirm).
 * - Only operates on files strictly matching "telemetry_export_*.json" inside exports/.
 * - Never deletes database rows, user accounts, code, or configuration.
 *
 * Usage:
 *   # List all existing telemetry backup files:
 *   npm run telemetry:clean-backups -- --list
 *
 *   # Preview deletion of all backups without deleting:
 *   npm run telemetry:clean-backups -- --all --dry-run
 *
 *   # Safely delete a specific backup file after review:
 *   npm run telemetry:clean-backups -- --file telemetry_export_2026-11-20T...json --confirm
 *
 *   # Safely delete all export backups:
 *   npm run telemetry:clean-backups -- --all --confirm
 */

import fs from 'fs';
import path from 'path';

interface CleanOptions {
  list: boolean;
  file?: string;
  all: boolean;
  confirm: boolean;
  dryRun: boolean;
  exportDir: string;
}

function parseArgs(args: string[]): CleanOptions {
  const options: CleanOptions = {
    list: false,
    all: false,
    confirm: false,
    dryRun: false,
    exportDir: path.resolve(process.cwd(), 'exports'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--list') {
      options.list = true;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--file' && args[i + 1]) {
      options.file = path.basename(args[++i]); // Ensure no directory traversal
    } else if (arg === '--export-dir' && args[i + 1]) {
      options.exportDir = path.resolve(process.cwd(), args[++i]);
    }
  }

  return options;
}

export function getTelemetryBackupFiles(exportDir: string): string[] {
  if (!fs.existsSync(exportDir)) {
    return [];
  }
  const files = fs.readdirSync(exportDir);
  return files.filter(
    (f) => f.startsWith('telemetry_export_') && f.endsWith('.json')
  );
}

export function cleanTelemetryBackups(options: CleanOptions): {
  foundCount: number;
  deletedCount: number;
  deletedFiles: string[];
} {
  if (!fs.existsSync(options.exportDir)) {
    console.log(`[Backup Cleaner] Exports directory does not exist: ${options.exportDir}`);
    console.log('[Backup Cleaner] No telemetry backups found on disk.');
    return { foundCount: 0, deletedCount: 0, deletedFiles: [] };
  }

  const allBackups = getTelemetryBackupFiles(options.exportDir);

  if (options.list || (!options.file && !options.all)) {
    console.log(`[Backup Cleaner] Scanning telemetry export files in: ${options.exportDir}`);
    if (allBackups.length === 0) {
      console.log('[Backup Cleaner] No telemetry backup files found.');
    } else {
      console.log(`[Backup Cleaner] Found ${allBackups.length} telemetry backup file(s):`);
      for (const file of allBackups) {
        const fullPath = path.join(options.exportDir, file);
        const stats = fs.statSync(fullPath);
        const sizeKb = (stats.size / 1024).toFixed(1);
        console.log(`  - ${file} (${sizeKb} KB, created: ${stats.mtime.toISOString()})`);
      }
      console.log('\nTo safely delete a backup file:');
      console.log('  npm run telemetry:clean-backups -- --file <filename> --confirm');
      console.log('To safely delete all backup files:');
      console.log('  npm run telemetry:clean-backups -- --all --confirm');
    }
    return { foundCount: allBackups.length, deletedCount: 0, deletedFiles: [] };
  }

  let targets: string[] = [];
  if (options.file) {
    if (!options.file.startsWith('telemetry_export_') || !options.file.endsWith('.json')) {
      throw new Error(`Invalid backup filename "${options.file}". Only telemetry_export_*.json files can be targeted.`);
    }
    if (!allBackups.includes(options.file)) {
      throw new Error(`File "${options.file}" was not found in ${options.exportDir}.`);
    }
    targets = [options.file];
  } else if (options.all) {
    targets = allBackups;
  }

  if (targets.length === 0) {
    console.log('[Backup Cleaner] No matching backup files found to delete.');
    return { foundCount: 0, deletedCount: 0, deletedFiles: [] };
  }

  if (!options.confirm && !options.dryRun) {
    throw new Error(
      `Safety check failed: Pass --confirm to delete ${targets.length} backup file(s), or --dry-run to preview.`
    );
  }

  if (options.dryRun) {
    console.log(`[Backup Cleaner] DRY RUN: Would delete ${targets.length} backup file(s):`);
    for (const t of targets) {
      console.log(`  - [WOULD DELETE] ${t}`);
    }
    return { foundCount: targets.length, deletedCount: 0, deletedFiles: [] };
  }

  const deletedFiles: string[] = [];
  for (const t of targets) {
    const fullPath = path.join(options.exportDir, t);
    fs.unlinkSync(fullPath);
    deletedFiles.push(t);
    console.log(`[Backup Cleaner] Deleted backup: ${t}`);
  }

  console.log(`[Backup Cleaner] Successfully removed ${deletedFiles.length} backup file(s).`);
  console.log(`[Backup Cleaner] PostgreSQL database, user profiles, and application code were not modified.`);
  return { foundCount: targets.length, deletedCount: deletedFiles.length, deletedFiles };
}

if (process.argv[1]?.endsWith('cleanTelemetryBackups.ts')) {
  try {
    const options = parseArgs(process.argv.slice(2));
    cleanTelemetryBackups(options);
    process.exit(0);
  } catch (err: any) {
    console.error('[Backup Cleaner Error]', err.message);
    process.exit(1);
  }
}
