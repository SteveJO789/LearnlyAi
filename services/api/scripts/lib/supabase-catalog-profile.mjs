import { supabasePackWith } from "@prisma/orm-extension-supabase/pack";
import supabasePack from "@prisma/orm-extension-supabase/pack";
import { computeStorageHash } from "@prisma/orm-framework/contract/hashing";
import { sqlContractCanonicalizationHooks } from "@prisma/orm-family-sql/contract/canonicalization-hooks";

const PACKAGE_VERSION = "8.0.0-rc.12";
const UPSTREAM_STORAGE_HASH = "734893bc990ae5ec14dc7ad50a7d8b5873a864f056085a7ffd2f69c866989067";
const GOTRUE_POP6_PROFILE = "gotrue-pop6-v6.1.1";
const GOTRUE_POP6_STORAGE_HASH = "af8551fb983a08dfc85ce28b82b7084e836639ee6c9e8e1cec63d68330ddf212";

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
  throw new Error("Unknown Supabase catalog profile");
}
