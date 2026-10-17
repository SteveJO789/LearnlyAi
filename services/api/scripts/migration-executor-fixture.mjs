import pg from 'pg';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const ALLOWED_LOCAL_PORTS = new Set(['55432', '55434', '54322']);
const ALLOWED_LOCAL_USERS = new Set(['learnly_qa', 'postgres']);
const FIXTURE_PREFIX = 'learnly_activation_executor_';

function assertLocalUrl(url, { maintenance = false } = {}) {
  const allowedPort = process.env.MIGRATION_EXECUTOR_ALLOWED_PORT;
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.search || url.hash) {
    throw new Error('Refusing a connection URL with an unexpected protocol, query string, or fragment.');
  }
  if (!ALLOWED_LOCAL_USERS.has(decodeURIComponent(url.username))) {
    throw new Error('Refusing a PostgreSQL user outside the approved local fixture-admin allowlist.');
  }
  if (!LOOPBACK_HOSTS.has(url.hostname) || !allowedPort || !ALLOWED_LOCAL_PORTS.has(allowedPort) || url.port !== allowedPort) {
    throw new Error(`Refusing non-loopback or unexpected PostgreSQL target (host=${url.hostname}, port=${url.port || '(default)'}).`);
  }
  if (maintenance && url.pathname !== '/postgres') throw new Error('Admin URL must connect to the local `postgres` maintenance database.');
  if (!maintenance) {
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (!databaseName.startsWith(FIXTURE_PREFIX) || databaseName.length > 63) {
      throw new Error(`Refusing non-fixture database; name must start with ${FIXTURE_PREFIX} and fit PostgreSQL's 63-byte identifier limit.`);
    }
  }
}

export function assertFixtureDatabaseUrl(url) {
  assertLocalUrl(url);
}

export function readFixtureAdminUrl() {
  const raw = process.env.MIGRATION_EXECUTOR_ADMIN_URL;
  if (!raw) throw new Error('Set MIGRATION_EXECUTOR_ADMIN_URL to a disposable local PostgreSQL admin URL.');
  if (process.env.MIGRATION_EXECUTOR_CONFIRM !== 'CREATE_LOCAL_FIXTURES') {
    throw new Error('Set MIGRATION_EXECUTOR_CONFIRM=CREATE_LOCAL_FIXTURES to authorize creation of uniquely named local fixture databases.');
  }

  const url = new URL(raw);
  assertLocalUrl(url, { maintenance: true });
  return url;
}

export function fixtureDatabaseName(label, now = new Date()) {
  const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9_]+/gu, '_').replace(/^_+|_+$/gu, '');
  const stamp = now.toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14);
  const suffix = `_${stamp}_${process.pid}`;
  const maxLabelLength = 63 - FIXTURE_PREFIX.length - suffix.length;
  const databaseName = `${FIXTURE_PREFIX}${safeLabel.slice(0, maxLabelLength)}${suffix}`;
  if (Buffer.byteLength(databaseName, 'utf8') > 63) throw new Error('Generated fixture database name exceeds PostgreSQL identifier limit.');
  return databaseName;
}

export async function createFixtureDatabase(adminUrl, databaseName) {
  assertLocalUrl(adminUrl, { maintenance: true });
  if (!databaseName.startsWith(FIXTURE_PREFIX) || !/^[_a-z0-9]+$/u.test(databaseName) || Buffer.byteLength(databaseName, 'utf8') > 63) {
    throw new Error(`Refusing database name outside ${FIXTURE_PREFIX} namespace.`);
  }
  const { Client } = pg;
  const client = new Client({ connectionString: adminUrl.toString(), application_name: 'learnly-migration-executor-fixture' });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (existing.rowCount) throw new Error(`Fixture database already exists; refusing to reuse it: ${databaseName}`);
    await client.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0`);
  } finally {
    await client.end();
  }
  const dbUrl = new URL(adminUrl);
  dbUrl.pathname = `/${databaseName}`;
  return dbUrl;
}

export async function cloneLocalFoundationDatabase(adminUrl, databaseName) {
  assertLocalUrl(adminUrl, { maintenance: true });
  if (!databaseName.startsWith(FIXTURE_PREFIX) || !/^[_a-z0-9]+$/u.test(databaseName) || Buffer.byteLength(databaseName, 'utf8') > 63) {
    throw new Error(`Refusing database name outside ${FIXTURE_PREFIX} namespace.`);
  }
  const { Client } = pg;
  const client = new Client({ connectionString: adminUrl.toString(), application_name: 'learnly-migration-executor-foundation-clone' });
  await client.connect();
  try {
    const active = await client.query(`SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname = 'postgres' AND pid <> pg_backend_pid()`);
    if (active.rows[0].count !== 0) throw new Error('Refusing to clone base postgres while another local connection is active.');
    const baseState = await client.query(`SELECT
      to_regclass('prisma_contract.marker') IS NOT NULL AS has_app_marker,
      to_regclass('public."User"') IS NOT NULL AS has_app_user,
      to_regclass('auth.users') IS NOT NULL AS has_auth_users,
      to_regclass('storage.objects') IS NOT NULL AS has_storage_objects`);
    const state = baseState.rows[0];
    if (state.has_app_marker || state.has_app_user) {
      throw new Error('Refusing to clone base postgres after application schema or marker data has been applied.');
    }
    if (state.has_auth_users) {
      const authRows = await client.query('SELECT count(*)::int AS count FROM auth.users');
      if (authRows.rows[0].count !== 0) throw new Error('Refusing to clone base postgres with Auth user data.');
    }
    if (state.has_storage_objects) {
      const storageRows = await client.query('SELECT count(*)::int AS count FROM storage.objects');
      if (storageRows.rows[0].count !== 0) throw new Error('Refusing to clone base postgres with Storage object data.');
    }
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (existing.rowCount) throw new Error(`Fixture database already exists; refusing to reuse it: ${databaseName}`);
    await client.query(`CREATE DATABASE "${databaseName}" TEMPLATE postgres`);
  } finally {
    await client.end();
  }
  const dbUrl = new URL(adminUrl);
  dbUrl.pathname = `/${databaseName}`;
  return dbUrl;
}

export async function provisionLocalSupabaseCompatibleFoundation(dbUrl) {
  assertLocalUrl(dbUrl);
  const { Client } = pg;
  const client = new Client({ connectionString: dbUrl.toString(), application_name: 'learnly-migration-executor-bootstrap' });
  await client.connect();
  try {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const found = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
      if (!found.rowCount) await client.query(`CREATE ROLE "${role}" NOLOGIN`);
    }
    await client.query('CREATE SCHEMA IF NOT EXISTS auth');
    const authUid = await client.query("SELECT to_regprocedure('auth.uid()') IS NOT NULL AS present");
    if (!authUid.rows[0].present) {
      await client.query(`CREATE FUNCTION auth.uid() RETURNS uuid
        LANGUAGE sql STABLE AS $$ SELECT COALESCE(
          NULLIF(current_setting('request.jwt.claim.sub', true), ''),
          NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
        )::uuid $$`);
    }
    await client.query('BEGIN');
    try {
      await client.query("SELECT set_config('request.jwt.claims', '{\"sub\":\"11111111-1111-4111-8111-111111111111\"}', true)");
      const uidCheck = await client.query("SELECT auth.uid()::text AS uid");
      if (uidCheck.rows[0].uid !== '11111111-1111-4111-8111-111111111111') throw new Error('Local auth.uid() does not resolve Supabase JWT claims.');
    } finally {
      await client.query('ROLLBACK');
    }
    await client.query('CREATE SCHEMA IF NOT EXISTS extensions');

    await client.query('CREATE SCHEMA IF NOT EXISTS storage');
    await client.query(`CREATE TABLE IF NOT EXISTS storage.buckets (
      id text PRIMARY KEY, name text NOT NULL, owner uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
      public boolean DEFAULT false NOT NULL, file_size_limit bigint, allowed_mime_types text[]
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS storage.objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner_id text, metadata jsonb,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    )`);
    await client.query('ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY');
    await client.query('GRANT USAGE ON SCHEMA auth, storage TO authenticated, anon');
    await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated');
    await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON storage.buckets TO authenticated');
    await client.query(`ALTER DATABASE "${decodeURIComponent(new URL(dbUrl).pathname.slice(1))}" SET search_path TO extensions, public`);
  } finally {
    await client.end();
  }
}

export async function inspectFixture(dbUrl) {
  assertLocalUrl(dbUrl);
  const { Client } = pg;
  const client = new Client({ connectionString: dbUrl.toString(), application_name: 'learnly-migration-executor-inspect' });
  await client.connect();
  try {
    const identity = await client.query(`SELECT current_database() AS database, current_user AS db_user,
      inet_server_addr()::text AS server_address, inet_server_port() AS server_port,
      current_setting('server_version') AS server_version`);
    const extension = await client.query("SELECT n.nspname AS schema, e.extversion AS version FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector'");
    const markerTables = await client.query(`SELECT to_regclass('prisma_contract.marker') IS NOT NULL AS has_marker,
      to_regclass('prisma_contract.migration') IS NOT NULL AS has_migration_ledger`);
    return { ...identity.rows[0], vector: extension.rows[0] ?? null, ...markerTables.rows[0] };
  } finally {
    await client.end();
  }
}
