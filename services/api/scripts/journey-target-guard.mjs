const LOOPBACK = ["127.0.0.1", "localhost", "[::1]"];
const PHASE_A_DATABASE = "learnly_activation_executor_phase_a_services_20261017";
const PRODUCTION_REHEARSAL_DATABASE = "learnly_production_rehearsal_20261017";
const PINNED_CA = "/workspace/learnly-activation-runtime/certs/local-cert.pem";

export function requireLocalDatabase(value, argv = []) {
  let parsed;
  try { parsed = new URL(value ?? ""); } catch { throw new Error("A local journey database URL is required"); }
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  const loopback = LOOPBACK.includes(parsed.hostname);
  const expectedArgs = argv.filter(arg => arg.startsWith("--expect-database="));
  if (expectedArgs.length > 1 || argv.includes("--expect-database")) throw new Error("Invalid expected journey database argument");
  const expectedDatabase = expectedArgs[0]?.slice("--expect-database=".length);
  const localFixture = argv.includes("--local-supabase-fixture");
  const productionRehearsalFixture = argv.includes("--production-rehearsal-fixture");
  if (localFixture && productionRehearsalFixture) throw new Error("Choose exactly one local journey fixture mode");
  const namedJourneyDb = !expectedDatabase && loopback && parsed.port === "55432" && /^learnly_activation_journey_[a-z0-9_]{1,48}$/u.test(databaseName);
  const isolatedSupabaseDb = localFixture && !expectedDatabase && loopback && parsed.port === "55434" && databaseName === "postgres";
  const phaseAFixtureDb = localFixture && expectedDatabase === PHASE_A_DATABASE && loopback &&
    parsed.port === "55434" && databaseName === PHASE_A_DATABASE;
  const productionRehearsalDb = productionRehearsalFixture && expectedDatabase === PRODUCTION_REHEARSAL_DATABASE && loopback &&
    parsed.port === "55435" && databaseName === PRODUCTION_REHEARSAL_DATABASE;
  if (!((parsed.protocol === "postgres:" || parsed.protocol === "postgresql:") && (namedJourneyDb || isolatedSupabaseDb || phaseAFixtureDb || productionRehearsalDb) &&
    !parsed.search && !parsed.hash)) {
    throw new Error("Use loopback:55432 with a learnly_activation_journey_* DB, or explicitly identify an approved loopback local fixture database");
  }
  return { databaseName, value, isolatedSupabaseDb: isolatedSupabaseDb || phaseAFixtureDb || productionRehearsalDb,
    phaseAFixtureDb, ...(productionRehearsalDb ? { productionRehearsalDb: true } : {}) };
}

export function requireLocalAuth(value, { realStorageMode = false, phaseAFixtureDb = false, productionRehearsalDb = false, extraCaCerts } = {}) {
  let parsed;
  try { parsed = new URL(value ?? ""); } catch { throw new Error("A local Supabase URL is required"); }
  const safeShape = !parsed.username && !parsed.password && parsed.pathname === "/" && parsed.search === "" && parsed.hash === "";
  const localHttp = parsed.protocol === "http:" && LOOPBACK.includes(parsed.hostname) && ["54321", "8000"].includes(parsed.port);
  const pinnedCa = extraCaCerts === PINNED_CA;
  const oldGatewayTls = realStorageMode && parsed.origin === "https://127.0.0.1:54443" && pinnedCa;
  const phaseAGatewayTls = realStorageMode && phaseAFixtureDb && parsed.origin === "https://127.0.0.1:54444" && pinnedCa;
  const productionRehearsalGatewayTls = realStorageMode && productionRehearsalDb && parsed.origin === "https://127.0.0.1:54445" && pinnedCa;
  const acceptedLocalAuth = productionRehearsalDb ? productionRehearsalGatewayTls :
    (localHttp || oldGatewayTls || phaseAGatewayTls);
  if (!safeShape || !acceptedLocalAuth) {
    throw new Error("Use local Auth HTTP, or the exact local HTTPS gateway with its pinned CA in --real-storage mode");
  }
  return parsed.origin;
}
