import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { activationTargetError, checkActivationSchema, checkVectorPrerequisites, checkFullPublicPolicyRls } from "../dist/shared/activation-schema-readiness.js";
import { resolveSupabaseCatalogProfile } from "./lib/supabase-catalog-profile.mjs";
import { createSupabaseVerificationOverlay } from "./lib/supabase-verification-overlay.mjs";
import { verifyModernSupabaseCatalogSupplement } from "./lib/verify-modern-supabase-catalog.mjs";

const MODERN_SUPABASE_PROFILE = "supabase-auth-20260831180000-storage-73-multitenant-pg17";

const API_ROOT = fileURLToPath(new URL("../", import.meta.url));
const PRISMA = fileURLToPath(new URL("../node_modules/.bin/prisma", import.meta.url));

function redactDatabaseUrls(value) {
  return String(value).replace(/(?:postgres|postgresql):\/\/[^\s"'<>]+/giu, "[redacted database URL]");
}

function redactStructured(value) {
  if (typeof value === "string") return redactDatabaseUrls(value);
  if (Array.isArray(value)) return value.map(redactStructured);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, redactStructured(nested)]));
  return value;
}

function parseArguments(argv) {
  const args = new Map();
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/u.exec(arg);
    if (!match || args.has(match[1])) return undefined;
    args.set(match[1], match[2]);
  }
  if ([...args.keys()].some(key => !["target", "expect-database", "expect-host", "expect-project"].includes(key))) return undefined;
  return args;
}

function parseJsonLines(stdout) {
  return stdout.split(/\r?\n/u).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function defaultRunPrisma(args, env) {
  const result = spawnSync(PRISMA, args, {
    cwd: API_ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 180_000,
    env: { ...env, DO_NOT_TRACK: "1", PRISMA_DISABLE_TELEMETRY: "1" },
  });
  return {
    exitCode: result.status ?? 1,
    error: result.error ? redactDatabaseUrls(result.error.message) : undefined,
    events: redactStructured(parseJsonLines(result.stdout ?? "")),
    stdout: redactDatabaseUrls(result.stdout ?? ""),
    stderr: redactDatabaseUrls(result.stderr ?? ""),
  };
}

function canonicalResult(run) {
  const event = [...(run.events ?? [])].reverse().find(item => item.kind === "result") ?? run.events?.at(-1);
  return { event, result: event?.envelope?.result ?? event?.result ?? null };
}

function canonicalIssueCount(result) {
  if (!result || !result.schema || typeof result.schema !== "object") return null;
  if (Array.isArray(result.schema.issues)) return result.schema.issues.length;
  return result.ok === true && result.mode === "full" && result.meta?.schemaVerification === "performed" ? 0 : null;
}

function blocked(id, code) { return { id, status: "BLOCKED", code }; }

/** Injectable orchestration keeps target guarding and canonical failure handling testable without a database. */
export async function verifyFullDatabase({ argv = process.argv.slice(2), env = process.env, runPrisma = defaultRunPrisma,
  checks = { checkActivationSchema, checkVectorPrerequisites, checkFullPublicPolicyRls },
  createOverlay = createSupabaseVerificationOverlay, verifyModernCatalog = verifyModernSupabaseCatalogSupplement,
  modernCatalogExpected } = {}) {
  const args = parseArguments(argv);
  if (!args) return { status: "BLOCKED", findings: [blocked("verify.arguments", "INVALID_ARGUMENTS")] };
  const target = args.get("target"), expectedDatabase = args.get("expect-database");
  const connectionString = env.DATABASE_URL;
  const targetError = activationTargetError({ connectionString, target, expectedDatabase,
    expectedHost: args.get("expect-host"), expectedProject: args.get("expect-project") });
  if (targetError) return { status: "BLOCKED", target, database: expectedDatabase,
    findings: [blocked("verify.target", targetError)] };
  let selectedProfile;
  try { selectedProfile = resolveSupabaseCatalogProfile(env.LEARNLY_SUPABASE_CATALOG_PROFILE); }
  catch { return { status: "BLOCKED", target, database: expectedDatabase,
    findings: [blocked("verify.catalogProfile", "SUPABASE_CATALOG_PROFILE_INVALID")] }; }
  const catalogProfile = selectedProfile.id;
  let overlay;
  if (catalogProfile !== "upstream") {
    try { overlay = await createOverlay({ sourceMigrationsDir: fileURLToPath(new URL("../migrations", import.meta.url)), profile: selectedProfile }); }
    catch { return { status: "BLOCKED", target, database: expectedDatabase, catalogProfile,
      findings: [blocked("verify.catalogProfileOverlay", "SUPABASE_PROFILE_OVERLAY_INVALID")] }; }
  }
  const prismaEnv = overlay ? { ...env, LEARNLY_SUPABASE_VERIFY_MIGRATIONS_DIR: overlay.migrationsDir } : env;
  const configArg = overlay ? `--config=${fileURLToPath(new URL("../prisma.verify.config.ts", import.meta.url))}` : undefined;
  try {
    const prismaArgs = ["db", "verify", `--db=${connectionString}`, "--strict", "--json", ...(configArg ? [configArg] : [])];
    const prisma = runPrisma(prismaArgs, prismaEnv);
    const canonicalRun = canonicalResult(prisma);
    const result = canonicalRun.result;
    const issueCount = canonicalIssueCount(result);
    const canonicalOk = !prisma.error && prisma.exitCode === 0 && canonicalRun.event?.envelope?.ok === true &&
      result?.ok === true && result.mode === "full" && result.meta?.schemaVerification === "performed" &&
      result.schema && typeof result.schema === "object" && result.schema.strict === true && issueCount === 0;
    const findings = [
      { id: "prisma.dbVerify", status: canonicalOk ? "PASS" : "BLOCKED",
        code: canonicalOk ? "OK" : issueCount === null ? "PRISMA_VERIFY_RESULT_MISSING" :
          issueCount > 0 ? "PRISMA_SCHEMA_ISSUES" : "PRISMA_VERIFY_FAILED" },
    ];
    const canonical = {
      catalogProfile,
      exitCode: prisma.exitCode,
      ...(prisma.error ? { error: redactDatabaseUrls(prisma.error) } : {}),
      envelope: redactStructured(canonicalRun.event?.envelope ?? null),
      result: redactStructured(result),
      events: redactStructured(prisma.events ?? []),
      stdout: redactDatabaseUrls(prisma.stdout ?? ""),
      stderr: redactDatabaseUrls(prisma.stderr ?? ""),
      issueCount,
    };

    for (const [id, check] of [["catalog.activation", checks.checkActivationSchema],
      ["catalog.vector", checks.checkVectorPrerequisites], ["catalog.publicPolicies", checks.checkFullPublicPolicyRls]]) {
      try {
        const inspection = await check({ uploads: id === "catalog.activation", connectionString, expectedDatabase });
        findings.push(...inspection.findings.map(item => ({ ...item, id: `${id}.${item.id}` })));
      } catch {
        findings.push(blocked(id, "DATABASE_UNAVAILABLE"));
      }
    }
    if (catalogProfile === MODERN_SUPABASE_PROFILE) {
      try {
        const inspection = await verifyModernCatalog({ connectionString, expected: modernCatalogExpected });
        findings.push(...inspection.findings);
      } catch {
        findings.push(blocked("catalog.modern", "DATABASE_UNAVAILABLE"));
      }
    }
    return { target, database: expectedDatabase, catalogProfile, ...(overlay ? { overlay: overlay.evidence } : {}),
      status: findings.every(item => item.status === "PASS") ? "PASS" : "BLOCKED", canonical, findings };
  } finally {
    if (overlay) await overlay.cleanup();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await verifyFullDatabase();
  process.stdout.write(JSON.stringify(result) + "\n");
  if (result.status !== "PASS") process.exitCode = 1;
}
