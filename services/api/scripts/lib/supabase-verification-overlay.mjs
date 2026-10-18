import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { canonicalizeJson } from "@prisma/orm-framework/components/utils";

const UPSTREAM_HASH = "734893bc990ae5ec14dc7ad50a7d8b5873a864f056085a7ffd2f69c866989067";
const SUPPORTED_PROFILE_HASHES = new Map([
  ["gotrue-pop6-v6.1.1", "af8551fb983a08dfc85ce28b82b7084e836639ee6c9e8e1cec63d68330ddf212"],
  ["supabase-auth-20260831180000-storage-73-multitenant-pg17", "2849dcde51ea1a0ece7c17f981a5aa0d1bb32ed9e6bc190e84d15aeb74a78341"],
]);
const OVERLAY_PREFIX = "learnly-supabase-catalog-verify-";

async function inventory(root, current = root, files = new Map()) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error("Migration verification overlay refuses symlinks");
    if (info.isDirectory()) await inventory(root, path, files);
    else if (info.isFile()) files.set(relative(root, path), await readFile(path));
    else throw new Error("Migration verification overlay contains an unsupported filesystem entry");
  }
  return files;
}

/** Builds an isolated disk view for canonical verification; never touches repository migrations. */
export async function createSupabaseVerificationOverlay({ sourceMigrationsDir, profile }) {
  if (!SUPPORTED_PROFILE_HASHES.has(profile?.id) || profile.contract?.storage?.storageHash !== SUPPORTED_PROFILE_HASHES.get(profile.id)) {
    throw new Error("Unsupported Supabase verification profile");
  }
  const source = resolve(sourceMigrationsDir);
  const originalFiles = await inventory(source);
  const headPath = "supabase/refs/head.json";
  const headBytes = originalFiles.get(headPath);
  if (!headBytes) throw new Error("Supabase migration head ref is missing");
  const head = JSON.parse(headBytes.toString("utf8"));
  if (head.hash !== UPSTREAM_HASH || !Array.isArray(head.invariants) || head.invariants.length !== 0) {
    throw new Error("Supabase migration head ref does not match the pinned upstream profile");
  }
  const baseSnapshot = `snapshots/${UPSTREAM_HASH}`;
  const originalContract = JSON.parse((await readFile(join(source, baseSnapshot, "contract.json"), "utf8")));
  if (originalContract.storage?.storageHash !== UPSTREAM_HASH ||
    canonicalizeJson(originalContract.storage.namespaces.auth.entries.table.schema_migrations.columns.version) !==
      canonicalizeJson(profile.sourceContract.storage.namespaces.auth.entries.table.schema_migrations.columns.version)) {
    throw new Error("Supabase upstream snapshot differs from the pinned package contract");
  }
  if (JSON.stringify(originalContract) !== JSON.stringify(profile.sourceContract)) {
    // Key order is not contract data; use recursive canonical serialization before rejecting.
    if (canonicalizeJson(originalContract) !== canonicalizeJson(profile.sourceContract)) {
      throw new Error("Supabase upstream snapshot content differs from the pinned package contract");
    }
  }
  const profileHash = profile.contract.storage.storageHash;
  const snapshotRelative = `snapshots/${profileHash}`;
  if (originalFiles.has(`${snapshotRelative}/contract.json`) || originalFiles.has(`${snapshotRelative}/contract.d.ts`)) {
    throw new Error("Derived Supabase profile snapshot already exists in repository migrations");
  }
  const temporaryRoot = await mkdtemp(join(tmpdir(), OVERLAY_PREFIX));
  const migrationsDir = join(temporaryRoot, "migrations");
  try {
    await cp(source, migrationsDir, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
    const snapshotDir = join(migrationsDir, snapshotRelative);
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(join(snapshotDir, "contract.json"), `${canonicalizeJson(profile.contract)}\n`);
    await cp(join(source, baseSnapshot, "contract.d.ts"), join(snapshotDir, "contract.d.ts"));
    await writeFile(join(migrationsDir, headPath), `${canonicalizeJson({ hash: profileHash, invariants: [] })}\n`);

    const copiedFiles = await inventory(migrationsDir);
    for (const [name, bytes] of originalFiles) {
      if (name === headPath) continue;
      if (!copiedFiles.has(name) || !copiedFiles.get(name).equals(bytes)) {
        throw new Error(`Migration overlay altered historical source file ${name}`);
      }
    }
    const allowedFiles = new Set([
      headPath,
      `${snapshotRelative}/contract.json`,
      `${snapshotRelative}/contract.d.ts`,
    ]);
    const changedFiles = [...originalFiles.keys()].filter(name => name === headPath);
    const addedFiles = [...copiedFiles.keys()].filter(name => !originalFiles.has(name));
    if (addedFiles.length !== 2 || addedFiles.some(name => !allowedFiles.has(name)) ||
      copiedFiles.size !== originalFiles.size + 2) throw new Error("Migration overlay contains unexpected file changes");
    const overlayHead = JSON.parse((await readFile(join(migrationsDir, headPath), "utf8")));
    const overlayContract = JSON.parse((await readFile(join(migrationsDir, snapshotRelative, "contract.json"), "utf8")));
    if (overlayHead.hash !== profileHash || overlayContract.storage?.storageHash !== profileHash ||
      canonicalizeJson(overlayContract) !== canonicalizeJson(profile.contract)) {
      throw new Error("Migration overlay profile snapshot failed verification");
    }
    return {
      migrationsDir,
      async cleanup() { await rm(temporaryRoot, { recursive: true, force: true }); },
      evidence: {
        kind: "temporary-read-only-migration-overlay",
        profileId: profile.id,
        sourceFileCount: originalFiles.size,
        preservedHistoricalFileCount: originalFiles.size - changedFiles.length,
        changedFiles,
        addedFiles: [`${snapshotRelative}/contract.json`, `${snapshotRelative}/contract.d.ts`],
        profileStorageHash: profileHash,
      },
    };
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

export function isSupabaseVerificationOverlayPath(path) {
  const resolved = resolve(path);
  return resolved.startsWith(`${tmpdir()}/`) && resolved.split("/").at(-1) === "migrations" &&
    resolved.split("/").at(-2)?.startsWith(OVERLAY_PREFIX) === true;
}
