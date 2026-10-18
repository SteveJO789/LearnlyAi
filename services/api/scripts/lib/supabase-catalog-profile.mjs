import { createHash } from "node:crypto";
import { supabasePackWith } from "@prisma/orm-extension-supabase/pack";
import supabasePack from "@prisma/orm-extension-supabase/pack";
import { computeStorageHash } from "@prisma/orm-framework/contract/hashing";
import { sqlContractCanonicalizationHooks } from "@prisma/orm-family-sql/contract/canonicalization-hooks";

const PACKAGE_VERSION = "8.0.0-rc.12";
const UPSTREAM_STORAGE_HASH = "734893bc990ae5ec14dc7ad50a7d8b5873a864f056085a7ffd2f69c866989067";
const GOTRUE_POP6_PROFILE = "gotrue-pop6-v6.1.1";
const GOTRUE_POP6_STORAGE_HASH = "af8551fb983a08dfc85ce28b82b7084e836639ee6c9e8e1cec63d68330ddf212";
const MODERN_SUPABASE_PROFILE = "supabase-auth-20260831180000-storage-73-multitenant-pg17";
const MODERN_SUPABASE_STORAGE_HASH = "2849dcde51ea1a0ece7c17f981a5aa0d1bb32ed9e6bc190e84d15aeb74a78341";
const MODERN_SOURCE = Object.freeze({
  package: "@prisma/orm-extension-supabase@8.0.0-rc.12",
  storageCommit: "36a3a23f69896201f62ecd711d6f648520484403",
  authTag: "v2.197.0",
  authCommit: "4eee58f296d9698a1c2c0ae14d7a0b379c7622d3",
  storageBoundary: 73,
  authBoundary: "20260831180000",
});
const MODERN_SOURCE_SHA256 = Object.freeze({
  "storage/0038-iceberg-catalog-flag-on-buckets.sql": "1990ef579540844e013580a03bf87ea5d37c37686dcad11e81503d8e443805b9",
  "storage/0047-iceberg-table-metadata.sql": "0d13ec23e5e11b9a5d916129e6d40cf1b043a742f49147fd507f5b7b8e2945cf",
  "storage/0048-iceberg-catalog-ids.sql": "e4f553f2a6751fe16956d18ec1b0e3aeac6b0d320c8aa00778c19dca7920bb8a",
  "storage/0062-object-versioning-core.sql": "45969060b55102f56af317b0d7981434be58927de1ff76e1e1789139a3f2defc",
  "storage/0065-objects-key-version-index.sql": "426ed592dbded48288f4c619a6d01ea7f76ea5031b4378ff5a9c8fcd2b9667f1",
  "storage/0066-objects-current-version-index.sql": "2b0a54803b59d6888ee7f39112fd9308b804795deae5232db59664a2ff030913",
  "storage/0067-objects-null-version-index.sql": "40b424187dae61ce84463c2fc65fd6f86552c3aa8af50436fc18ffbf89e19636",
  "storage/0068-bucket-lifecycle-configuration.sql": "03a3832e3b2cbda93f36ce0de5b962d881fefe5d497321a09e9833e118c04139",
  "storage/0069-validate-bucket-lifecycle-constraints.sql": "393f7b36e34a577167a77b226aabf478b529cedf0b2a66b1ac2ea9bdeaf82a7e",
  "storage/0071-objects-delete-marker-index.sql": "d5d0a454b5d6a7c4d9d800721e053f33f1615d89ed7e5cbc440667a88c2a0d82",
  "storage/0072-drop-bucketid-objname-index.sql": "5b98355d75c7e3c0c87c2cc746ff17006a5f081c8641b457beec74fc0691da04",
  "auth/20260625000000_add_custom_claims_allowlist.up.sql": "6fe5c9be092ce6d4c577d137b58b04d00dbbfa71462636d8d6f7b91b1ca440f2",
  "auth/20260821000000_add_scim_users.up.sql": "306bd1e7fb017ff092c23892479aa5276159fddcaca2ec137412939e365efd35",
  "auth/20260821010000_add_scim_tokens.up.sql": "26ba18f30879470c9a072dc17ffebb5fbfbc74c21fea04ceb59698467138d2ba",
  "auth/20260824000000_add_recovery_codes_factor_type.up.sql": "cb8614c41cfe831b22c3eb972b104f417e81fdab5972948cc06a2323fca8b77c",
  "auth/20260824000001_add_recovery_codes_tables.up.sql": "164b783002f178746e92eca36ec24a70cf3c70ea9553920b6a9869907f17f006",
  "auth/20260831180000_add_expires_at_to_one_time_tokens.up.sql": "36417f03a1b9496d1f7e365350c07809308305634f6b464aae0760e9e9ae7029",
});

function recomputeStorageHash(contract) {
  const { storageHash: _publishedHash, ...storage } = contract.storage;
  return computeStorageHash({ target: contract.target, targetFamily: contract.targetFamily, storage,
    ...sqlContractCanonicalizationHooks });
}

function upstreamContract(contract = supabasePack.contractSpace?.contractJson, packageVersion = supabasePack.version) {
  if (packageVersion !== PACKAGE_VERSION) throw new Error("Unsupported Supabase ORM contract package version");
  if (!contract || contract.target !== "postgres" || contract.targetFamily !== "sql" ||
    contract.storage?.storageHash !== UPSTREAM_STORAGE_HASH || recomputeStorageHash(contract) !== UPSTREAM_STORAGE_HASH) {
    throw new Error("Supabase ORM upstream contract fingerprint mismatch");
  }
  const version = contract.storage.namespaces?.auth?.entries?.table?.schema_migrations?.columns?.version;
  if (!version || version.codecId !== "sql/varchar@1" || version.nativeType !== "character varying" ||
    version.nullable !== false || version.typeRef !== "Parent" || version.typeParams !== undefined) {
    throw new Error("Supabase ORM auth.schema_migrations.version contract shape changed");
  }
  const parentType = contract.storage.types?.Parent;
  if (!parentType || parentType.codecId !== "sql/varchar@1" || parentType.typeParams?.length !== 255) {
    throw new Error("Supabase ORM Parent type contract shape changed");
  }
  return contract;
}

export function createGotruePop6CatalogProfile(sourceContract = supabasePack.contractSpace?.contractJson,
  packageVersion = supabasePack.version) {
  const original = upstreamContract(sourceContract, packageVersion);
  const contractOverride = structuredClone(original);
  const version = contractOverride.storage.namespaces.auth.entries.table.schema_migrations.columns.version;
  delete version.typeRef;
  version.typeParams = { length: 14 };
  contractOverride.storage.storageHash = recomputeStorageHash(contractOverride);
  if (contractOverride.storage.storageHash !== GOTRUE_POP6_STORAGE_HASH) throw new Error("Derived Supabase catalog profile hash mismatch");
  return { id: GOTRUE_POP6_PROFILE, sourceContract: original, contractOverride, pack: supabasePackWith({ contractOverride }) };
}

function literal(value) { return { kind: "literal", value }; }
function column(codecId, nativeType, nullable, options = {}) {
  const result = { codecId, nativeType, nullable, ...options };
  return result;
}
function uuid(nullable = false) { return column("pg/uuid@1", "uuid", nullable); }
function text(nullable = false, options = {}) { return column("pg/text@1", "text", nullable, options); }
function timestamptz(nullable = false, defaultValue) {
  return column("pg/timestamptz-temporal@1", "timestamptz", nullable,
    defaultValue === undefined ? {} : { default: defaultValue === "now()" ? { kind: "function", expression: "now()" } : literal(defaultValue) });
}
function primaryKey(name, columns) { return { columns, name }; }
function fk(name, tableName, columnName, targetTable, targetColumn = "id", onDelete = "noAction") {
  const value = { name, source: { columns: [columnName], namespaceId: "auth", tableName },
    target: { columns: [targetColumn], namespaceId: "auth", tableName: targetTable } };
  if (onDelete !== "noAction") value.onDelete = onDelete;
  return value;
}
function idx(name, columns, unique = false, where) {
  return { columns, name, unique, ...(where ? { where } : {}) };
}
function check(name, expression) { return { expression, name }; }

function modernAuthTables(storage) {
  const auth = storage.namespaces.auth.entries;
  const T = auth.table;
  // Official TEXT[] NOT NULL constrains the array itself; its elements can be NULL.
  T.custom_oauth_providers.columns.custom_claims_allowlist = column("pg/text@1", "text", false,
    { many: true, default: literal([]), noCheck: ["elementNotNull"] });
  T.one_time_tokens.columns.expires_at = timestamptz(true);

  T.scim_users = {
    columns: {
      id: uuid(), sso_provider_id: uuid(), user_id: uuid(true), resource: column("pg/jsonb@1", "jsonb", false),
      user_name: text(), external_id: text(true), active: column("pg/bool@1", "bool", false),
      created_at: timestamptz(false, "now()"), updated_at: timestamptz(false, "now()"), deleted_at: timestamptz(true),
    },
    foreignKeys: [fk("scim_users_sso_provider_id_fkey", "scim_users", "sso_provider_id", "sso_providers", "id", "cascade"),
      fk("scim_users_user_id_fkey", "scim_users", "user_id", "users", "id", "setNull")],
    indexes: [idx("scim_users_user_name_key", ["sso_provider_id", "user_name"], true, "(deleted_at IS NULL)"),
      idx("scim_users_external_id_key", ["sso_provider_id", "external_id"], true, "((external_id IS NOT NULL) AND (deleted_at IS NULL))"),
      idx("scim_users_user_id_idx", ["user_id"]), idx("scim_users_id_idx", ["sso_provider_id", "id"], false, "(deleted_at IS NULL)"),
      idx("scim_users_user_name_idx", ["sso_provider_id", "user_name", "id"], false, "(deleted_at IS NULL)"),
      idx("scim_users_created_at_idx", ["sso_provider_id", "created_at", "id"], false, "(deleted_at IS NULL)"),
      idx("scim_users_updated_at_idx", ["sso_provider_id", "updated_at", "id"], false, "(deleted_at IS NULL)"),
      idx("scim_users_sso_provider_id_idx", ["sso_provider_id"]), idx("scim_users_deleted_at_idx", ["deleted_at"])],
    primaryKey: primaryKey("scim_users_pkey", ["id"]), uniques: [],
  };
  T.scim_tokens = {
    checks: [check("scim_tokens_token_hash_check", "(token_hash ~ '^[0-9a-f]{64}$'::text)"),
      check("scim_tokens_expires_at_future", "((expires_at IS NULL) OR (expires_at > created_at))"),
      check("scim_tokens_revoked_after_created", "((revoked_at IS NULL) OR (revoked_at >= created_at))")],
    columns: { id: uuid(), sso_provider_id: uuid(), token_hash: text(), prefix: text(), created_at: timestamptz(false, "now()"),
      expires_at: timestamptz(true), revoked_at: timestamptz(true), last_used_at: timestamptz(true) },
    foreignKeys: [fk("scim_tokens_sso_provider_id_fkey", "scim_tokens", "sso_provider_id", "sso_providers", "id", "cascade")],
    indexes: [idx("scim_tokens_token_hash_key", ["token_hash"], true), idx("scim_tokens_sso_provider_id_idx", ["sso_provider_id"]),
      idx("scim_tokens_expires_at_idx", ["expires_at"]), idx("scim_tokens_revoked_at_idx", ["revoked_at"])],
    primaryKey: primaryKey("scim_tokens_pkey", ["id"]), uniques: [],
  };
  T.mfa_recovery_code_sets = {
    checks: [check("mfa_recovery_code_sets_failed_verification_count_check", "(failed_verification_count >= 0)")],
    columns: { id: uuid(), user_id: uuid(), mfa_factor_id: uuid(), failed_verification_count: column("pg/int4@1", "int4", false, { default: literal(0) }),
      verification_locked_until: timestamptz(true), created_at: timestamptz(false, "now()"), updated_at: timestamptz(false, "now()") },
    foreignKeys: [fk("mfa_recovery_code_sets_user_id_fkey", "mfa_recovery_code_sets", "user_id", "users", "id", "cascade"),
      fk("mfa_recovery_code_sets_mfa_factor_id_fkey", "mfa_recovery_code_sets", "mfa_factor_id", "mfa_factors", "id", "cascade")],
    indexes: [], primaryKey: primaryKey("mfa_recovery_code_sets_pkey", ["id"]),
    uniques: [{ columns: ["user_id"], name: "mfa_recovery_code_sets_user_id_key" },
      { columns: ["mfa_factor_id"], name: "mfa_recovery_code_sets_mfa_factor_id_key" }],
  };
  T.mfa_recovery_codes = {
    columns: { id: uuid(), mfa_recovery_code_set_id: uuid(), code_hash: text(), consumed_at: timestamptz(true), created_at: timestamptz(false, "now()") },
    foreignKeys: [fk("mfa_recovery_codes_mfa_recovery_code_set_id_fkey", "mfa_recovery_codes", "mfa_recovery_code_set_id", "mfa_recovery_code_sets", "id", "cascade")],
    indexes: [idx("mfa_recovery_codes_set_id_idx", ["mfa_recovery_code_set_id"])],
    primaryKey: primaryKey("mfa_recovery_codes_pkey", ["id"]), uniques: [],
  };
  auth.native_enum.factor_type.members.push("recovery_code");
  auth.valueSet.FactorType.values.push("recovery_code");
}

function modernStorageTables(storage) {
  const entries = storage.namespaces.storage.entries;
  delete entries.table.iceberg_namespaces;
  delete entries.table.iceberg_tables;
  delete entries.rls.iceberg_namespaces;
  delete entries.rls.iceberg_tables;
  const objects = entries.table.objects;
  objects.indexes = objects.indexes.filter(index => index.name !== "bucketid_objname");
  objects.columns.archived_at = column("pg/timestamptz-temporal@1", "timestamptz", true);
  objects.columns.is_delete_marker = column("pg/bool@1", "bool", false, { default: literal(false) });
  objects.columns.is_versioned = column("pg/bool@1", "bool", false, { default: literal(false) });
  objects.indexes.push(idx("objects_bucket_id_name_version_key", ["bucket_id", "name", "version"], true),
    idx("idx_objects_current_version", ["bucket_id", "name"], true, "(archived_at IS NULL)"),
    idx("idx_objects_null_version", ["bucket_id", "name"], true, "(NOT is_versioned)"),
    idx("idx_objects_delete_markers", ["bucket_id", "name"], false, "is_delete_marker"));
  const buckets = entries.table.buckets;
  buckets.columns.versioning_status = text(false, { default: literal("DISABLED") });
  buckets.columns.lifecycle_configuration = column("pg/jsonb@1", "jsonb", true);
  buckets.columns.lifecycle_configuration_generation = uuid(true);
  buckets.checks = [
    ...(buckets.checks ?? []),
    check("buckets_versioning_status_check", "(versioning_status = ANY (ARRAY['DISABLED'::text, 'ENABLED'::text, 'SUSPENDED'::text]))"),
    check("buckets_versioning_standard_only_check", "((type = 'STANDARD'::storage.buckettype) OR (versioning_status = 'DISABLED'::text))"),
    check("buckets_versioning_dark_check", "(versioning_status = 'DISABLED'::text)"),
    check("buckets_lifecycle_configuration_pair_check", "((lifecycle_configuration IS NULL) = (lifecycle_configuration_generation IS NULL))"),
    check("buckets_lifecycle_configuration_shape_check", "((lifecycle_configuration IS NULL) OR ((jsonb_typeof(lifecycle_configuration) = 'object'::text) AND (lifecycle_configuration ? 'rules'::text) AND\nCASE\n    WHEN (jsonb_typeof((lifecycle_configuration -> 'rules'::text)) = 'array'::text) THEN ((jsonb_array_length((lifecycle_configuration -> 'rules'::text)) >= 1) AND (jsonb_array_length((lifecycle_configuration -> 'rules'::text)) <= 1000))\n    ELSE false\nEND))"),
    check("buckets_lifecycle_configuration_standard_only_check", "((type = 'STANDARD'::storage.buckettype) OR ((lifecycle_configuration IS NULL) AND (lifecycle_configuration_generation IS NULL)))"),
  ];
}

function modernDomainModels(contract) {
  const { auth, storage } = contract.storage.namespaces;
  const authModels = contract.domain.namespaces.auth.models;
  const storageModels = contract.domain.namespaces.storage.models;
  const toDomainField = (_columnName, shape) => ({ nullable: shape.nullable,
    ...(shape.many ? { many: true } : {}), type: { codecId: shape.codecId, kind: "scalar" } });
  const addExistingColumn = (model, fieldName, columnName, shape) => {
    model.fields[fieldName] = toDomainField(columnName, shape);
    model.storage.fields[fieldName] = { column: columnName };
  };
  addExistingColumn(authModels.CustomOauthProviders, "customClaimsAllowlist", "custom_claims_allowlist",
    auth.entries.table.custom_oauth_providers.columns.custom_claims_allowlist);
  addExistingColumn(authModels.OneTimeTokens, "expiresAt", "expires_at", auth.entries.table.one_time_tokens.columns.expires_at);
  const bucketModel = storageModels.StorageBucket;
  for (const [field, columnName] of [["versioningStatus", "versioning_status"], ["lifecycleConfiguration", "lifecycle_configuration"],
    ["lifecycleConfigurationGeneration", "lifecycle_configuration_generation"]]) {
    addExistingColumn(bucketModel, field, columnName, storage.entries.table.buckets.columns[columnName]);
  }
  const objectModel = storageModels.StorageObject;
  for (const [field, columnName] of [["archivedAt", "archived_at"], ["isDeleteMarker", "is_delete_marker"], ["isVersioned", "is_versioned"]]) {
    addExistingColumn(objectModel, field, columnName, storage.entries.table.objects.columns[columnName]);
  }
}

/**
 * Source-envelope profile: the profile names exact upstream commits, auth and
 * storage boundaries, and the multitenant Storage branch. Its schema transform
 * is authored from those migration sources and intentionally leaves the
 * upstream auth.schema_migrations.version varchar(255) contract untouched.
 * New catalog tables remain storage-contract entries because this profile is
 * for strict catalog verification. Stored generation expressions, C collations,
 * NULLS NOT DISTINCT, index validity, lifecycle constraint validation, and
 * Storage function/trigger semantics require the separate source-authored
 * read-only supplemental gate; the ORM contract cannot express all of them.
 */
export function createModernSupabaseCatalogProfile(sourceContract = supabasePack.contractSpace?.contractJson,
  packageVersion = supabasePack.version, sourceFiles) {
  const original = upstreamContract(sourceContract, packageVersion);
  if (sourceFiles !== undefined) verifyModernSupabaseSourceFiles(sourceFiles);
  const contractOverride = structuredClone(original);
  modernAuthTables(contractOverride.storage);
  modernStorageTables(contractOverride.storage);
  modernDomainModels(contractOverride);
  delete contractOverride.domain.namespaces.storage.models.IcebergNamespaces;
  delete contractOverride.domain.namespaces.storage.models.IcebergTables;
  delete contractOverride.domain.namespaces.storage.models.BucketsAnalytics.relations.icebergNamespaces;
  delete contractOverride.domain.namespaces.storage.models.BucketsAnalytics.relations.icebergTables;
  delete contractOverride.roots.iceberg_namespaces;
  delete contractOverride.roots.iceberg_tables;
  contractOverride.storage.storageHash = recomputeStorageHash(contractOverride);
  if (contractOverride.storage.storageHash !== MODERN_SUPABASE_STORAGE_HASH) {
    throw new Error("Derived modern Supabase catalog profile hash mismatch");
  }
  return { id: MODERN_SUPABASE_PROFILE, source: MODERN_SOURCE, sourceContract: original, contractOverride,
    pack: supabasePackWith({ contractOverride }) };
}

/** Verifies the exact official migration files whose schema shapes this profile extends. */
export function verifyModernSupabaseSourceFiles(sourceFiles) {
  if (!sourceFiles || typeof sourceFiles !== "object" || Array.isArray(sourceFiles)) {
    throw new Error("Modern Supabase source files are required");
  }
  const actualNames = Object.keys(sourceFiles).sort();
  const expectedNames = Object.keys(MODERN_SOURCE_SHA256).sort();
  if (actualNames.length !== expectedNames.length || actualNames.some((name, index) => name !== expectedNames[index])) {
    throw new Error("Modern Supabase source file set does not match the pinned official source envelope");
  }
  for (const [name, expectedHash] of Object.entries(MODERN_SOURCE_SHA256)) {
    const bytes = Buffer.isBuffer(sourceFiles[name]) ? sourceFiles[name] : Buffer.from(sourceFiles[name]);
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== expectedHash) throw new Error(`Modern Supabase source file fingerprint mismatch: ${name}`);
  }
  return { ...MODERN_SOURCE, files: { ...MODERN_SOURCE_SHA256 } };
}

/** Selects an operator-declared known catalog profile; never derives profile choice from a database. */
export function resolveSupabaseCatalogProfile(profileId = process.env.LEARNLY_SUPABASE_CATALOG_PROFILE) {
  const selected = profileId || "upstream";
  if (selected === "upstream") {
    upstreamContract();
    return { id: selected, pack: supabasePack, contract: supabasePack.contractSpace.contractJson };
  }
  if (selected === GOTRUE_POP6_PROFILE) {
    const profile = createGotruePop6CatalogProfile();
    return { ...profile, contract: profile.contractOverride };
  }
  if (selected === MODERN_SUPABASE_PROFILE) {
    const profile = createModernSupabaseCatalogProfile();
    return { ...profile, contract: profile.contractOverride };
  }
  throw new Error("Unknown Supabase catalog profile");
}
