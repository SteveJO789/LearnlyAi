import pg from "pg";
import { createHash } from "node:crypto";
import sourceSignatures from "./modern-supabase-catalog-source-signatures.json" with { type: "json" };

const { Client } = pg;
const EXPECTED_PROFILE = "supabase-auth-20260831180000-storage-73-multitenant-pg17";
const SOURCE_EXECUTION_SHA256 = "4d0c5f40f5b03b6de18d021e3e5f2f5037dd10d53b4976549d205a046a0d5e7a";
const SOURCE_SIGNATURES_SHA256 = "17eaec3314ba4799a109c75cc327791151df2f647a1dab9596979f6cbcb320c5";
const SOURCE_SQL_SHA256 = Object.freeze({
  "0011-add-trigger-to-auto-update-updated_at-column.sql": "922302d623209192a5a85c6bdd0bf21b64cc3bded6e1d048c66d98c7dfdd83eb",
  "0037-add-bucket-name-length-trigger.sql": "87302c6579e5d6fca31e665ba1496471e2b9b61bc76dd95979ec57d1fa1bf58f",
  "0055-prevent-direct-deletes.sql": "ec334dd0d3533b6ea53de3ed5fef2160fedb786a4555881d8f7bf6b84ee4d30d",
  "0062-object-versioning-core.sql": "45969060b55102f56af317b0d7981434be58927de1ff76e1e1789139a3f2defc",
  "0065-objects-key-version-index.sql": "426ed592dbded48288f4c619a6d01ea7f76ea5031b4378ff5a9c8fcd2b9667f1",
  "0066-objects-current-version-index.sql": "2b0a54803b59d6888ee7f39112fd9308b804795deae5232db59664a2ff030913",
  "0067-objects-null-version-index.sql": "40b424187dae61ce84463c2fc65fd6f86552c3aa8af50436fc18ffbf89e19636",
  "0068-bucket-lifecycle-configuration.sql": "03a3832e3b2cbda93f36ce0de5b962d881fefe5d497321a09e9833e118c04139",
  "0069-validate-bucket-lifecycle-constraints.sql": "393f7b36e34a577167a77b226aabf478b529cedf0b2a66b1ac2ea9bdeaf82a7e",
  "0071-objects-delete-marker-index.sql": "d5d0a454b5d6a7c4d9d800721e053f33f1615d89ed7e5cbc440667a88c2a0d82",
  "auth/20260821000000_add_scim_users.up.sql": "306bd1e7fb017ff092c23892479aa5276159fddcaca2ec137412939e365efd35",
  "auth/20260821010000_add_scim_tokens.up.sql": "26ba18f30879470c9a072dc17ffebb5fbfbc74c21fea04ceb59698467138d2ba",
  "auth/20260824000001_add_recovery_codes_tables.up.sql": "164b783002f178746e92eca36ec24a70cf3c70ea9553920b6a9869907f17f006",
});

const metadataQueries = Object.freeze({
  generatedColumns: `SELECT n.nspname AS schema, c.relname AS table, a.attname AS column,
      a.attgenerated AS generated, pg_get_expr(d.adbin, d.adrelid) AS expression,
      format_type(a.atttypid, a.atttypmod) AS "formatType", NOT a.attnotnull AS nullable
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE (n.nspname, c.relname, a.attname) IN
      (('auth','scim_users','user_name'), ('auth','scim_users','external_id'), ('auth','scim_users','active'))
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY n.nspname, c.relname, a.attname`,
  indexes: `SELECT n.nspname AS schema, t.relname AS table, i.relname AS name,
      am.amname AS method, ix.indisunique AS unique, ix.indnullsnotdistinct AS "nullsNotDistinct",
      ix.indisvalid AS valid, ix.indisready AS ready, pg_get_indexdef(ix.indexrelid) AS definition
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = i.relam
    WHERE (n.nspname, t.relname, i.relname) IN
      (('storage','objects','objects_bucket_id_name_version_key'), ('storage','objects','idx_objects_current_version'),
       ('storage','objects','idx_objects_null_version'), ('storage','objects','idx_objects_delete_markers'),
       ('auth','scim_users','scim_users_user_name_idx'))
    ORDER BY n.nspname, t.relname, i.relname`,
  constraints: `SELECT n.nspname AS schema, t.relname AS table, co.conname AS name,
      co.convalidated AS validated, co.condeferrable AS deferrable, co.condeferred AS deferred,
      pg_get_constraintdef(co.oid) AS definition
    FROM pg_constraint co
    JOIN pg_class t ON t.oid = co.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE co.contype = 'c' AND (n.nspname, t.relname, co.conname) IN
      (('auth','scim_tokens','scim_tokens_token_hash_check'), ('auth','scim_tokens','scim_tokens_expires_at_future'),
       ('auth','scim_tokens','scim_tokens_revoked_after_created'),
       ('auth','mfa_recovery_code_sets','mfa_recovery_code_sets_failed_verification_count_check'),
       ('storage','buckets','buckets_versioning_status_check'), ('storage','buckets','buckets_versioning_standard_only_check'),
       ('storage','buckets','buckets_versioning_dark_check'), ('storage','buckets','buckets_lifecycle_configuration_pair_check'),
       ('storage','buckets','buckets_lifecycle_configuration_shape_check'),
       ('storage','buckets','buckets_lifecycle_configuration_standard_only_check'))
    ORDER BY n.nspname, t.relname, co.conname`,
  functions: `SELECT n.nspname AS schema, p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS "identityArgs", p.prosecdef AS "securityDefiner",
      r.rolname AS owner, p.proconfig, l.lanname AS language, pg_get_function_result(p.oid) AS "returnType",
      p.prosrc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'storage' AND p.proname IN
      ('protect_delete', 'protect_bucket_control_columns', 'enforce_bucket_lifecycle_service_role',
       'enforce_bucket_name_length', 'update_updated_at_column')
    ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)`,
  triggers: `SELECT n.nspname AS schema, t.relname AS table, tr.tgname AS name,
      tr.tgenabled AS enabled, pg_get_triggerdef(tr.oid) AS definition
    FROM pg_trigger tr
    JOIN pg_class t ON t.oid = tr.tgrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE NOT tr.tgisinternal AND n.nspname = 'storage' AND
      ((t.relname = 'buckets' AND tr.tgname IN ('enforce_bucket_name_length_trigger', 'protect_bucket_control_insert',
        'protect_bucket_control_update', 'protect_bucket_control_update_role', 'protect_buckets_delete')) OR
       (t.relname = 'objects' AND tr.tgname IN ('protect_objects_delete', 'update_objects_updated_at')))
    ORDER BY n.nspname, t.relname, tr.tgname`,
});

const keys = Object.freeze({
  generatedColumns: ["schema", "table", "column"],
  indexes: ["schema", "table", "name"],
  constraints: ["schema", "table", "name"],
  functions: ["schema", "name", "identityArgs"],
  triggers: ["schema", "table", "name"],
});

const blocked = (id, code) => ({ id, status: "BLOCKED", code });
const pass = id => ({ id, status: "PASS", code: "OK" });
const rowKey = (row, fields) => fields.map(field => String(row?.[field] ?? "")).join("\u0000");
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function profileIsComplete(expected) {
  const source = expected?.sourceFixture;
  if (!expected || createHash("sha256").update(stable(expected)).digest("hex") !== SOURCE_SIGNATURES_SHA256) return false;
  if (!expected || expected.profileId !== EXPECTED_PROFILE || expected.postgresMajor !== 17 ||
      source?.status !== "PASS" || source?.kind !== "official-source-only" || source?.profileId !== EXPECTED_PROFILE ||
      source?.postgresMajor !== 17 || source?.expectedStorageOwner !== "supabase_storage_admin" ||
      source?.executionEvidenceSha256 !== SOURCE_EXECUTION_SHA256 ||
      source?.provenance?.storageSourceCommit !== "36a3a23f69896201f62ecd711d6f648520484403" ||
      source?.provenance?.authSourceCommit !== "4eee58f296d9698a1c2c0ae14d7a0b379c7622d3" ||
      source?.provenance?.authSourceTag !== "v2.197.0" ||
      stable(source?.sourceSqlSha256) !== stable(SOURCE_SQL_SHA256)) return false;
  return Object.entries(keys).every(([category, fields]) => Array.isArray(expected[category]) &&
    expected[category].length > 0 && expected[category].every(row =>
      fields.every(field => typeof row[field] === "string") &&
      Object.keys(row).length > fields.length));
}

function compareCategory(actualRows, expectedRows, fields, category) {
  if (!Array.isArray(actualRows) || !Array.isArray(expectedRows)) return blocked(`catalog.modern.${category}`, "METADATA_MISSING");
  const actual = new Map(actualRows.map(row => [rowKey(row, fields), row]));
  const expected = new Map(expectedRows.map(row => [rowKey(row, fields), row]));
  if (actual.size !== actualRows.length || expected.size !== expectedRows.length || actual.size !== expected.size) {
    return blocked(`catalog.modern.${category}`, "OBJECT_SET_MISMATCH");
  }
  for (const [key, expectedRow] of expected) {
    const actualRow = actual.get(key);
    if (!actualRow || stable(actualRow) !== stable(expectedRow)) return blocked(`catalog.modern.${category}`, "SOURCE_SIGNATURE_MISMATCH");
  }
  return pass(`catalog.modern.${category}`);
}

/** Compare catalog metadata against signatures captured only from the pinned official-source fixture. */
export function verifyModernSupabaseCatalogSupplementMetadata({ postgresMajor, actual, expected }) {
  if (!profileIsComplete(expected) || !actual || typeof actual !== "object") {
    return { status: "BLOCKED", findings: [blocked("catalog.modern.source", "SOURCE_SIGNATURES_UNAVAILABLE")] };
  }
  if (postgresMajor !== expected.postgresMajor) {
    return { status: "BLOCKED", findings: [blocked("catalog.modern.postgres", "UNSUPPORTED_POSTGRES_VERSION")] };
  }
  const findings = Object.entries(keys).map(([category, fields]) =>
    compareCategory(actual[category], expected[category], fields, category));
  return { status: findings.every(finding => finding.status === "PASS") ? "PASS" : "BLOCKED", findings };
}

/** Read-only catalog inspection. Every query is scoped to the source-pinned service objects. */
export async function verifyModernSupabaseCatalogSupplement({ connectionString, expected = sourceSignatures,
  clientFactory = options => new Client(options) }) {
  if (!connectionString) return { status: "BLOCKED", findings: [blocked("catalog.modern.connection", "DATABASE_URL_MISSING")] };
  if (!profileIsComplete(expected)) return { status: "BLOCKED", findings: [blocked("catalog.modern.source", "SOURCE_SIGNATURES_UNAVAILABLE")] };
  const client = clientFactory({ connectionString, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL search_path = public, extensions");
    const versionResult = await client.query("SELECT current_setting('server_version_num')::integer AS version");
    const postgresMajor = Math.floor(Number(versionResult.rows?.[0]?.version) / 10000);
    if (!Number.isInteger(postgresMajor) || postgresMajor !== expected.postgresMajor) {
      return { status: "BLOCKED", findings: [blocked("catalog.modern.postgres", "UNSUPPORTED_POSTGRES_VERSION")] };
    }
    const actual = {};
    for (const [category, query] of Object.entries(metadataQueries)) {
      const result = await client.query(query);
      actual[category] = result.rows;
    }
    const verification = verifyModernSupabaseCatalogSupplementMetadata({ postgresMajor, actual, expected });
    await client.query("COMMIT");
    transactionOpen = false;
    return verification;
  } catch {
    return { status: "BLOCKED", findings: [blocked("catalog.modern.connection", "DATABASE_UNAVAILABLE")] };
  } finally {
    if (transactionOpen) {
      try { await client.query("ROLLBACK"); } catch { /* preserve the original blocked result */ }
    }
    try { await client.end(); } catch { /* read-only inspection is already complete */ }
  }
}
