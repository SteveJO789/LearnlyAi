import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_PACKAGE = '@prisma/orm-toolchain';
const TARGET_VERSION = '8.0.0-rc.12';
const BUNDLE = 'aggregate-CZyUi3Gt.mjs';
export const ORIGINAL_BUNDLE_SHA256 = '7440a646d9a28fbf8f68122a0cffa1c8a84d6eb0e775a45d1b6633e3b7ab7c73';
export const PATCHED_BUNDLE_SHA256 = '996dca3c8b7aba8495040b1a11203f2b39f13e192c1cc141327fd5dd4e82ac29';
export const PATCH_MARKER = 'LEARNLY_SCHEMA_POLICY_OWNER_COMPAT_RC12_V2';

export const ORIGINAL_FUNCTION = `function stripExtraFindings(result, classify) {
\tconst droppedTablePaths = result.schema.issues.filter((issue) => issueOutcome(issue) === "not-expected" && isWholeEntityIssue(issue, classify)).map((issue) => issue.path);
\tconst issues = result.schema.issues.filter((issue) => {
\t\tif (issueOutcome(issue) !== "not-expected") return true;
\t\tif (classify?.(issue) === "structural") return true;
\t\treturn !droppedTablePaths.some((prefix) => pathIsUnder(issue.path, prefix));
\t});
\tif (issues.length === result.schema.issues.length) return result;
\tconst ok = issues.length === 0;
\tconst { code: staleCode, ...envelope } = result;
\treturn {
\t\t...envelope,
\t\tok,
\t\t...ok ? {} : { code: result.code ?? "CONTRACT.MARKER_REQUIRED" },
\t\tsummary: ok ? "Database schema satisfies contract" : result.summary,
\t\tschema: {
\t\t\tissues,
\t\t\t...result.schema.warnings !== void 0 ? { warnings: result.schema.warnings } : {}
\t\t}
\t};
}`;

export const ORIGINAL_CALL = 'schemaPerSpace.set(space.spaceId, stripExtraFindings(result, classifySubjectGranularity));';
export const PATCHED_CALL = 'schemaPerSpace.set(space.spaceId, stripExtraFindings(result, classifySubjectGranularity, aggregate, space.spaceId));';

export const PATCHED_FUNCTION = `// LEARNLY_SCHEMA_POSTGRES_POLICY_OWNERSHIP_RC12: this path shape and node kind are pinned to @prisma/orm-target-postgres@8.0.0-rc.12.
function hasSoleForeignTableOwnerPolicy(issue, aggregate, currentSpaceId) {
\tif (issueOutcome(issue) !== "not-expected" || issue.expected !== void 0 || issue.actual?.nodeKind !== "postgres-policy") return false;
\tif (!Array.isArray(issue.path) || issue.path.length !== 4 || issue.path[0] !== "database") return false;
\tconst node = issue.actual;
\tif (typeof node.namespaceId !== "string" || typeof node.tableName !== "string" || node.namespaceId !== issue.path[1] || node.tableName !== issue.path[2]) return false;
\tconst owners = aggregate?.declaringSpaces?.({ namespaceId: node.namespaceId, entityKind: "table", entityName: node.tableName });
\treturn Array.isArray(owners) && owners.length === 1 && owners[0] !== currentSpaceId;
}
function stripExtraFindings(result, classify, aggregate, currentSpaceId) {
\tconst droppedTablePaths = result.schema.issues.filter((issue) => issueOutcome(issue) === "not-expected" && isWholeEntityIssue(issue, classify)).map((issue) => issue.path);
\tconst issues = result.schema.issues.filter((issue) => {
\t\tif (issueOutcome(issue) !== "not-expected") return true;
\t\tif (hasSoleForeignTableOwnerPolicy(issue, aggregate, currentSpaceId)) return false;
\t\tif (classify?.(issue) === "structural") return true;
\t\treturn !droppedTablePaths.some((prefix) => pathIsUnder(issue.path, prefix));
\t});
\tif (issues.length === result.schema.issues.length) return result;
\tconst ok = issues.length === 0;
\tconst { code: staleCode, ...envelope } = result;
\treturn {
\t\t...envelope,
\t\tok,
\t\t...ok ? {} : { code: result.code ?? "CONTRACT.MARKER_REQUIRED" },
\t\tsummary: ok ? "Database schema satisfies contract" : result.summary,
\t\tschema: {
\t\t\tissues,
\t\t\t...result.schema.warnings !== void 0 ? { warnings: result.schema.warnings } : {}
\t\t}
\t};
}`;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function patchRuntimeBundle(source) {
  if (source.includes(PATCH_MARKER)) {
    if (!source.includes(PATCHED_FUNCTION) || !source.includes(PATCHED_CALL) || source.includes(ORIGINAL_FUNCTION) || source.includes(ORIGINAL_CALL)) {
      throw new Error('Runtime bundle contains an inconsistent schema verification compatibility patch.');
    }
    return source;
  }
  if (source.split(ORIGINAL_FUNCTION).length - 1 !== 1 || source.split(ORIGINAL_CALL).length - 1 !== 1) {
    throw new Error('Expected one unmodified aggregate projection function and callsite; refusing to patch this runtime bundle.');
  }
  return source.replace(ORIGINAL_FUNCTION, `${PATCHED_FUNCTION}\n// ${PATCH_MARKER}`).replace(ORIGINAL_CALL, PATCHED_CALL);
}

export async function installCompatibility(root = API_ROOT) {
  const packageRoot = path.join(root, 'node_modules', TARGET_PACKAGE);
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  if (packageJson.version !== TARGET_VERSION) {
    throw new Error(`Expected ${TARGET_PACKAGE}@${TARGET_VERSION}; found ${packageJson.version}.`);
  }
  const bundlePath = path.join(packageRoot, 'dist', BUNDLE);
  const source = await readFile(bundlePath, 'utf8');
  const currentHash = sha256(source);
  if (currentHash === PATCHED_BUNDLE_SHA256) {
    if (!source.includes(PATCH_MARKER) || !source.includes(PATCHED_FUNCTION) || !source.includes(PATCHED_CALL) || source.includes(ORIGINAL_FUNCTION) || source.includes(ORIGINAL_CALL)) {
      throw new Error('Installed compatibility bundle did not match its expected patched form.');
    }
    return { status: 'already-patched', packageVersion: packageJson.version, bundle: BUNDLE, sha256: currentHash };
  }
  if (currentHash !== ORIGINAL_BUNDLE_SHA256) {
    throw new Error(`Unexpected Prisma aggregate bundle hash ${currentHash}; refusing to patch.`);
  }
  const patched = patchRuntimeBundle(source);
  const patchedHash = sha256(patched);
  if (patchedHash !== PATCHED_BUNDLE_SHA256) {
    throw new Error(`Compatibility patch digest mismatch (${patchedHash}); refusing to write.`);
  }
  await writeFile(bundlePath, patched);
  return { status: 'patched', packageVersion: packageJson.version, bundle: BUNDLE, from: currentHash, to: patchedHash };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installCompatibility().then(result => console.log(`Schema verification compatibility: ${JSON.stringify(result)}`)).catch(error => {
    console.error(`Schema verification compatibility failed: ${error.message}`);
    process.exitCode = 1;
  });
}
