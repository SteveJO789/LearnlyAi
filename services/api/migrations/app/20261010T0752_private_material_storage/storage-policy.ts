/** Immutable migration-owned policy definitions. Never use user_metadata for authorization. */
export const MATERIAL_BUCKET = "learnly-materials";
export const MATERIAL_BUCKET_MAX_BYTES = 3 * 1024 * 1024;
export const MATERIAL_BUCKET_MIMES = ["application/pdf", "image/png", "image/jpeg"] as const;

const owner = `(bucket_id = '${MATERIAL_BUCKET}' AND owner_id = (SELECT auth.uid())::text
  AND array_length(string_to_array(name, '/'), 1) = 3
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  AND split_part(name, '/', 2) ~ '^[a-zA-Z0-9_-]{1,128}$'
  AND split_part(name, '/', 3) ~ '^[a-zA-Z0-9_-]{1,128}\\.(pdf|png|jpg)$'
  AND EXISTS (SELECT 1 FROM public."LearningSession" s JOIN public."User" u ON u.id = s."userId"
    WHERE s.id = split_part(name, '/', 2) AND u."authUserId" = (SELECT auth.uid())::text))`;
const activeOwner = `(${owner} AND EXISTS (SELECT 1 FROM public."LearningSession" active
  WHERE active.id = split_part(name, '/', 2) AND active."lifecycleState" = 'ACTIVE'))`;
const otherBucket = `bucket_id IS DISTINCT FROM '${MATERIAL_BUCKET}'`;

export const MATERIAL_STORAGE_POLICIES = Object.freeze([
  { name: "learnly_materials_select_own", operation: "select", permissive: true, roles: ["authenticated"], using: owner },
  { name: "learnly_materials_insert_own", operation: "insert", permissive: true, roles: ["authenticated"], withCheck: activeOwner },
  // Cleanup/download remain possible if an owned session completes after upload.
  { name: "learnly_materials_delete_own", operation: "delete", permissive: true, roles: ["authenticated"], using: owner },
  // Restrictive guards prevent broader existing/future policies from OR-bypassing private ownership.
  { name: "learnly_materials_select_guard", operation: "select", permissive: false, roles: ["authenticated"], using: `(${otherBucket} OR ${owner})` },
  { name: "learnly_materials_insert_guard", operation: "insert", permissive: false, roles: ["authenticated"], withCheck: `(${otherBucket} OR ${activeOwner})` },
  { name: "learnly_materials_delete_guard", operation: "delete", permissive: false, roles: ["authenticated"], using: `(${otherBucket} OR ${owner})` },
  { name: "learnly_materials_update_guard", operation: "update", permissive: false, roles: ["authenticated"], using: otherBucket, withCheck: otherBucket },
  // Anonymous denial must not evaluate joins to app tables that anon cannot SELECT.
  { name: "learnly_materials_anon_guard", operation: "all", permissive: false, roles: ["anon"], using: otherBucket, withCheck: otherBucket },
] as const);
