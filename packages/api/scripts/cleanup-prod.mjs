import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import Redis from 'ioredis';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../../.env');

function loadEnv(path) {
  const content = readFileSync(path, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    let val = trimmed.slice(eqIdx + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function buildPool(databaseUrl) {
  const useSSL = databaseUrl.includes('sslmode=require') || databaseUrl.includes('digitalocean');
  const cleanUrl = databaseUrl.replace(/[?&]sslmode=[^&]+/, (m) => (m.startsWith('?') ? '?' : '')).replace(/\?$/, '');
  return new pg.Pool({
    connectionString: cleanUrl,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
  });
}

function buildRedis(redisUrl) {
  return new Redis(redisUrl, {
    tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: 3,
  });
}

// --- Main ---

const env = loadEnv(envPath);
const { DATABASE_URL, REDIS_URL } = env;

if (!DATABASE_URL || !REDIS_URL) {
  process.stderr.write('ERROR: Missing DATABASE_URL or REDIS_URL in .env\n');
  process.exit(1);
}

// Tables in FK-safe deletion order (children first, parents last)
const tables = [
  'risk_events',
  'risk_controls',
  'portfolio_snapshots',
  'day_trades',
  'fills',
  'borrows',
  'positions',
  'orders',
  'cuid_users',
  'api_keys',
  'borrow_fee_tiers',
];

// Step 0: Preview
process.stdout.write('\nAlgoArena Production Cleanup\n');
process.stdout.write('============================\n\n');

const pool = buildPool(DATABASE_URL);

process.stdout.write('Current row counts:\n');
for (const table of tables) {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  process.stdout.write(`  ${table}: ${rows[0].count}\n`);
}

process.stdout.write('\nThis will:\n');
process.stdout.write('  1. DELETE all rows from the tables above\n');
process.stdout.write('  2. FLUSH the entire Valkey cache\n');
process.stdout.write('  3. ROTATE the MASTER_KEY in .env\n\n');

const answer = await ask('This is IRREVERSIBLE on production. Type "yes" to continue: ');
if (answer !== 'yes') {
  process.stdout.write('Aborted.\n');
  await pool.end();
  process.exit(0);
}

// Step 1: PostgreSQL cleanup
process.stdout.write('\n[1/3] Cleaning PostgreSQL...\n');

for (const table of tables) {
  const result = await pool.query(`DELETE FROM ${table}`);
  process.stdout.write(`  ${table}: ${result.rowCount} rows deleted\n`);
}

await pool.end();
process.stdout.write('  Done.\n');

// Step 2: Flush Valkey
process.stdout.write('\n[2/3] Flushing Valkey cache...\n');

const redis = buildRedis(REDIS_URL);
await redis.flushall();
process.stdout.write('  Cache flushed.\n');
await redis.quit();

// Step 3: Rotate MASTER_KEY
process.stdout.write('\n[3/3] Rotating MASTER_KEY...\n');

const newKey = randomBytes(32).toString('hex');
let envContent = readFileSync(envPath, 'utf-8');
envContent = envContent.replace(/^MASTER_KEY=.*$/m, `MASTER_KEY=${newKey}`);
writeFileSync(envPath, envContent);
process.stdout.write(`  New key: ${newKey.slice(0, 8)}...${newKey.slice(-8)}\n`);
process.stdout.write('  NOTE: Update MASTER_KEY on the production server as well.\n');

process.stdout.write('\nCleanup complete. Restart the API server to pick up the new MASTER_KEY.\n\n');
