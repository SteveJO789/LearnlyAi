import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { computeStorageHash } from "@prisma/orm-framework/contract/hashing";
import { validateContractDomain } from "@prisma/orm-framework/contract";
import { sqlContractCanonicalizationHooks } from "@prisma/orm-family-sql/contract/canonicalization-hooks";
import { createGotruePop6CatalogProfile, createModernSupabaseCatalogProfile, resolveSupabaseCatalogProfile,
  verifyModernSupabaseSourceFiles } from "../scripts/lib/supabase-catalog-profile.mjs";
import { createSupabaseVerificationOverlay, isSupabaseVerificationOverlayPath } from "../scripts/lib/supabase-verification-overlay.mjs";

test("GoTrue Pop 6.1.1 catalog profile changes only auth.schema_migrations.version and derives its official storage hash", () => {
  const upstream = resolveSupabaseCatalogProfile("upstream").contract;
  const profile = createGotruePop6CatalogProfile();
  const column = profile.contractOverride.storage.namespaces.auth.entries.table.schema_migrations.columns.version;
  assert.equal(upstream.storage.storageHash, "734893bc990ae5ec14dc7ad50a7d8b5873a864f056085a7ffd2f69c866989067");
  assert.deepEqual(column, { codecId: "sql/varchar@1", nativeType: "character varying", nullable: false, typeParams: { length: 14 } });
  const { storageHash: derivedHash, ...storageWithoutHash } = profile.contractOverride.storage;
  assert.equal(derivedHash, computeStorageHash({ target: profile.contractOverride.target,
    targetFamily: profile.contractOverride.targetFamily, storage: storageWithoutHash, ...sqlContractCanonicalizationHooks }));
  assert.equal(derivedHash, "af8551fb983a08dfc85ce28b82b7084e836639ee6c9e8e1cec63d68330ddf212");
  assert.deepEqual(JSON.parse(JSON.stringify(profile.contractOverride)), profile.contractOverride);

  const normalized = structuredClone(profile.contractOverride);
  normalized.storage.storageHash = upstream.storage.storageHash;
  normalized.storage.namespaces.auth.entries.table.schema_migrations.columns.version =
    structuredClone(upstream.storage.namespaces.auth.entries.table.schema_migrations.columns.version);
  assert.deepEqual(normalized, upstream);
});

test("catalog profile selection fails closed for unsupported package or contract shapes and unknown profile ids", () => {
  assert.throws(() => resolveSupabaseCatalogProfile("invented-profile"), /Unknown Supabase catalog profile/u);
  const upstream = resolveSupabaseCatalogProfile("upstream").contract;
  assert.throws(() => createGotruePop6CatalogProfile(upstream, "8.0.0-rc.13"), /Unsupported Supabase ORM contract package version/u);
  const wrongShape = structuredClone(upstream);
  wrongShape.storage.namespaces.auth.entries.table.schema_migrations.columns.version.typeRef = "Unexpected";
  assert.throws(() => createGotruePop6CatalogProfile(wrongShape), /contract fingerprint mismatch|contract shape changed/u);
  const staleHash = structuredClone(upstream);
  staleHash.storage.namespaces.auth.entries.table.users.columns.email.nativeType = "text";
  assert.throws(() => createGotruePop6CatalogProfile(staleHash), /contract fingerprint mismatch/u);
});

test("modern source-bound catalog profile adds the official Auth and Storage envelope without changing upstream auth history", () => {
  const upstream = resolveSupabaseCatalogProfile("upstream").contract;
  const profile = createModernSupabaseCatalogProfile();
  const contract = profile.contractOverride;
  assert.doesNotThrow(() => validateContractDomain(contract));
  assert.equal(profile.id, "supabase-auth-20260831180000-storage-73-multitenant-pg17");
  assert.deepEqual(profile.source, {
    package: "@prisma/orm-extension-supabase@8.0.0-rc.12",
    storageCommit: "36a3a23f69896201f62ecd711d6f648520484403",
    authTag: "v2.197.0",
    authCommit: "4eee58f296d9698a1c2c0ae14d7a0b379c7622d3",
    storageBoundary: 73,
    authBoundary: "20260831180000",
  });
  assert.equal(contract.storage.storageHash, "2849dcde51ea1a0ece7c17f981a5aa0d1bb32ed9e6bc190e84d15aeb74a78341");
  assert.deepEqual(contract.storage.namespaces.auth.entries.table.schema_migrations.columns.version,
    upstream.storage.namespaces.auth.entries.table.schema_migrations.columns.version);
  assert.equal(contract.storage.types.Parent.typeParams.length, 255);
  assert.deepEqual(contract.storage.namespaces.auth.entries.native_enum.factor_type.members,
    ["totp", "webauthn", "phone", "recovery_code"]);
  assert.deepEqual(contract.storage.namespaces.auth.entries.valueSet.FactorType.values,
    ["totp", "webauthn", "phone", "recovery_code"]);
  assert.deepEqual(Object.keys(contract.storage.namespaces.auth.entries.table.scim_users.columns),
    ["id", "sso_provider_id", "user_id", "resource", "user_name", "external_id", "active", "created_at", "updated_at", "deleted_at"]);
  assert.deepEqual(Object.keys(contract.storage.namespaces.auth.entries.table.scim_tokens.columns),
    ["id", "sso_provider_id", "token_hash", "prefix", "created_at", "expires_at", "revoked_at", "last_used_at"]);
  assert.deepEqual(Object.keys(contract.storage.namespaces.auth.entries.table.mfa_recovery_code_sets.columns),
    ["id", "user_id", "mfa_factor_id", "failed_verification_count", "verification_locked_until", "created_at", "updated_at"]);
  assert.deepEqual(Object.keys(contract.storage.namespaces.auth.entries.table.mfa_recovery_codes.columns),
    ["id", "mfa_recovery_code_set_id", "code_hash", "consumed_at", "created_at"]);
  assert.equal(contract.storage.namespaces.auth.entries.table.scim_users.foreignKeys.find(x => x.name === "scim_users_user_id_fkey").onDelete, "setNull");
  assert.equal(contract.storage.namespaces.auth.entries.table.scim_tokens.checks.length, 3);
  assert.equal(contract.storage.namespaces.auth.entries.table.mfa_recovery_code_sets.uniques.length, 2);

  const storage = contract.storage.namespaces.storage.entries;
  assert.equal(storage.table.buckets.columns.versioning_status.default.value, "DISABLED");
  assert.deepEqual(["lifecycle_configuration", "lifecycle_configuration_generation"].map(k => storage.table.buckets.columns[k].nativeType),
    ["jsonb", "uuid"]);
  assert.deepEqual(["archived_at", "is_delete_marker", "is_versioned"].map(k => storage.table.objects.columns[k].nativeType),
    ["timestamptz", "bool", "bool"]);
  assert.equal(storage.table.objects.indexes.some(x => x.name === "bucketid_objname"), false);
  assert.equal(storage.table.objects.indexes.filter(x => ["idx_objects_current_version", "idx_objects_null_version",
    "idx_objects_delete_markers"].includes(x.name)).length, 3);
  assert.equal("iceberg_tables" in storage.table, false);
  assert.equal("iceberg_namespaces" in storage.table, false);
  assert.equal("buckets_analytics" in storage.table, true);

  const { storageHash: derivedHash, ...storageWithoutHash } = contract.storage;
  assert.equal(derivedHash, computeStorageHash({ target: contract.target, targetFamily: contract.targetFamily,
    storage: storageWithoutHash, ...sqlContractCanonicalizationHooks }));
  assert.equal(derivedHash, "2849dcde51ea1a0ece7c17f981a5aa0d1bb32ed9e6bc190e84d15aeb74a78341");
});

test("modern profile pins every source file used by its schema transform and rejects source mutation", async () => {
  const sourceRoot = fileURLToPath(new URL("./fixtures/modern-supabase-source/", import.meta.url));
  const sourceFiles = {};
  for (const area of ["storage", "auth"]) {
    for (const name of await readdir(new URL(`${area}/`, `file://${sourceRoot}/`))) {
      sourceFiles[`${area}/${name}`] = await readFile(new URL(`${area}/${name}`, `file://${sourceRoot}/`));
    }
  }
  const sourcePin = verifyModernSupabaseSourceFiles(sourceFiles);
  assert.equal(createModernSupabaseCatalogProfile(undefined, undefined, sourceFiles).source.storageCommit,
    "36a3a23f69896201f62ecd711d6f648520484403");
  assert.equal(sourcePin.storageCommit, "36a3a23f69896201f62ecd711d6f648520484403");
  assert.equal(Object.keys(sourcePin.files).length, 17);
  const mutated = { ...sourceFiles, "storage/0062-object-versioning-core.sql": Buffer.from(`${sourceFiles["storage/0062-object-versioning-core.sql"]}\n-- mutation`) };
  assert.throws(() => verifyModernSupabaseSourceFiles(mutated), /source file fingerprint mismatch/u);
  assert.throws(() => createModernSupabaseCatalogProfile(undefined, undefined, mutated), /source file fingerprint mismatch/u);
  assert.throws(() => verifyModernSupabaseSourceFiles({}), /file set does not match/u);
});

test("modern catalog profile is fail closed on package, base contract, and profile selection", () => {
  assert.throws(() => resolveSupabaseCatalogProfile("not-a-modern-profile"), /Unknown Supabase catalog profile/u);
  const upstream = resolveSupabaseCatalogProfile("upstream").contract;
  assert.throws(() => createModernSupabaseCatalogProfile(upstream, "8.0.0-rc.13"), /Unsupported Supabase ORM contract package version/u);
  const mutated = structuredClone(upstream);
  mutated.storage.types.Parent.typeParams.length = 254;
  assert.throws(() => createModernSupabaseCatalogProfile(mutated), /contract fingerprint mismatch/u);
});

test("verification overlay preserves migration history and adds only the derived Supabase snapshot and head ref", async () => {
  const sourceMigrationsDir = fileURLToPath(new URL("../migrations/", import.meta.url));
  const sourceHeadPath = fileURLToPath(new URL("../migrations/supabase/refs/head.json", import.meta.url));
  const sourceHeadBefore = await readFile(sourceHeadPath);
  const profile = resolveSupabaseCatalogProfile("gotrue-pop6-v6.1.1");
  const overlay = await createSupabaseVerificationOverlay({ sourceMigrationsDir, profile });
  try {
    assert.equal(isSupabaseVerificationOverlayPath(overlay.migrationsDir), true);
    assert.equal(isSupabaseVerificationOverlayPath(sourceMigrationsDir), false);
    assert.equal(overlay.evidence.profileStorageHash, profile.contract.storage.storageHash);
    assert.equal(overlay.evidence.addedFiles.length, 2);
    assert.deepEqual(overlay.evidence.changedFiles, ["supabase/refs/head.json"]);
    assert.equal(overlay.evidence.preservedHistoricalFileCount, overlay.evidence.sourceFileCount - 1);
    const head = JSON.parse(await readFile(new URL("supabase/refs/head.json", `file://${overlay.migrationsDir}/`), "utf8"));
    assert.equal(head.hash, profile.contract.storage.storageHash);
    assert.deepEqual(await readFile(sourceHeadPath), sourceHeadBefore);
  } finally { await overlay.cleanup(); }
});

test("modern verification overlay preserves immutable history while selecting only its derived profile snapshot", async () => {
  const sourceMigrationsDir = fileURLToPath(new URL("../migrations/", import.meta.url));
  const sourceHeadPath = fileURLToPath(new URL("../migrations/supabase/refs/head.json", import.meta.url));
  const sourceHeadBefore = await readFile(sourceHeadPath);
  const profile = resolveSupabaseCatalogProfile("supabase-auth-20260831180000-storage-73-multitenant-pg17");
  const overlay = await createSupabaseVerificationOverlay({ sourceMigrationsDir, profile });
  try {
    assert.equal(overlay.evidence.profileId, profile.id);
    assert.equal(overlay.evidence.profileStorageHash, profile.contract.storage.storageHash);
    assert.equal(overlay.evidence.addedFiles.length, 2);
    assert.deepEqual(overlay.evidence.changedFiles, ["supabase/refs/head.json"]);
    const head = JSON.parse(await readFile(new URL("supabase/refs/head.json", `file://${overlay.migrationsDir}/`), "utf8"));
    assert.equal(head.hash, profile.contract.storage.storageHash);
    assert.deepEqual(await readFile(sourceHeadPath), sourceHeadBefore);
  } finally { await overlay.cleanup(); }
});
