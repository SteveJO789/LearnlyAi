import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_PACKAGE = '@prisma/orm-target-postgres';
const TARGET_VERSION = '8.0.0-rc.12';
const EXECUTOR_TARGET_HASH = 'f099e7f519b2f869ca1c2cbbff3f96852f44830005b5af5a15022f4b813ce52b';
const ORIGINAL_BUNDLE_SHA256 = '35475d8abec9af99e3d4c5fae3ab11152c3d652753bd6a2bbde9b6cb87a75db1';
const PATCHED_BUNDLE_SHA256 = '578ded120e3332556c6626dcb9276ed9a14d621a5f57f0887881c8c105bc4065';
const PATCH_MARKER = 'LEARNLY_PRECHECK_COMPAT_RC12_V1';
const ORIGINAL_CALL = 'const precheckResult = await this.runExpectationSteps(driver, operation.precheck, operation, "precheck");';
const COMPAT_CALL = 'const precheckResult = await this.runExpectationSteps(driver, legacyPrecheckSteps(options.plan, operation), operation, "precheck");';

export const LEGACY_PRECHECK_ARTIFACTS = Object.freeze([
  {
    directory: '20261010T0331_fresh_supabase_mvp_baseline',
    migrationHash: '981aa79542b10398f12b7ae1b7f0b3164ad556bb114601934e361afd6e2dc7ff',
    destinationHash: 'd17a8bc493eb8d240a7a2d0c664b00ec49f5823963634f78f5385a01bd26b397',
    migrationSourceSha256: '5f38cd98e2c5f78180877cdf4391a43f31e8980fb9396f62c157a78d074e2736',
    opsSha256: '966092a270bb8bc7f43a5c222c177f87ff71b31c8d050464f78217631ab1a2a7',
    operationIds: [
      'security.fresh-app-grants.User',
      'security.fresh-app-grants.LearningSession',
      'security.fresh-app-grants.Message',
      'security.fresh-app-grants.SourceMaterial',
      'security.fresh-app-grants.Assessment',
      'security.fresh-app-grants.AssessmentAnswer',
      'security.fresh-app-grants.LearningProfile',
      'security.fresh-app-grants.AIRequest',
    ],
  },
  {
    directory: '20261010T1119_durable_file_uploads',
    migrationHash: '56858737a1054c6ca05679492783ee760bd77f0f8ddaa7b70c9e761dfe574930',
    destinationHash: '26370da7801afacb9339a0042e2e9a52e649a78266738c309f99ea103867fa0a',
    migrationSourceSha256: '587f9800921a39b986c03217ec5bf5d7ab3504b133870b9e91804c5f20bf1f42',
    opsSha256: '47a9de36dab4518d38cf086290c45f47816cc9125cacf11ac4619ac0e94063ca',
    operationIds: ['security.grant-file-upload-api-access'],
  },
  {
    directory: '20261010T1653_file_material_review',
    migrationHash: '6276f2aed07c583d46bd9571e8243d42ebb590b5de099e0babba2bbcc93ea39a',
    destinationHash: '0039047422dff2448bd0223d8c5b74d4ef5beca41b455f665d5168bf03759620',
    migrationSourceSha256: 'bd21b92b9cf2f05784faa22510307670acaa6b9a98fdf9b7ceb1977264fd4c4a',
    opsSha256: 'd4b7eb788b03fb5cea89ffb7bfc56f95765867efb4dd4b5005f14960dd4ce924',
    operationIds: ['security.grant-material-review-metadata'],
  },
  {
    directory: '20261010T1750_reviewed_knowledge_vectors',
    migrationHash: '6aeacf4600439808822db77f19add5b18af5977f1fccecab59b13fa5b1ae6df2',
    destinationHash: '5e6080d9d23dfa0183e4bbecfe0e5dfc14556f2304e686f5dccabe42280ac2ab',
    migrationSourceSha256: 'ee8639b2c6f2ae328b5bf718ec4f9a59b51a7ee3d10fa40cf6ffd9185f12ecdf',
    opsSha256: 'd680668d96f417e2a43dcf35afe878340ee9237218eed6174b54a2ace7a15d39',
    operationIds: ['knowledge.require-extensions-vector', 'knowledge.read-only-grants'],
  },
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function assertKnownRuntimeBundleHash(source) {
  const hash = sha256(source);
  if (hash !== ORIGINAL_BUNDLE_SHA256 && hash !== PATCHED_BUNDLE_SHA256) {
    throw new Error(`Unexpected Postgres target control bundle hash ${hash}; refusing to patch.`);
  }
  return hash;
}

export function operationFingerprint(operation) {
  return JSON.stringify([
    operation.id,
    operation.execute,
    operation.postcheck,
    operation.invariantId ?? null,
  ]);
}

export function legacyPrecheckSteps(plan, operation, knownOperations) {
  if (Array.isArray(operation.precheck)) return operation.precheck;
  if (operation.precheck !== undefined) throw new TypeError(`Refusing malformed precheck on ${operation.id}.`);
  const expected = knownOperations?.get(plan?.destination?.storageHash)?.get(operation.id);
  if (plan?.targetId !== 'postgres' || plan?.spaceId !== 'app' || expected !== operationFingerprint(operation)) {
    throw new TypeError(`Refusing an unmanifested missing precheck on ${operation.id} (target=${plan?.targetId ?? 'missing'}, destination=${plan?.destination?.storageHash ?? 'missing'}).`);
  }
  return [];
}

export function patchRuntimeBundle(source, knownOperations) {
  if (source.includes(PATCH_MARKER)) {
    if (!source.includes(COMPAT_CALL) || source.includes(ORIGINAL_CALL)) throw new Error('Runtime bundle contains an inconsistent compatibility patch.');
    return source;
  }
  const matches = source.split(ORIGINAL_CALL).length - 1;
  if (matches !== 1) throw new Error('Expected one unmodified Postgres precheck callsite; refusing to patch this runtime bundle.');
  const serializedManifest = JSON.stringify([...knownOperations].map(([target, operations]) => [target, [...operations]]));
  const helper = `// ${PATCH_MARKER}\nconst LEARNLY_LEGACY_PRECHECKS = new Map(${serializedManifest}.map(([target, operations]) => [target, new Map(operations)]));\nfunction legacyPrecheckFingerprint(operation) {\n\treturn JSON.stringify([operation.id, operation.execute, operation.postcheck, operation.invariantId ?? null]);\n}\nfunction legacyPrecheckSteps(plan, operation) {\n\tif (Array.isArray(operation.precheck)) return operation.precheck;\n\tif (operation.precheck !== void 0) throw new TypeError(\`Refusing malformed precheck on \${operation.id}.\`);\n\tconst expected = LEARNLY_LEGACY_PRECHECKS.get(plan?.destination?.storageHash)?.get(operation.id);\n\tif (plan?.targetId !== "postgres" || plan?.spaceId !== "app" || expected !== legacyPrecheckFingerprint(operation)) throw new TypeError(\`Refusing an unmanifested missing precheck on \${operation.id} (target=\${plan?.targetId ?? "missing"}, space=\${plan?.spaceId ?? "missing"}, destination=\${plan?.destination?.storageHash ?? "missing"}).\`);\n\treturn [];\n}\n`;
  const classStart = 'var PostgresMigrationRunner = class {';
  if (source.split(classStart).length - 1 !== 1) throw new Error('Expected one Postgres migration runner class; refusing to patch this runtime bundle.');
  return source.replace(classStart, () => `${helper}${classStart}`).replace(ORIGINAL_CALL, COMPAT_CALL);
}

export async function verifyLegacyArtifacts(root) {
  const observedMissing = new Map();
  const knownOperations = new Map();
  for (const artifact of LEGACY_PRECHECK_ARTIFACTS) {
    const directory = path.join(root, 'migrations', 'app', artifact.directory);
    const migrationBytes = await readFile(path.join(directory, 'migration.json'));
    const migrationSourceBytes = await readFile(path.join(directory, 'migration.ts'));
    const opsBytes = await readFile(path.join(directory, 'ops.json'));
    const migration = JSON.parse(migrationBytes.toString('utf8'));
    const operations = JSON.parse(opsBytes.toString('utf8'));
    if (migration.migrationHash !== artifact.migrationHash || migration.to !== artifact.destinationHash) {
      throw new Error(`Legacy migration identity changed for ${artifact.directory}; no compatibility patch installed.`);
    }
    if (sha256(opsBytes) !== artifact.opsSha256 || !Array.isArray(operations)) {
      throw new Error(`Legacy migration operations changed for ${artifact.directory}; no compatibility patch installed.`);
    }
    if (sha256(migrationSourceBytes) !== artifact.migrationSourceSha256) {
      throw new Error(`Legacy migration source changed for ${artifact.directory}; no compatibility patch installed.`);
    }
    const missingPrechecks = operations.filter(operation => !Object.hasOwn(operation, 'precheck')).map(operation => operation.id).sort();
    const expectedIds = [...artifact.operationIds].sort();
    if (JSON.stringify(missingPrechecks) !== JSON.stringify(expectedIds)) {
      throw new Error(`Legacy precheck omission set changed for ${artifact.directory}; no compatibility patch installed.`);
    }
    for (const operation of operations) {
      if (artifact.operationIds.includes(operation.id) && (!Array.isArray(operation.execute) || !Array.isArray(operation.postcheck))) {
        throw new Error(`Legacy operation ${operation.id} is missing execute or postcheck steps.`);
      }
      if (artifact.operationIds.includes(operation.id)) {
        const fingerprint = operationFingerprint(operation);
        for (const destinationHash of [artifact.destinationHash, EXECUTOR_TARGET_HASH]) {
          if (!knownOperations.has(destinationHash)) knownOperations.set(destinationHash, new Map());
          knownOperations.get(destinationHash).set(operation.id, fingerprint);
        }
      }
    }
    for (const id of artifact.operationIds) observedMissing.set(`${artifact.destinationHash}:${id}`, true);
  }
  if (observedMissing.size !== 12) throw new Error('Expected exactly twelve known legacy precheck omissions.');
  return knownOperations;
}

export async function installCompatibility(root = API_ROOT) {
  const knownOperations = await verifyLegacyArtifacts(root);
  const packageJson = JSON.parse(await readFile(path.join(root, 'node_modules', TARGET_PACKAGE, 'package.json'), 'utf8'));
  if (packageJson.version !== TARGET_VERSION) throw new Error(`Expected ${TARGET_PACKAGE}@${TARGET_VERSION}; found ${packageJson.version}.`);
  const distDirectory = path.join(root, 'node_modules', TARGET_PACKAGE, 'dist');
  const bundles = (await readdir(distDirectory)).filter(name => /^control-.+\.mjs$/u.test(name));
  const candidates = [];
  for (const bundle of bundles) {
    const candidatePath = path.join(distDirectory, bundle);
    const candidateSource = await readFile(candidatePath, 'utf8');
    let candidateHash;
    try { candidateHash = assertKnownRuntimeBundleHash(candidateSource); } catch { continue; }
    if (candidateHash === ORIGINAL_BUNDLE_SHA256 || candidateHash === PATCHED_BUNDLE_SHA256) {
      candidates.push({ bundle, bundlePath: candidatePath, source: candidateSource, hash: candidateHash });
    }
  }
  if (candidates.length !== 1) throw new Error(`Expected one known Postgres runner bundle; found ${candidates.length}.`);
  const [{ bundle, bundlePath, source, hash: currentHash }] = candidates;
  if (currentHash === ORIGINAL_BUNDLE_SHA256) {
    const patched = patchRuntimeBundle(source, knownOperations);
    const patchedHash = sha256(patched);
    if (patchedHash !== PATCHED_BUNDLE_SHA256) throw new Error(`Compatibility patch digest mismatch (${patchedHash}); refusing to write.`);
    await writeFile(bundlePath, patched);
    return { status: 'patched', packageVersion: packageJson.version, bundle, from: currentHash, to: patchedHash };
  }
  if (currentHash === PATCHED_BUNDLE_SHA256) {
    if (!source.includes(PATCH_MARKER) || !source.includes(COMPAT_CALL) || source.includes(ORIGINAL_CALL)) throw new Error('Installed compatibility bundle did not match its expected patched form.');
    return { status: 'already-patched', packageVersion: packageJson.version, bundle, sha256: currentHash };
  }
  throw new Error(`Unexpected Postgres target control bundle hash ${currentHash}; refusing to patch.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installCompatibility().then(result => console.log(`Migration precheck compatibility: ${JSON.stringify(result)}`)).catch(error => {
    console.error(`Migration precheck compatibility failed: ${error.message}`);
    process.exitCode = 1;
  });
}
