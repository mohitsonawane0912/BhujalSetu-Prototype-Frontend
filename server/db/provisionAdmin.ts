/**
 * Safe Administrator Provisioning CLI Tool for BhujalSetu Local PostgreSQL
 *
 * Requirements:
 * - Bootstraps the first administrator account safely.
 * - Prompts for password privately (no command-line --password argument) to prevent
 *   passwords from being stored in shell history (~/.zsh_history) or exposed in
 *   process listings (`ps aux`).
 * - Activates or approves pending community memberships.
 * - Never prints passwords or JWT secrets to stdout/stderr.
 *
 * Usage:
 *   # Create new administrator (prompts privately for password):
 *   npm run admin:provision -- --email "admin@rampur.in" --name "Panchayat Admin" --villageId "village-rampur-04"
 *
 *   # Activate existing user's pending membership:
 *   npm run admin:provision -- --email "user@rampur.in" --villageId "village-rampur-04" --activate
 */

import readline from 'readline';
import { AuthService } from '../authService';
import { checkConnection, closePool } from './postgres';
import { config } from '../config';

interface ProvisionArgs {
  email?: string;
  name?: string;
  villageId: string;
  role: string;
  activate: boolean;
}

function parseArgs(args: string[]): ProvisionArgs {
  const result: ProvisionArgs = {
    villageId: 'village-rampur-04',
    role: 'admin',
    activate: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--password') {
      console.error('\n[Security Error] Passing passwords via --password in command-line arguments is disallowed.');
      console.error('This prevents credentials from leaking into shell history (~/.zsh_history) or process listings (ps aux).');
      console.error('\nUsage: Run without --password to be prompted privately and securely:');
      console.error('  npm run admin:provision -- --email "admin@rampur.in" --name "Admin Name" --villageId "village-rampur-04"\n');
      process.exit(1);
    } else if (arg === '--email' && args[i + 1]) {
      result.email = args[++i];
    } else if (arg === '--name' && args[i + 1]) {
      result.name = args[++i];
    } else if (arg === '--villageId' && args[i + 1]) {
      result.villageId = args[++i];
    } else if (arg === '--role' && args[i + 1]) {
      result.role = args[++i];
    } else if (arg === '--activate') {
      result.activate = true;
    }
  }

  return result;
}

function promptPasswordSecurely(promptMessage: string): Promise<string> {
  // Allow non-interactive scripts/tests to supply password via environment variable
  if (process.env.ADMIN_PASSWORD) {
    return Promise.resolve(process.env.ADMIN_PASSWORD);
  }

  if (!process.stdin.isTTY) {
    // Non-interactive piped input (e.g. echo "secret" | npm run admin:provision ...)
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });
      process.stdout.write(promptMessage);
      rl.once('line', (line) => {
        rl.close();
        resolve(line.trim());
      });
    });
  }

  // Interactive TTY: mask password input completely (no characters echoed to console)
  return new Promise((resolve) => {
    process.stdout.write(promptMessage);
    let password = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (ch: string) => {
      const code = ch.charCodeAt(0);
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password.trim());
      } else if (ch === '\u0003') {
        // Handle Ctrl+C cleanly
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        process.exit(130);
      } else if (code === 8 || code === 127) {
        // Handle backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
        }
      } else {
        password += ch;
      }
    };

    process.stdin.on('data', onData);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email) {
    console.error('Error: --email <user_email> is required.');
    console.log('\nUsage Examples:');
    console.log('  # Provision first administrator (prompts securely for password):');
    console.log('  npm run admin:provision -- --email "admin@rampur.in" --name "Admin Name" --villageId "village-rampur-04"');
    console.log('  # Approve/activate existing registered member:');
    console.log('  npm run admin:provision -- --email "resident@rampur.in" --villageId "village-rampur-04" --activate');
    process.exit(1);
  }

  const ok = await checkConnection();
  if (!ok) {
    console.error(`Error: Cannot connect to PostgreSQL at ${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`);
    process.exit(1);
  }

  if (args.activate) {
    const success = await AuthService.activateMembership(args.email, args.villageId, args.role || 'resident');
    if (!success) {
      console.error(`User with email "${args.email}" was not found in the database. Please register first or run without --activate to create an account.`);
      process.exit(1);
    }
    console.log(`[Admin Provisioning] Successfully activated active community membership for "${args.email}" in village "${args.villageId}".`);
    return;
  }

  // Creating a new administrator: prompt privately for password
  const password = await promptPasswordSecurely('Enter administrator password (hidden): ');
  if (!password || password.length < 8) {
    console.error('Error: Administrator password must be at least 8 characters long.');
    process.exit(1);
  }

  if (process.stdin.isTTY && !process.env.ADMIN_PASSWORD) {
    const confirm = await promptPasswordSecurely('Confirm administrator password (hidden): ');
    if (password !== confirm) {
      console.error('Error: Passwords do not match. Provisioning aborted.');
      process.exit(1);
    }
  }

  const result = await AuthService.provisionUser({
    email: args.email,
    password,
    displayName: args.name || 'Administrator',
    villageId: args.villageId,
    role: args.role,
    status: 'active',
  });

  console.log(`[Admin Provisioning] Successfully provisioned administrator account:`);
  console.log(`  User ID:    ${result.user.id}`);
  console.log(`  Email:      ${result.user.email}`);
  console.log(`  Role:       ${result.user.role}`);
  console.log(`  Village ID: ${result.user.communityId}`);
  console.log(`  Membership: active`);
  console.log(`  Password:   [SECURELY HASHED - NOT DISPLAYED]`);
}

if (process.argv[1]?.endsWith('provisionAdmin.ts')) {
  main()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Admin Provisioning Error]', err.message);
      closePool().finally(() => process.exit(1));
    });
}
