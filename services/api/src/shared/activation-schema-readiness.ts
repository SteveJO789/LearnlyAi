import { Client } from "pg";
import contract from "../prisma/contract.json" with { type: "json" };
import catalogSignatures from "./activation-catalog-signatures.json" with { type: "json" };

type ClientLike = Pick<Client, "query">;
type CatalogRow = Record<string, unknown>;

const expectedCore = contract.storage.storageHash;
const expectedProfile = contract.profileHash;
const publicEntries = contract.storage.namespaces.public.entries;
const assessmentTables = ["User", "LearningSession", "Message", "SourceMaterial", "Assessment", "AssessmentAnswer", "LearningProfile"] as const;
const uploadTables = [...assessmentTables, "FileUpload"] as const;
const assessmentGrants: Record<string, string[]> = {
  User: ["SELECT", "INSERT", "UPDATE"], LearningSession: ["SELECT", "INSERT", "UPDATE"],
  Message: ["SELECT", "INSERT"], SourceMaterial: ["SELECT", "INSERT"],
  Assessment: ["SELECT", "INSERT", "UPDATE"], AssessmentAnswer: ["SELECT", "INSERT"],
  LearningProfile: ["SELECT", "INSERT", "UPDATE"],
};
const uploadGrants = { ...assessmentGrants, FileUpload: ["SELECT", "INSERT", "UPDATE"] };

export type ActivationFinding = Readonly<{ id: string; status: "PASS" | "BLOCKED"; code: string }>;
export type ActivationInspection = Readonly<{ status: "PASS" | "BLOCKED"; findings: readonly ActivationFinding[] }>;

/** Enforces an operator-supplied target identity before any database connection is opened. */
export function activationTargetError(input: { connectionString?: string; target: string; expectedDatabase?: string;
  expectedHost?: string; expectedProject?: string }): string | undefined {
  const { connectionString, target, expectedDatabase, expectedHost, expectedProject } = input;
  if (!["local", "remote"].includes(target) || !expectedDatabase || !/^[a-zA-Z0-9_-]{1,63}$/u.test(expectedDatabase) ||
    (target === "local" && Boolean(expectedHost || expectedProject)) ||
    (target === "remote" && (!expectedHost && !expectedProject || Boolean(expectedHost && !/^[a-zA-Z0-9.-]+$/u.test(expectedHost)) ||
      Boolean(expectedProject && !/^[a-zA-Z0-9-]{1,64}$/u.test(expectedProject))))) return "INVALID_ARGUMENTS";
  if (!connectionString) return "DATABASE_CONFIGURATION_MISSING";
  try {
    const url = new URL(connectionString);
    const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
    for (const key of ["host", "hostaddr", "dbname", "database", "service"]) {
      if (url.searchParams.getAll(key).length > 1) return "DATABASE_TARGET_INVALID";
    }
    const configuredHost = url.searchParams.get("host") ?? url.hostname;
    const configuredDatabase = url.searchParams.get("dbname") ?? url.searchParams.get("database") ?? database;
    if (url.searchParams.has("hostaddr") || url.searchParams.has("service")) return "DATABASE_TARGET_INVALID";
    const hostMatches = target === "local"
      ? ["localhost", "127.0.0.1", "::1", "[::1]"].includes(configuredHost)
      : (!expectedHost || configuredHost === expectedHost) && (!expectedProject || configuredHost.startsWith(`${expectedProject}.`));
    return ["postgres:", "postgresql:"].includes(url.protocol) && hostMatches && database === expectedDatabase && configuredDatabase === expectedDatabase
      ? undefined : "DATABASE_TARGET_MISMATCH";
  } catch { return "DATABASE_TARGET_INVALID"; }
}

type CatalogSignature = { id: string; source: string | null; deparsed: string | null };
const signatureManifest = catalogSignatures as { postgresMajor: number; coreHash: string; profileHash: string; entries: CatalogSignature[] };
function matchesCatalogSignature(id: string, source: unknown, actual: unknown, serverMajor: number): boolean {
  const signature = signatureManifest.entries.find(entry => entry.id === id);
  return serverMajor === signatureManifest.postgresMajor && signatureManifest.coreHash === expectedCore &&
    signatureManifest.profileHash === expectedProfile && Boolean(signature) &&
    signature?.source === (source ?? null) && signature.deparsed === (actual ?? null);
}
function finding(id: string, ok: boolean, code: string): ActivationFinding {
  return { id, status: ok ? "PASS" : "BLOCKED", code: ok ? "OK" : code };
}

/** Fixed, read-only catalog inspection. Results contain no database error text or credentials. */
export async function inspectActivationSchema(client: ClientLike, options: { uploads?: boolean; expectedDatabase?: string } = {}): Promise<ActivationInspection> {
  const findings: ActivationFinding[] = [];
  const tables: readonly string[] = options.uploads ? uploadTables : assessmentTables;
  const versionResult = await client.query<CatalogRow>("SELECT current_setting('server_version_num')::integer AS version");
  const serverMajor = Math.floor(Number(versionResult.rows[0]?.version) / 10000);
  findings.push(finding("catalog.signatureVersion", serverMajor === signatureManifest.postgresMajor &&
    signatureManifest.coreHash === expectedCore && signatureManifest.profileHash === expectedProfile, "CATALOG_SIGNATURE_VERSION_UNSUPPORTED"));
  if (options.expectedDatabase) {
    const actual = (await client.query<CatalogRow>("SELECT current_database() AS name")).rows[0]?.name;
    if (actual !== options.expectedDatabase) return { status: "BLOCKED", findings: [finding("target.database", false, "DATABASE_TARGET_MISMATCH")] };
    findings.push(finding("target.database", true, "OK"));
  }
  const markerExists = (await client.query<CatalogRow>("SELECT to_regclass('prisma_contract.marker') IS NOT NULL AS \"exists\"")).rows[0]?.exists === true;
  const markerResult = markerExists ? await client.query<CatalogRow>(
    "SELECT core_hash AS \"coreHash\", profile_hash AS \"profileHash\" FROM prisma_contract.marker WHERE space = 'app'",
  ) : { rows: [] as CatalogRow[] };
  const marker = markerResult.rows.length === 1 ? markerResult.rows[0] : undefined;
  findings.push(finding("schema.marker", marker?.coreHash === expectedCore && marker?.profileHash === expectedProfile, "SCHEMA_MARKER_MISMATCH"));

  const columns = await client.query<CatalogRow>(
    `SELECT table_name AS "tableName", column_name AS "columnName", data_type AS "dataType", udt_name AS "udtName", is_nullable AS "isNullable"
       FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[])`, [tables],
  );
  const colSet = new Set(columns.rows.map(row => `${row.tableName}.${row.columnName}`));
  const expectedColumns = tables.flatMap(table => Object.entries(publicEntries.table[table as keyof typeof publicEntries.table].columns)
    .map(([column, definition]) => ({ id: `${table}.${column}`, nativeType: definition.nativeType, nullable: definition.nullable })));
  const columnDetails = new Map(columns.rows.map(row => [`${row.tableName}.${row.columnName}`, row]));
  const columnsMatch = expectedColumns.every(column => {
    const row = columnDetails.get(column.id);
    return colSet.has(column.id) && row?.udtName === column.nativeType && row.isNullable === (column.nullable ? "YES" : "NO");
  });
  findings.push(finding("schema.columns", columnsMatch, "SCHEMA_COLUMNS_MISSING_OR_MISMATCHED"));

  const constraints = await client.query<CatalogRow>(
    `SELECT c.relname AS "tableName", con.conname AS "constraintName", pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) AND con.contype = 'c'`, [tables],
  );
  const expectedChecks = tables.flatMap(table => {
    const definition = publicEntries.table[table as keyof typeof publicEntries.table] as { checks?: Array<{ name: string; expression: string }> };
    return (definition.checks ?? []).map(check => ({ table, name: check.name, expression: (definition.checks ?? []).find(expected => expected.name === check.name)?.expression }));
  });
  const checksMatch = expectedChecks.every(expected => {
    const actual = constraints.rows.find(row => row.tableName === expected.table && row.constraintName === expected.name);
    return Boolean(actual && matchesCatalogSignature(`check:${expected.table}:${expected.name}`, expected.expression, actual.definition, serverMajor));
  });
  findings.push(finding("schema.checks", checksMatch, "SCHEMA_CHECKS_MISSING_OR_MISMATCHED"));

  const rls = await client.query<CatalogRow>(
    `SELECT c.relname AS "tableName", c.relkind AS kind, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
            pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`, [tables],
  );
  const rlsEnabled = new Set(rls.rows.filter(row => ["r", "p"].includes(String(row.kind)) && row.enabled === true).map(row => row.tableName));
  findings.push(finding("security.rls", tables.every(table => rlsEnabled.has(table)), "RLS_DISABLED"));

  const grants = await client.query<CatalogRow>(
    `SELECT table_name AS "tableName", privilege_type AS privilege FROM information_schema.table_privileges
      WHERE table_schema = 'public' AND grantee = 'authenticated' AND table_name = ANY($1::text[])`, [tables],
  );
  const grantSet = new Set(grants.rows.map(row => `${row.tableName}.${row.privilege}`));
  const expected = options.uploads ? uploadGrants : assessmentGrants;
  const grantsOk = Object.entries(expected).every(([table, privileges]) => privileges.every(privilege => grantSet.has(`${table}.${privilege}`)));
  findings.push(finding("security.grants", grantsOk, "APP_GRANTS_MISSING"));
  const sourceMaterialColumnGrant = await client.query<CatalogRow>(
    `SELECT CASE WHEN to_regclass('public."SourceMaterial"') IS NULL OR to_regrole('authenticated') IS NULL THEN false
      ELSE has_column_privilege('authenticated', 'public."SourceMaterial"', 'metadata', 'UPDATE') END AS allowed`,
  );
  findings.push(finding("security.columnGrants", sourceMaterialColumnGrant.rows[0]?.allowed === true, "APP_COLUMN_GRANTS_MISSING"));

  const roleState = await client.query<CatalogRow>(
    `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS authenticated,
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS anon,
            EXISTS (WITH RECURSIVE reachable(oid) AS (
              SELECT oid FROM pg_roles WHERE rolname = 'authenticated'
              UNION SELECT m.roleid FROM pg_auth_members m JOIN reachable r ON r.oid = m.member
            ) SELECT 1 FROM reachable x JOIN pg_roles r ON r.oid = x.oid WHERE r.rolsuper OR r.rolbypassrls) AS "authenticatedBypass",
            EXISTS (WITH RECURSIVE reachable(oid) AS (
              SELECT oid FROM pg_roles WHERE rolname = 'anon'
              UNION SELECT m.roleid FROM pg_auth_members m JOIN reachable r ON r.oid = m.member
            ) SELECT 1 FROM reachable x JOIN pg_roles r ON r.oid = x.oid WHERE r.rolsuper OR r.rolbypassrls) AS "anonBypass",
            EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) AND NOT c.relforcerowsecurity
                AND (pg_has_role(to_regrole('authenticated'), c.relowner, 'MEMBER') OR ($2::boolean AND pg_has_role(to_regrole('anon'), c.relowner, 'MEMBER')))) AS "tableOwnershipBypass",
            EXISTS (SELECT 1 FROM pg_roles authenticator JOIN pg_auth_members m ON m.member = authenticator.oid
            JOIN pg_roles granted ON granted.oid = m.roleid WHERE authenticator.rolname = 'authenticator' AND granted.rolname = 'authenticated' AND m.set_option) AS "authenticatorCanAssumeAuthenticated"`,
    [tables, Boolean(options.uploads)],
  );
  const roles = roleState.rows[0];
  findings.push(finding("security.roles", roles?.authenticated === true && (!options.uploads || roles?.anon === true), "AUTH_ROLES_MISSING"));
  findings.push(finding("security.roleMembership", roles?.authenticatorCanAssumeAuthenticated === true, "AUTH_ROLE_MEMBERSHIP_MISSING"));
  findings.push(finding("security.noPolicyBypass", roles?.authenticatedBypass === false && (!options.uploads || roles?.anonBypass === false) &&
    roles?.tableOwnershipBypass === false,
    "APP_ROLE_CAN_BYPASS_RLS"));

  const policies = await client.query<CatalogRow>(
    `SELECT tablename AS "tableName", policyname AS name, permissive = 'PERMISSIVE' AS permissive, roles::text[] AS roles, cmd, qual, with_check AS "withCheck"
       FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY($1::text[])`, [tables],
  );
  const expectedPolicySet = requiredPolicySpecs(tables);
  const policiesOk = policies.rows.length === expectedPolicySet.length && expectedPolicySet.every(spec => {
    const row = policies.rows.find(candidate => candidate.name === spec.name && candidate.tableName === spec.table);
    if (!row || row.permissive !== spec.permissive || !Array.isArray(row.roles) || JSON.stringify([...row.roles].sort()) !== JSON.stringify([...spec.roles].sort()) || row.cmd !== spec.command) return false;
    return matchesCatalogSignature(`policy:public:${spec.table}:${spec.name}:using`, spec.using, row.qual, serverMajor) &&
      matchesCatalogSignature(`policy:public:${spec.table}:${spec.name}:withCheck`, spec.withCheck, row.withCheck, serverMajor);
  });
  findings.push(finding("security.trustedPolicies", policiesOk, "TRUSTED_POLICY_MISSING_OR_WEAK"));

  if (options.uploads) {
    const storageSchemaUsage = await client.query<CatalogRow>(
      `SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
          OR to_regnamespace('storage') IS NULL THEN false
        ELSE has_schema_privilege('authenticated', 'storage', 'USAGE') END AS allowed`,
    );
    findings.push(finding("uploads.storageSchemaUsage", storageSchemaUsage.rows[0]?.allowed === true,
      "STORAGE_SCHEMA_USAGE_MISSING"));
    const storageObjectGrants = await client.query<CatalogRow>(
      `SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
          OR to_regclass('storage.objects') IS NULL THEN false
        ELSE has_table_privilege('authenticated', 'storage.objects', 'SELECT')
          AND has_table_privilege('authenticated', 'storage.objects', 'INSERT')
          AND has_table_privilege('authenticated', 'storage.objects', 'UPDATE')
          AND has_table_privilege('authenticated', 'storage.objects', 'DELETE') END AS allowed`,
    );
    findings.push(finding("uploads.storageObjectGrants", storageObjectGrants.rows[0]?.allowed === true,
      "STORAGE_OBJECT_GRANTS_MISSING"));
    const storageRls = await client.query<CatalogRow>(
      `SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
          (pg_has_role(to_regrole('authenticated'), c.relowner, 'MEMBER') OR pg_has_role(to_regrole('anon'), c.relowner, 'MEMBER')) AS "actorOwnsTable"
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'storage' AND c.relname = 'objects' AND c.relkind IN ('r','p')`,
    );
    findings.push(finding("uploads.storageRls", storageRls.rows[0]?.enabled === true, "STORAGE_RLS_DISABLED"));
    findings.push(finding("uploads.noPolicyBypass", !(storageRls.rows[0]?.actorOwnsTable === true && storageRls.rows[0]?.forced !== true),
      "STORAGE_OWNER_CAN_BYPASS_RLS"));
    const bucketsExist = (await client.query<CatalogRow>("SELECT to_regclass('storage.buckets') IS NOT NULL AS \"exists\"")).rows[0]?.exists === true;
    const bucket = bucketsExist ? await client.query<CatalogRow>(
      "SELECT id, name, public, file_size_limit AS \"fileSizeLimit\", allowed_mime_types AS \"allowedMimeTypes\" FROM storage.buckets WHERE id = 'learnly-materials'",
    ) : { rows: [] as CatalogRow[] };
    const b = bucket.rows[0];
    const mime = Array.isArray(b?.allowedMimeTypes) ? [...b.allowedMimeTypes].sort() : [];
    findings.push(finding("uploads.bucket", b?.id === "learnly-materials" && b.public === false && Number(b.fileSizeLimit) === 3145728 &&
      JSON.stringify(mime) === JSON.stringify(["application/pdf", "image/jpeg", "image/png"]), "UPLOAD_BUCKET_MISMATCH"));
    const storagePolicies = await client.query<CatalogRow>(
      "SELECT policyname AS name, permissive = 'PERMISSIVE' AS permissive, roles::text[] AS roles, cmd, qual, with_check AS \"withCheck\" FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'",
    );
    const storageOk = requiredStoragePolicies.every(spec => {
      const row = storagePolicies.rows.find(candidate => candidate.name === spec.name);
      if (!row || row.permissive !== spec.permissive || row.cmd !== spec.command || !Array.isArray(row.roles) || JSON.stringify([...row.roles].sort()) !== JSON.stringify([spec.role])) return false;
      return matchesCatalogSignature(`policy:storage:objects:${spec.name}:using`, spec.using, row.qual, serverMajor) &&
        matchesCatalogSignature(`policy:storage:objects:${spec.name}:withCheck`, spec.withCheck, row.withCheck, serverMajor);
    });
    findings.push(finding("uploads.storagePolicies", storageOk, "STORAGE_POLICY_MISSING_OR_WEAK"));
  }

  return { status: findings.every(item => item.status === "PASS") ? "PASS" : "BLOCKED", findings };
}

/** Separate optional vector extension and reviewed-index prerequisites; never invoked for lexical mode. */
export async function inspectVectorPrerequisites(client: ClientLike, expectedDatabase?: string): Promise<ActivationInspection> {
  const findings: ActivationFinding[] = [];
  const versionResult = await client.query<CatalogRow>("SELECT current_setting('server_version_num')::integer AS version");
  const serverMajor = Math.floor(Number(versionResult.rows[0]?.version) / 10000);
  findings.push(finding("catalog.signatureVersion", serverMajor === signatureManifest.postgresMajor &&
    signatureManifest.coreHash === expectedCore && signatureManifest.profileHash === expectedProfile, "CATALOG_SIGNATURE_VERSION_UNSUPPORTED"));
  if (expectedDatabase) {
    const actual = (await client.query<CatalogRow>("SELECT current_database() AS name")).rows[0]?.name;
    if (actual !== expectedDatabase) return { status: "BLOCKED", findings: [finding("target.database", false, "DATABASE_TARGET_MISMATCH")] };
    findings.push(finding("target.database", true, "OK"));
  }
  const markerExists = (await client.query<CatalogRow>("SELECT to_regclass('prisma_contract.marker') IS NOT NULL AS \"exists\"")).rows[0]?.exists === true;
  const markerResult = markerExists ? await client.query<CatalogRow>(
    "SELECT core_hash AS \"coreHash\", profile_hash AS \"profileHash\" FROM prisma_contract.marker WHERE space = 'app'",
  ) : { rows: [] as CatalogRow[] };
  const marker = markerResult.rows.length === 1 ? markerResult.rows[0] : undefined;
  findings.push(finding("vector.marker", marker?.coreHash === expectedCore && marker?.profileHash === expectedProfile, "SCHEMA_MARKER_MISMATCH"));
  const extension = await client.query<CatalogRow>(
    `SELECT n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'vector'`,
  );
  findings.push(finding("vector.extension", extension.rows[0]?.schema === "extensions", "VECTOR_EXTENSION_MISSING_OR_WRONG_SCHEMA"));
  const extensionUsage = await client.query<CatalogRow>(
    `SELECT CASE WHEN to_regnamespace('extensions') IS NULL OR to_regrole('authenticated') IS NULL THEN false
      ELSE has_schema_privilege('authenticated', 'extensions', 'USAGE') END AS allowed`,
  );
  findings.push(finding("vector.extensionUsage", extensionUsage.rows[0]?.allowed === true, "VECTOR_EXTENSION_SCHEMA_USAGE_MISSING"));
  const column = await client.query<CatalogRow>(
    `SELECT typeNamespace.nspname AS "typeNamespace", type.typname AS "typeName", a.atttypmod AS "typeModifier"
       FROM pg_attribute a JOIN pg_type type ON type.oid = a.atttypid
       JOIN pg_namespace typeNamespace ON typeNamespace.oid = type.typnamespace
      WHERE a.attrelid = to_regclass('public."KnowledgeChunk"') AND a.attname = 'embedding' AND a.attnum > 0 AND NOT a.attisdropped`,
  );
  findings.push(finding("vector.embeddingColumn", column.rows[0]?.typeNamespace === "extensions" && column.rows[0]?.typeName === "vector" &&
    Number(column.rows[0]?.typeModifier) === 1536, "VECTOR_COLUMN_MISMATCH"));
  const table = await client.query<CatalogRow>(
    `SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS forced, c.relkind AS kind,
        (pg_has_role('authenticated', c.relowner, 'MEMBER') OR pg_has_role('anon', c.relowner, 'MEMBER')) AS "actorOwnsTable"
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'KnowledgeChunk'`,
  );
  findings.push(finding("vector.tableRls", ["r", "p"].includes(String(table.rows[0]?.kind)) && table.rows[0]?.rls === true,
    "VECTOR_TABLE_OR_RLS_MISSING"));
  const roleBypass = await client.query<CatalogRow>(
    `SELECT EXISTS (WITH RECURSIVE reachable(oid) AS (
        SELECT oid FROM pg_roles WHERE rolname = 'authenticated'
        UNION SELECT m.roleid FROM pg_auth_members m JOIN reachable r ON r.oid = m.member
      ) SELECT 1 FROM reachable x JOIN pg_roles r ON r.oid = x.oid WHERE r.rolsuper OR r.rolbypassrls) AS authenticated,
      EXISTS (WITH RECURSIVE reachable(oid) AS (
        SELECT oid FROM pg_roles WHERE rolname = 'anon'
        UNION SELECT m.roleid FROM pg_auth_members m JOIN reachable r ON r.oid = m.member
      ) SELECT 1 FROM reachable x JOIN pg_roles r ON r.oid = x.oid WHERE r.rolsuper OR r.rolbypassrls) AS anon`,
  );
  findings.push(finding("vector.noPolicyBypass", roleBypass.rows[0]?.authenticated === false && roleBypass.rows[0]?.anon === false &&
    (table.rows[0]?.actorOwnsTable !== true || table.rows[0]?.forced === true), "APP_ROLE_CAN_BYPASS_RLS"));
  const policy = await client.query<CatalogRow>(
    `SELECT policyname AS name, permissive = 'PERMISSIVE' AS permissive, roles::text[] AS roles, cmd, qual
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'KnowledgeChunk' AND policyname = 'knowledge_chunk_read_reviewed_72bac3b2'`,
  );
  const readPolicy = policy.rows[0];
  findings.push(finding("vector.reviewedReadPolicy", readPolicy?.permissive === true && readPolicy.cmd === "SELECT" &&
    Array.isArray(readPolicy.roles) && JSON.stringify([...readPolicy.roles].sort()) === JSON.stringify(["authenticated"]) &&
    matchesCatalogSignature("policy:public:KnowledgeChunk:knowledge_chunk_read_reviewed_72bac3b2:using", "reviewed = true", readPolicy.qual, serverMajor),
  "VECTOR_REVIEW_POLICY_MISSING_OR_WEAK"));
  const allPolicies = await client.query<CatalogRow>(
    `SELECT tablename AS "tableName", policyname AS name, permissive = 'PERMISSIVE' AS permissive, roles::text[] AS roles, cmd, qual, with_check AS "withCheck"
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'KnowledgeChunk'`,
  );
  const expectedVectorPolicies = requiredPolicySpecs(["KnowledgeChunk"]);
  const vectorPoliciesOk = allPolicies.rows.length === expectedVectorPolicies.length && expectedVectorPolicies.every(spec => {
    const row = allPolicies.rows.find(candidate => candidate.name === spec.name && candidate.tableName === spec.table);
    return Boolean(row && row.permissive === spec.permissive && row.cmd === spec.command && Array.isArray(row.roles) &&
      JSON.stringify([...row.roles].sort()) === JSON.stringify([...spec.roles].sort()) &&
      matchesCatalogSignature(`policy:public:${spec.table}:${spec.name}:using`, spec.using, row.qual, serverMajor) &&
      matchesCatalogSignature(`policy:public:${spec.table}:${spec.name}:withCheck`, spec.withCheck, row.withCheck, serverMajor));
  });
  findings.push(finding("vector.trustedPolicies", vectorPoliciesOk, "TRUSTED_POLICY_MISSING_OR_WEAK"));
  const grant = await client.query<CatalogRow>(`SELECT CASE WHEN to_regclass('public."KnowledgeChunk"') IS NULL THEN false
    ELSE has_table_privilege('authenticated', to_regclass('public."KnowledgeChunk"'), 'SELECT') END AS allowed`);
  findings.push(finding("vector.readGrant", grant.rows[0]?.allowed === true, "VECTOR_READ_GRANT_MISSING"));
  return { status: findings.every(item => item.status === "PASS") ? "PASS" : "BLOCKED", findings };
}

type PolicySpec = { table: string; name: string; permissive: boolean; command: string; roles: readonly string[]; using?: string; withCheck?: string };
type ContractPolicy = { tableName: string; name: string; permissive: boolean; operation: string; roles: readonly string[]; using?: string; withCheck?: string };
function requiredPolicySpecs(tables: readonly string[]): PolicySpec[] {
  const byTable = tables.map(table => Object.entries(publicEntries.policy).filter(([, policy]) => (policy as ContractPolicy).tableName === table));
  return byTable.flatMap(entries => entries.flatMap(([key, policy]) => {
    const expected = policy as ContractPolicy;
    // Attest the complete selected-table policy set, including ordinary owner writes.
    void key;
    return [{ table: expected.tableName, name: expected.name, permissive: expected.permissive,
      command: expected.operation.toUpperCase(), roles: expected.roles, using: expected.using, withCheck: expected.withCheck }];
  }));
}

// Keep this copy aligned with the immutable migration-owned definition in app/20261010T0752_private_material_storage/storage-policy.ts.
// Full predicate signatures catch weakening while retaining a policy's name.
const materialOwner = `(bucket_id = 'learnly-materials' AND owner_id = (SELECT auth.uid())::text
  AND array_length(string_to_array(name, '/'), 1) = 3
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  AND split_part(name, '/', 2) ~ '^[a-zA-Z0-9_-]{1,128}$'
  AND split_part(name, '/', 3) ~ '^[a-zA-Z0-9_-]{1,128}\\.(pdf|png|jpg)$'
  AND EXISTS (SELECT 1 FROM public."LearningSession" s JOIN public."User" u ON u.id = s."userId"
    WHERE s.id = split_part(name, '/', 2) AND u."authUserId" = (SELECT auth.uid())::text))`;
const materialActiveOwner = `(${materialOwner} AND EXISTS (SELECT 1 FROM public."LearningSession" active
  WHERE active.id = split_part(name, '/', 2) AND active."lifecycleState" = 'ACTIVE'))`;
const materialOtherBucket = `bucket_id IS DISTINCT FROM 'learnly-materials'`;
const pendingIntentGuard = `(bucket_id IS DISTINCT FROM 'learnly-materials' OR EXISTS (
  SELECT 1 FROM public."FileUpload" f
  JOIN public."LearningSession" s ON s.id = f."learningSessionId"
  JOIN public."User" u ON u.id = s."userId"
  WHERE f.state = 'PENDING' AND s."lifecycleState" = 'ACTIVE'
    AND u."authUserId" = (SELECT auth.uid())::text
    AND f."learningSessionId" = split_part(storage.objects.name, '/', 2)
    AND f.id = split_part(split_part(storage.objects.name, '/', 3), '.', 1)
    AND f.material->>'id' = f.id
    AND f.material->>'storageBucket' = storage.objects.bucket_id
    AND f.material->>'storageKey' = storage.objects.name
    AND f.material->'file'->>'extension' = split_part(storage.objects.name, '.', 2)
    AND ((f.material->'file'->>'type' = 'PDF' AND f.material->'file'->>'mimeType' = 'application/pdf'
      AND f.material->'file'->>'extension' = 'pdf')
      OR (f.material->'file'->>'type' = 'IMAGE' AND ((f.material->'file'->>'mimeType' = 'image/png'
        AND f.material->'file'->>'extension' = 'png') OR (f.material->'file'->>'mimeType' = 'image/jpeg'
        AND f.material->'file'->>'extension' = 'jpg'))))
    AND f.material->'file'->>'contentHash' ~ '^[a-f0-9]{64}$'
    AND CASE WHEN f.material->'file'->>'sizeBytes' ~ '^[1-9][0-9]{0,6}$'
      THEN (f.material->'file'->>'sizeBytes')::integer BETWEEN 1 AND 3145728 ELSE false END
    AND NOT EXISTS (SELECT 1 FROM public."SourceMaterial" m
      WHERE m.id = f.id AND m."learningSessionId" = f."learningSessionId")
))`;
export const requiredStoragePolicies = [
  { name: "learnly_materials_select_own", command: "SELECT", permissive: true, role: "authenticated", using: materialOwner },
  { name: "learnly_materials_insert_own", command: "INSERT", permissive: true, role: "authenticated", withCheck: materialActiveOwner },
  { name: "learnly_materials_delete_own", command: "DELETE", permissive: true, role: "authenticated", using: materialOwner },
  { name: "learnly_materials_select_guard", command: "SELECT", permissive: false, role: "authenticated", using: `(${materialOtherBucket} OR ${materialOwner})` },
  { name: "learnly_materials_insert_guard", command: "INSERT", permissive: false, role: "authenticated", withCheck: `(${materialOtherBucket} OR ${materialActiveOwner})` },
  { name: "learnly_materials_delete_guard", command: "DELETE", permissive: false, role: "authenticated", using: `(${materialOtherBucket} OR ${materialOwner})` },
  { name: "learnly_materials_update_guard", command: "UPDATE", permissive: false, role: "authenticated", using: materialOtherBucket, withCheck: materialOtherBucket },
  { name: "learnly_materials_anon_guard", command: "ALL", permissive: false, role: "anon", using: materialOtherBucket, withCheck: materialOtherBucket },
  { name: "learnly_materials_pending_intent_guard", command: "INSERT", permissive: false, role: "authenticated", withCheck: pendingIntentGuard },
];

export async function checkActivationSchema(options: { uploads?: boolean; connectionString?: string; signal?: AbortSignal; expectedDatabase?: string } = {}): Promise<ActivationInspection> {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Database configuration missing");
  const client = new Client({ connectionString, connectionTimeoutMillis: 2000, query_timeout: 2500, statement_timeout: 2000 });
  client.on("error", () => {});
  let closing: Promise<void> | undefined;
  const close = () => closing ??= client.end();
  const abort = () => { void close().catch(() => {}); };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    options.signal?.throwIfAborted();
    await client.connect();
    options.signal?.throwIfAborted();
    await client.query("BEGIN READ ONLY");
    const result = await inspectActivationSchema(client, options);
    await client.query("ROLLBACK");
    return result;
  } finally { options.signal?.removeEventListener("abort", abort); await close(); }
}

export async function checkVectorPrerequisites(options: { connectionString?: string; signal?: AbortSignal; expectedDatabase?: string } = {}): Promise<ActivationInspection> {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Database configuration missing");
  const client = new Client({ connectionString, connectionTimeoutMillis: 2000, query_timeout: 2500, statement_timeout: 2000 });
  client.on("error", () => {});
  let closing: Promise<void> | undefined;
  const close = () => closing ??= client.end();
  const abort = () => { void close().catch(() => {}); };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    options.signal?.throwIfAborted();
    await client.connect();
    options.signal?.throwIfAborted();
    await client.query("BEGIN READ ONLY");
    const result = await inspectVectorPrerequisites(client, options.expectedDatabase);
    await client.query("ROLLBACK");
    return result;
  } finally { options.signal?.removeEventListener("abort", abort); await close(); }
}
