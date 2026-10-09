import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import type { AcquisitionArtifact, AcquisitionManifest } from "./domain.js";
import { compileJsonSchema, validateWithSchema } from "./schema-validation.js";
import { SourceProcessingError } from "./source-processing-error.js";
import {
  assertSourceCanBeAcquired,
  assertSupportedFilename,
  loadSourceRegistry,
  SOURCE_PROCESSING_VERSION,
} from "./source-processing-policy.js";
import { readAcquisitionManifest, validateSourceProcessing } from "./source-processing-validation.js";

export interface AcquireArtifactInput {
  sourceId: string;
  filename: string;
  sourceUrl: string;
  bytes: Uint8Array;
  artifactId?: string;
  acquiredAt?: string;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function calculateSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeManifestAtomically(path: string, manifest: AcquisitionManifest): void {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  renameSync(temporaryPath, path);
}

export function acquireArtifact(knowledgeRoot: string, input: AcquireArtifactInput): AcquisitionArtifact {
  const root = resolve(knowledgeRoot);
  const filename = basename(input.filename);
  if (!filename || filename !== input.filename) {
    throw new SourceProcessingError("ACQUISITION_INVALID", "filename must be a plain original filename without directories");
  }
  if (input.bytes.byteLength === 0) {
    throw new SourceProcessingError("ACQUISITION_INVALID", "Cannot acquire an empty artifact");
  }
  try {
    const sourceUrl = new URL(input.sourceUrl);
    if (sourceUrl.protocol !== "https:" && sourceUrl.protocol !== "http:") throw new Error("unsupported protocol");
  } catch (error) {
    throw new SourceProcessingError("ACQUISITION_INVALID", `Invalid source URL: ${input.sourceUrl}`, { cause: error });
  }

  const sources = loadSourceRegistry(root);
  const source = assertSourceCanBeAcquired(sources.get(input.sourceId), input.sourceId);
  assertSupportedFilename(input.sourceId, filename);
  const state = validateSourceProcessing(root, sources, { includeNormalized: false });
  if (!state.valid) {
    throw new SourceProcessingError(
      state.issues.some((item) => item.keyword === "rawArtifactChecksum")
        ? "RAW_ARTIFACT_MODIFIED"
        : "ACQUISITION_INVALID",
      `Existing acquisition state is invalid: ${state.issues.map((item) => `${item.file}${item.path} ${item.message}`).join("; ")}`,
    );
  }

  const manifest = readAcquisitionManifest(root);
  const sha256 = calculateSha256(input.bytes);
  if (manifest.artifacts.some((artifact) => artifact.sha256 === sha256)) {
    throw new SourceProcessingError("DUPLICATE_ARTIFACT", `Artifact checksum is already acquired: ${sha256}`);
  }

  const requestedArtifactId = input.artifactId ?? `${input.sourceId}-${sha256.slice(0, 12)}`;
  const artifactId = slug(requestedArtifactId);
  if (!artifactId || artifactId !== requestedArtifactId) {
    throw new SourceProcessingError(
      "ACQUISITION_INVALID",
      "artifact_id must contain only lowercase letters, numbers, and hyphens",
    );
  }
  if (manifest.artifacts.some((artifact) => artifact.artifact_id === artifactId)) {
    throw new SourceProcessingError("DUPLICATE_ARTIFACT", `artifact_id is already acquired: ${artifactId}`);
  }

  const acquiredAt = input.acquiredAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(acquiredAt))) {
    throw new SourceProcessingError("ACQUISITION_INVALID", `Invalid acquired_at timestamp: ${acquiredAt}`);
  }
  const rawPath = ["raw", input.sourceId, artifactId, filename].join("/");
  const absoluteRawPath = join(root, ...rawPath.split("/"));
  const artifact: AcquisitionArtifact = {
    source_id: input.sourceId,
    artifact_id: artifactId,
    filename,
    raw_path: rawPath,
    sha256,
    acquired_at: acquiredAt,
    parser_version: SOURCE_PROCESSING_VERSION,
    license_status: source.rag_permission_status as AcquisitionArtifact["license_status"],
    license: String(source.license),
    source_url: input.sourceUrl,
  };
  const nextManifest: AcquisitionManifest = {
    ...manifest,
    artifacts: [...manifest.artifacts, artifact],
  };
  const manifestIssues = validateWithSchema(
    compileJsonSchema(join(root, "schemas", "acquisition-manifest.schema.json")),
    nextManifest,
    "acquisition/manifest.json",
  );
  if (manifestIssues.length > 0) {
    throw new SourceProcessingError(
      "ACQUISITION_INVALID",
      `Acquisition metadata is invalid: ${manifestIssues.map((item) => `${item.path} ${item.message}`).join("; ")}`,
    );
  }

  mkdirSync(dirname(absoluteRawPath), { recursive: true });
  try {
    writeFileSync(absoluteRawPath, input.bytes, { flag: "wx", mode: 0o444 });
    chmodSync(absoluteRawPath, 0o444);
    writeManifestAtomically(join(root, "acquisition", "manifest.json"), nextManifest);
  } catch (error) {
    rmSync(join(root, "raw", input.sourceId, artifactId), { recursive: true, force: true });
    throw error;
  }

  return artifact;
}

export function acquireLocalFile(
  knowledgeRoot: string,
  options: Omit<AcquireArtifactInput, "bytes" | "filename"> & { filePath: string; filename?: string },
): AcquisitionArtifact {
  return acquireArtifact(knowledgeRoot, {
    ...options,
    filename: options.filename ?? basename(options.filePath),
    bytes: readFileSync(options.filePath),
  });
}
