import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { SourceRecord } from "./domain.js";
import { SourceProcessingError } from "./source-processing-error.js";
import { compileJsonSchema, validateSourceManifest } from "./schema-validation.js";

export const SOURCE_PROCESSING_VERSION = "2.1.0";

// Version by format: improvements to LaTeX must not invalidate reviewed EPUB evidence.
export function normalizerVersion(sourceId: string): string {
  return sourceId === "open-logic-project" ? "2.2.0" : SOURCE_PROCESSING_VERSION;
}

export const SUPPORTED_SOURCE_IDS = new Set([
  "siyavula-mathematics-g10-g12-ccby",
  "siyavula-physical-sciences-g10-g12-ccby",
  "open-logic-project",
]);

export function isSiyavulaSource(sourceId: string): boolean {
  return sourceId === "siyavula-mathematics-g10-g12-ccby"
    || sourceId === "siyavula-physical-sciences-g10-g12-ccby";
}

export function loadSourceRegistry(knowledgeRoot: string): Map<string, SourceRecord> {
  const manifestPath = join(knowledgeRoot, "manifest", "sources.json");
  const sourceSchemaPath = join(knowledgeRoot, "schemas", "source.schema.json");
  const value = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  const result = validateSourceManifest(
    value,
    compileJsonSchema(sourceSchemaPath),
    "manifest/sources.json",
  );

  if (!result.manifest) {
    throw new SourceProcessingError(
      "SOURCE_REGISTRY_INVALID",
      `Source registry is invalid: ${result.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`,
    );
  }

  return new Map(result.manifest.sources.map((source) => [source.source_id, source]));
}

export function assertSourceCanBeAcquired(source: SourceRecord | undefined, sourceId: string): SourceRecord {
  if (!source) {
    throw new SourceProcessingError("UNKNOWN_SOURCE", `Unknown source_id: ${sourceId}`);
  }
  if (source.rag_permission_status === "do_not_ingest") {
    throw new SourceProcessingError("SOURCE_BLOCKED", `Source is marked do_not_ingest: ${sourceId}`);
  }
  if (source.rag_permission_status === "reference_only" || source.rag_permission_status === "unclear") {
    throw new SourceProcessingError(
      "SOURCE_NOT_INGESTIBLE",
      `Source permission does not allow automated ingestion: ${sourceId} (${source.rag_permission_status})`,
    );
  }
  if (!SUPPORTED_SOURCE_IDS.has(sourceId)) {
    throw new SourceProcessingError("SOURCE_UNSUPPORTED", `Source has no Phase 2 normalizer: ${sourceId}`);
  }

  return source;
}

export function assertSupportedFilename(sourceId: string, filename: string): void {
  const lower = filename.toLowerCase();
  if (isSiyavulaSource(sourceId) && !lower.endsWith(".epub")) {
    throw new SourceProcessingError("UNSUPPORTED_FORMAT", `Siyavula artifacts must be EPUB files: ${filename}`);
  }
  if (sourceId === "open-logic-project" && !lower.endsWith(".tex") && !lower.endsWith(".zip")) {
    throw new SourceProcessingError(
      "UNSUPPORTED_FORMAT",
      `Open Logic Project artifacts must be .tex or .zip files: ${filename}`,
    );
  }
}
