import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, posix, relative, resolve, sep } from "node:path";

import type {
  AcquisitionArtifact,
  AcquisitionManifest,
  NormalizedUnit,
  SourceProcessingValidationResult,
  SourceRecord,
  ValidationIssue,
} from "./domain.js";
import { compileJsonSchema, validateWithSchema } from "./schema-validation.js";
import { normalizerVersion, SUPPORTED_SOURCE_IDS } from "./source-processing-policy.js";
import { unzipControlled } from "./archive.js";

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile() && entry.name !== ".gitkeep") files.push(path);
  }
  return files.sort();
}

function issue(file: string, path: string, keyword: string, message: string): ValidationIssue {
  return { file, path, keyword, message };
}

function readManifest(root: string, issues: ValidationIssue[]): AcquisitionManifest | undefined {
  const path = join(root, "acquisition", "manifest.json");
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    issues.push(issue(
      "acquisition/manifest.json",
      "",
      "parse",
      error instanceof Error ? error.message : "could not parse acquisition manifest",
    ));
    return undefined;
  }

  const validator = compileJsonSchema(join(root, "schemas", "acquisition-manifest.schema.json"));
  const schemaIssues = validateWithSchema(validator, value, "acquisition/manifest.json");
  issues.push(...schemaIssues);
  return schemaIssues.length === 0 ? value as AcquisitionManifest : undefined;
}

function portableRelative(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

function validateArtifactRecords(
  root: string,
  manifest: AcquisitionManifest,
  sources: ReadonlyMap<string, SourceRecord>,
  issues: ValidationIssue[],
): Map<string, AcquisitionArtifact> {
  const artifactIds = new Set<string>();
  const checksums = new Set<string>();
  const artifactMap = new Map<string, AcquisitionArtifact>();
  const trackedRawPaths = new Set<string>();

  manifest.artifacts.forEach((artifact, index) => {
    const basePath = `/artifacts/${index}`;
    const source = sources.get(artifact.source_id);
    if (!source) {
      issues.push(issue("acquisition/manifest.json", `${basePath}/source_id`, "sourceReference", `unknown source: ${artifact.source_id}`));
    } else if (source.rag_permission_status === "do_not_ingest") {
      issues.push(issue("acquisition/manifest.json", `${basePath}/source_id`, "sourcePermission", "do_not_ingest sources cannot be acquired"));
    } else if (source.rag_permission_status !== "allowed" && source.rag_permission_status !== "internally_authored") {
      issues.push(issue("acquisition/manifest.json", `${basePath}/source_id`, "sourcePermission", `${source.rag_permission_status} sources cannot be acquired automatically`));
    }
    if (!SUPPORTED_SOURCE_IDS.has(artifact.source_id)) {
      issues.push(issue("acquisition/manifest.json", `${basePath}/source_id`, "supportedSource", "source has no Phase 2 normalizer"));
    }
    if (source && artifact.license_status !== source.rag_permission_status) {
      issues.push(issue("acquisition/manifest.json", `${basePath}/license_status`, "licenseConsistency", "must match the source registry"));
    }
    if (source && artifact.license !== source.license) {
      issues.push(issue("acquisition/manifest.json", `${basePath}/license`, "licenseConsistency", "must match the source registry"));
    }
    if (artifactIds.has(artifact.artifact_id)) {
      issues.push(issue("acquisition/manifest.json", `${basePath}/artifact_id`, "uniqueArtifactId", `duplicate artifact_id: ${artifact.artifact_id}`));
    }
    if (checksums.has(artifact.sha256)) {
      issues.push(issue("acquisition/manifest.json", `${basePath}/sha256`, "uniqueArtifactChecksum", `duplicate artifact checksum: ${artifact.sha256}`));
    }
    artifactIds.add(artifact.artifact_id);
    checksums.add(artifact.sha256);
    artifactMap.set(artifact.artifact_id, artifact);

    const expectedRawPath = posix.join("raw", artifact.source_id, artifact.artifact_id, artifact.filename);
    if (artifact.raw_path !== expectedRawPath) {
      issues.push(issue("acquisition/manifest.json", `${basePath}/raw_path`, "rawPath", `must equal ${expectedRawPath}`));
      return;
    }
    trackedRawPaths.add(artifact.raw_path);
    const absoluteRawPath = resolve(root, ...artifact.raw_path.split("/"));
    if (!existsSync(absoluteRawPath)) {
      issues.push(issue(artifact.raw_path, "", "rawArtifact", "tracked raw artifact is missing"));
      return;
    }
    const actualChecksum = sha256File(absoluteRawPath);
    if (actualChecksum !== artifact.sha256) {
      issues.push(issue(artifact.raw_path, "", "rawArtifactChecksum", "raw artifact was modified after acquisition"));
    }
  });

  for (const rawFile of listFiles(join(root, "raw"))) {
    const rawPath = portableRelative(root, rawFile);
    if (!trackedRawPaths.has(rawPath)) {
      issues.push(issue(rawPath, "", "untrackedRawArtifact", "raw artifact is not recorded in the acquisition manifest"));
    }
  }

  return artifactMap;
}

function validateNormalizedRecords(
  root: string,
  artifacts: ReadonlyMap<string, AcquisitionArtifact>,
  issues: ValidationIssue[],
): NormalizedUnit[] {
  const validator = compileJsonSchema(join(root, "schemas", "normalized-unit.schema.json"));
  const records: NormalizedUnit[] = [];
  const archivePaths = new Map<string, Set<string>>();

  for (const path of listFiles(join(root, "normalized")).filter((file) => file.endsWith(".json"))) {
    const file = portableRelative(root, path);
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    } catch (error) {
      issues.push(issue(file, "", "parse", error instanceof Error ? error.message : "could not parse normalized record"));
      continue;
    }
    const schemaIssues = validateWithSchema(validator, value, file);
    issues.push(...schemaIssues);
    if (schemaIssues.length > 0) continue;

    const record = value as NormalizedUnit;
    records.push(record);
    const expectedPrefix = posix.join("normalized", record.source_id, record.artifact_id);
    if (!file.startsWith(`${expectedPrefix}/`)) {
      issues.push(issue(file, "", "normalizedPath", `must be stored under ${expectedPrefix}/`));
    }
    const artifact = artifacts.get(record.artifact_id);
    if (!artifact || artifact.source_id !== record.source_id) {
      issues.push(issue(file, "/artifact_id", "artifactReference", "must reference an acquired artifact for the same source"));
      continue;
    }
    const expected = {
      artifact_sha256: artifact.sha256,
      raw_path: artifact.raw_path,
      source_url: artifact.source_url,
      license_status: artifact.license_status,
      parser_version: normalizerVersion(record.source_id),
    };
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (record.provenance[key as keyof typeof record.provenance] !== expectedValue) {
        issues.push(issue(file, `/provenance/${key}`, "provenance", key === "parser_version"
          ? "must match the current normalizer version; rerun knowledge:normalize"
          : "must match the acquisition manifest"));
      }
    }
    if (record.assets?.length) {
      try {
        if (!archivePaths.has(artifact.artifact_id)) {
          archivePaths.set(artifact.artifact_id, new Set(Object.keys(unzipControlled(readFileSync(join(root, artifact.raw_path))))));
        }
        record.assets.forEach((asset, index) => {
          if (!archivePaths.get(artifact.artifact_id)!.has(asset.archive_path)) {
            issues.push(issue(file, `/assets/${index}/archive_path`, "assetReference", "must reference an image in the acquired archive"));
          }
          const requiredWarning = asset.kind === "math_image" ? "image_math_requires_review" : "image_requires_review";
          if (!record.normalization_warnings?.includes(requiredWarning)) {
            issues.push(issue(file, "/normalization_warnings", "assetReview", `must include ${requiredWarning}`));
          }
        });
      } catch (error) {
        issues.push(issue(file, "/assets", "assetReference", error instanceof Error ? error.message : "could not inspect acquired archive"));
      }
    }
  }

  return records;
}

export function validateSourceProcessing(
  knowledgeRoot: string,
  sources: ReadonlyMap<string, SourceRecord>,
  options: { includeNormalized?: boolean } = {},
): SourceProcessingValidationResult {
  const root = resolve(knowledgeRoot);
  const issues: ValidationIssue[] = [];
  const manifest = readManifest(root, issues);
  const artifacts = manifest ? validateArtifactRecords(root, manifest, sources, issues) : new Map<string, AcquisitionArtifact>();
  const normalizedRecords = options.includeNormalized === false
    ? []
    : validateNormalizedRecords(root, artifacts, issues);

  return { valid: issues.length === 0, issues, manifest, normalizedRecords };
}

export function readAcquisitionManifest(knowledgeRoot: string): AcquisitionManifest {
  return JSON.parse(
    readFileSync(join(resolve(knowledgeRoot), "acquisition", "manifest.json"), "utf8"),
  ) as AcquisitionManifest;
}
