import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { computeStorageHash } from "@prisma/orm-framework/contract/hashing";
import { sqlContractCanonicalizationHooks } from "@prisma/orm-family-sql/contract/canonicalization-hooks";
import { createGotruePop6CatalogProfile, resolveSupabaseCatalogProfile } from "../scripts/lib/supabase-catalog-profile.mjs";
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
